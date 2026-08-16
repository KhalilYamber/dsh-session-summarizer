# dsh-session-summarizer

DSH（DeepSeek Harness）生态原生 Cordis 插件：读取指定 / 当前 / 最近会话并生成上下文摘要，帮助模型在长会话中恢复上下文。全程走 DSH 官方运行时（`@deepseek-ai/dsh-session` 读取会话、`@deepseek-ai/dsh-llm` 生成摘要），不依赖任何外部服务。

## 简介

插件以 bundle patch 方式挂载到 profile，注册模型可见工具 `session_summarize`。它读取指定（或当前 / 最近）会话内容，调用模型产出一份中文「上下文摘要」并回复，供模型在长会话中快速恢复上下文。

目录结构：

```
dsh-session-summarizer/
├── package.json         # manifest：main 指向 src/index.js，dsh.bundle.patch 声明
├── cordis.patch.yml     # bundle patch 层：向 profile 插入插件行
├── src/
│   └── index.js         # 插件入口 { name, inject, apply }，注册 session_summarize 工具
├── README.md
├── CHANGELOG.md
└── LICENSE
```

## 安装

以 bundle patch 形式把插件装入 profile 的 node_modules，随 `dsh plugin` 命令完成。

```sh
# 从 npm 安装（发布形态）
dsh plugin --profile <profile名> add dsh-session-summarizer

# 从 GitHub 仓库安装
dsh plugin --profile <profile名> add github:KhalilYamber/dsh-session-summarizer

# 本地路径（开发验证）
dsh plugin --profile <profile名> add file:../dsh-session-summarizer
```

> 安装语法已在本机核实（dsh CLI 0.1.0-rc.6）：`dsh plugin` 会把 `--profile` 之外的剩余参数转发给该 profile 目录内的 pnpm，实际等价于 `pnpm add <package>`。若你使用的 dsh CLI 版本不同，以 `dsh plugin --profile <name> --help` 的实际输出为准。

安装后启动 profile，`session_summarize` 工具随插件注册。摘要模型、转录预算等行为可在 `cordis.patch.yml` 的 `config` 中调整（`model`、`transcriptChars`、`recentScanLimit`）。

## 用法

在会话中让模型调用工具 `session_summarize`。

| 参数 | 必填 | 说明 |
|---|---|---|
| `sessionId` | 否 | 要摘要的会话 id；缺省时优先当前会话，再回退最近活跃落盘会话 |
| `lastTurns` | 否 | 只摘要最后 N 轮用户消息；缺省不限制（计数单位为「用户消息」，非 assistant 消息） |

会话内调用示例（文本为占位符）：

> （在会话中输入）请用 session_summarize 汇总当前会话最近 20 轮，帮我恢复上下文。

预期输出 JSON 样例：

```json
{
  "ok": true,
  "summary": "本会话围绕……展开，已确定……，待办包括……（摘要正文，占位符）",
  "sessionId": "sess_xxxxxxxx",
  "source": "current-agent",
  "readPath": "live-sessions",
  "chars": 4821
}
```

输出字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `ok` | boolean | 是否成功 |
| `summary` | string | 摘要正文 |
| `sessionId` | string | 实际摘要的会话 id |
| `source` | string | 会话来源：`explicit` / `current-agent` / `recent-active` / `none` / `error` |
| `readPath` | string | 读取路径：`live-sessions` / `persistence-inspect` / `none` / `error` |
| `chars` | integer | 送入摘要模型的转录字符数（截断后） |
| `message` | string（可选） | 失败时的错误说明 |

## 已知限制与契约说明

### 已知限制

- 转录基于派生消息（live 路径 `Session.deriveMessages()`）或落盘事件日志（persistence-inspect 路径 `inspect()` 的事件流），只保留 user / assistant 文本，不含工具调用内部细节。
- 长会话转录采用「保留首尾、截断中段」策略，默认预算 `transcriptChars: 12000` 字符，超长部分以提示行替代。
- `lastTurns` 按「用户消息数」计数，assistant 消息不占用轮数上限。
- live 会话仓命中时优先走 `deriveMessages`，否则回退落盘 `inspect`；最近活跃会话回退时最多扫描前 `recentScanLimit`（默认 10）个快照。
- 摘要生成依赖 `ctx.llm.stream` 的 `deepseek-official` 路由与默认模型 `deepseek-v4-flash`（可在 `cordis.patch.yml` 的 `config.model` 覆盖）。

### 契约说明

- 版本锁定：本插件按 `@deepseek-ai/*@0.1.0-rc.6` 契约实现；peerDependencies 为 `@deepseek-ai/cordis ^4.0.1`、`@deepseek-ai/dsh-llm ^0.1.0-rc.6`、`@deepseek-ai/dsh-session ^0.1.0-rc.6`。升级依赖前需回归验证会话读取与摘要生成两条路径。
- 安装机制：依赖 `dsh-app-boot` 的 bundle patch 约定，`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，安装后自动进入 profile 的 bundle 层。
- 工具注册：用 `@deepseek-ai/dsh-tools` 的 `defineTool` 声明工具，经注入的 `ctx.tools`（ToolRuntime 注册表）调用 `register` 完成注册。

## License

MIT，见 [LICENSE](LICENSE)。
