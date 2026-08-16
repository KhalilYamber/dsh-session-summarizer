# Changelog

本文件记录 dsh-session-summarizer 的版本变更。

## 版本策略

- 遵循 SemVer（语义化版本）。
- 契约锁定期间（`@deepseek-ai/*@0.1.0-rc.6`），对任何 DSH 依赖的升级都需先回归验证会话读取与摘要生成两条路径；破坏性契约变更将反映在次版本号或主版本号上。

## [0.1.0] - 2026-08-16

### 新增

- 首个发布版本：以 DSH 生态原生 Cordis 插件形态注册模型可见工具 `session_summarize`。
- 读取指定 / 当前 / 最近活跃会话并生成中文上下文摘要。
- 双路径读取：live 会话仓（`ctx.sessions` + `deriveMessages`）与落盘持久化（`sessionPersistence.inspect`）。
- 长会话转录截断策略（保留首尾、截断中段，默认 12000 字符预算）。
- `lastTurns` 参数：只摘要最后 N 轮用户消息。
