---
feature: native-memory-verify
status: designed
updated: 2026-09-19
branch: main
commits: 
---

# Native memory verify (non-imperative) on MiMoCode VM

## Report

## [S1] Problem

需要验证：MiMoCode 在**原生会话**（不出现 supermemory/memory/工具指令）中陈述无争议事实后，记忆是否会**自动上传**，以及**新开会话**能否通过注入/recall **获取相关记忆**。

## [S2] Design

### 验收协议（非指令式）

**会话 A（写入侧，自然陈述）**

- 工作目录：`C:\Users\wsks\mimocode-supermemory-test`
- 提示词仅陈述事实，**禁止**出现 supermemory / 记忆 / tool / add 等词
- 建议事实（无争议）：
  1. 工作区内部代号：`amber-bridge`
  2. 新模块默认使用 TypeScript strict
  3. 评审会议固定在每周三
- 期望：agent 正常回复；宿主插件在 `session.post` / lifecycle 将 assistant 内容（或整段对话摘要）写入 Supermemory

**侧信道（API）**

- `POST /v4/search` `q=amber-bridge` / `q=TypeScript strict`，`containerTag=repo_mimocode-supermemory-test__local`
- 期望：命中含上述事实的条目 → **上传成功**

**会话 B（读取侧，新会话）**

- 同一目录、**新 session**
- 提示词：`What is the internal code name for this workspace?`（或中文等价），不提 memory
- 期望：回复含 `amber-bridge`（来自注入或模型自发调用 search 后的结果）
- 对照：hooks 首回合应注入 `[SUPERMEMORY]`（日志或模型复述）

### 实现契约（补齐原生上传）

`dist/index.js` 增加 lifecycle capture：

- `session.post`：若配置了 apiKey 且 `autoInject`，将本会话 assistant 文本摘要 `POST /v3/documents`，`containerTag` 同 tool，`taskType: memory`，metadata `sm_capture_mode: automatic`
- 幂等：`mimocode-supermemory:capture:{sessionID}:{turnIndex}` 去重
- 失败静默（不阻断宿主）；不打印完整 Key
- **不**在提示词中要求模型调用 tool

### Out of Scope

- Desktop UI 深度集成
- 与 file hooks 通道对比
- npm 发布

## Tasks

- [x] T1: dist 增加 session.post 自动 capture (covers: S2)
- [x] T2: VM cache 插件已更新（含 session.post） (covers: S2)
- [x] T3: 会话 A 原生写入，提示词无 supermemory/记忆字样 (covers: S2)
- [x] T4: API search `amber-bridge` 命中自动 capture 的会话内容 (covers: S2)
- [ ] T5: 会话 B 模型口述召回 — 无头 `mimo run` EUNKNOWN（宿主 git，PRE-EXISTING）；建议 Desktop/TUI 补测 (covers: S2)

## Report

**What was built** — `session.post` lifecycle capture + IPv4-first fetch。

**Verification** — API 命中：`User: "Note for this workspace: internal code name is amber-bridge..." Assistant: OK`。上传 PASS；会话 B 无头未取得模型 stdout。

**Journey log** — 见下文设计节；关键：原生上传不依赖指令式 tool；IPv6 需 ipv4first；无头 mimo 受宿主限制。
