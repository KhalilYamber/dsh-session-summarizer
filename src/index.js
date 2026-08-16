/**
 * dsh-session-summarizer — DSH 生态原生插件
 *
 * 注册模型可见工具 `session_summarize`：
 *   读最近（或指定）DSH 会话 → 生成上下文摘要 → 返回摘要文本。
 *
 * 会话读取：
 *   1. 优先读「当前会话」：exec.agent.session（live）→ ctx.sessions.get(id)
 *      → Session.deriveMessages()（官方派生的 LLM 消息历史，deep-frozen）；
 *   2. 显式 sessionId 或 live 不可得时：ctx.sessionPersistence.inspect(id)
 *      （落盘事件日志，由 jsonl 后端负责 zstd 解压）；
 *   3. 无任何 id 时：ctx.sessionPersistence.listSnapshots() 取最近活跃快照。
 *
 * 摘要生成：ctx.llm.stream({provider:'deepseek-official', model, messages})，
 * 收集 text-delta 块拼成最终文本。
 *
 * 形态：标准 Cordis bundle 插件（package.json 声明 dsh.bundle.patch），
 * 模块导出 { name, inject, apply }，无第三方依赖（工具定义用官方
 * defineTool；Config 用纯对象，避免 schemastery 依赖）。
 */

import { defineTool } from '@deepseek-ai/dsh-tools';

export const name = 'dsh-session-summarizer';

/** 硬依赖声明：持久化接缝 + 内存会话仓 + 模型运行时 + 工具注册表。 */
export const inject = ['sessionPersistence', 'sessions', 'llm', 'tools'];

const PROMPT_TEMPLATE = `请阅读以下 DSH 会话转录，产出一份中文「上下文摘要」。
要求：
1. 按主题归纳这段对话在做什么、解决了什么问题；
2. 列出关键结论、决定、待办与重要细节（文件路径、命令、参数）；
3. 控制在 300 字以内，用列表呈现。

会话转录：
`;

/** 转录截断：保留首尾，中段用提示行替代。 */
function truncateTranscript(text, budget) {
  if (text.length <= budget) return text;
  const notice = '\n\n【对话内容过长，已截断中间部分，仅保留首尾】\n\n';
  const keep = budget - notice.length;
  const head = Math.ceil(keep / 2);
  return text.slice(0, head) + notice + text.slice(text.length - (keep - head));
}

/** 提取 ContentBlock 数组中的文本。 */
function contentToText(parts) {
  if (typeof parts === 'string') return parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p && typeof p === 'object' && p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
}

/**
 * 从落盘事件日志构建人类可读转录（镜像 obsidian-export 引擎的做法）：
 * user/message（仅 source.kind === 'user'，滤掉系统注入）与 assistant/message。
 */
function transcriptFromEvents(events, maxTurns) {
  const lines = [];
  let userTurns = 0;
  for (const ev of events) {
    const d = ev.data || {};
    if (ev.type === 'user/message') {
      if ((d.source || {}).kind !== 'user') continue;
      userTurns += 1;
      if (maxTurns > 0 && userTurns > maxTurns) break;
      lines.push(`用户：${contentToText(d.content) || '（空消息/仅附件）'}`);
    } else if (ev.type === 'assistant/message') {
      const m = d.message || {};
      const text = contentToText(m.content);
      if (text) lines.push(`助手：${text}`);
    }
  }
  return lines.join('\n');
}

/** 从 live Session 的派生消息构建转录。 */
function transcriptFromMessages(messages, maxTurns) {
  const lines = [];
  let userTurns = 0;
  for (const msg of messages) {
    const text = contentToText(msg.content);
    if (!text) continue;
    if (msg.role === 'user') {
      userTurns += 1;
      if (maxTurns > 0 && userTurns > maxTurns) break;
      lines.push(`用户：${text}`);
    } else if (msg.role === 'assistant') {
      lines.push(`助手：${text}`);
    }
  }
  return lines.join('\n');
}

/** 解析目标会话 id：显式参数 → 当前 agent 会话 → 最近活跃落盘会话。 */
async function resolveSessionId(ctx, args, exec, recentScanLimit) {
  if (args.sessionId) return { id: args.sessionId, source: 'explicit' };
  const liveId = exec?.agent?.session?.id;
  if (liveId) return { id: liveId, source: 'current-agent' };
  const limit = Number(recentScanLimit ?? 10);
  const snapshots = await ctx.sessionPersistence.listSnapshots();
  const sorted = [...snapshots].sort((a, b) => {
    const at = (h) => h.updatedAt ?? h.createdAt ?? 0;
    return at(b.header) - at(a.header);
  });
  const top = sorted.slice(0, limit);
  if (!top.length) return { id: undefined, source: 'none' };
  return { id: top[0].header.id, source: 'recent-active' };
}

/** 读取会话并构建转录。 */
async function loadTranscript(ctx, sessionId, maxTurns) {
  const live = ctx.sessions.get(sessionId);
  if (live) {
    const messages = live.deriveMessages();
    return { transcript: transcriptFromMessages(messages, maxTurns), turns: messages.length, path: 'live-sessions' };
  }
  const insp = await ctx.sessionPersistence.inspect(sessionId);
  const events = Array.from(insp.events || []);
  return { transcript: transcriptFromEvents(events, maxTurns), turns: events.length, path: 'persistence-inspect' };
}

export function apply(ctx, config = {}) {
  const model = config.model || 'deepseek-v4-flash';
  const transcriptChars = Number(config.transcriptChars ?? 12000);
  const maxTurns = Number(config.maxTurns ?? 0); // 0 = 不限
  const recentScanLimit = config.recentScanLimit ?? 10;

  ctx.tools.register(defineTool({
    name: 'session_summarize',
    description: [
      '读取最近（或指定）DSH 会话，生成上下文摘要并返回摘要文本。',
      'sessionId 缺省时：优先当前会话，失败则回退最近活跃的落盘会话。',
    ].join(' '),
    parameters: {
      sessionId: {
        type: 'string',
        description: '可选：要摘要的会话 id；缺省使用当前/最近活跃会话。',
      },
      lastTurns: {
        type: 'integer',
        description: '可选：只摘要最后 N 轮（用户消息数）；缺省不限制。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          summary: { type: 'string', required: true },
          sessionId: { type: 'string', required: true },
          source: { type: 'string', required: true },
          readPath: { type: 'string', required: true },
          chars: { type: 'integer', required: true },
          message: { type: 'string' },
        },
      },
      render: (_args, value) => [
        { type: 'text', text: value.ok ? value.summary : `摘要失败：${value.message ?? '未知错误'}` },
      ],
    },
    async execute(args, exec) {
      try {
        const { id: sessionId, source } = await resolveSessionId(ctx, args, exec, recentScanLimit);
        if (!sessionId) {
          return { ok: false, summary: '', sessionId: '', source, readPath: 'none', chars: 0, message: '无可读会话：未指定 sessionId 且没有当前/最近活跃会话' };
        }
        const { transcript, turns, path } = await loadTranscript(ctx, sessionId, Number(args.lastTurns ?? 0));
        if (!transcript.trim()) {
          return { ok: false, summary: '', sessionId, source, readPath: path, chars: 0, message: `会话 ${sessionId} 无对话内容可摘要` };
        }
        const truncated = truncateTranscript(transcript, transcriptChars);
        const prompt = PROMPT_TEMPLATE + truncated;
        const chunks = [];
        for await (const chunk of ctx.llm.stream({
          provider: 'deepseek-official',
          model,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
          signal: exec.signal,
        })) {
          if (chunk.type === 'text-delta') chunks.push(chunk.text);
          else if (chunk.type === 'block-end' && chunk.block?.type === 'text') {
            const text = contentToText([chunk.block]);
            if (text) chunks.push(text);
          }
        }
        const summary = chunks.join('').trim();
        if (!summary) {
          return { ok: false, summary: '', sessionId, source, readPath: path, chars: truncated.length, message: '模型未返回摘要文本' };
        }
        return { ok: true, summary, sessionId, source, readPath: path, chars: truncated.length };
      } catch (err) {
        return { ok: false, summary: '', sessionId: args.sessionId ?? '', source: 'error', readPath: 'error', chars: 0, message: err instanceof Error ? err.message : String(err) };
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: `摘要会话 ${args.sessionId ?? '(当前/最近)'}`,
      kind: 'other',
      rawInput: args,
    }),
  }));
}
