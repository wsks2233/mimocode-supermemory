---
feature: keyword-auto-capture
status: designed
updated: 2026-09-20
branch: main
commits: 
---

# Keyword auto-capture (official parity)

## Report

**What was built** — `chat.message` 检测官方同款关键词（remember/memorize/save this/中文「记住」等），提取内容后 `POST /v3/documents`（`sm_capture_mode: keyword`），写入当前 containerTag；proof 日志 `sm-hook-proof/keyword.log`。

**Verification** — VM：用户消息 `Remember: the staging deploy window is Thursday 22:00 UTC for amber-bridge.` 后，`keyword.log` 出现该内容，tag=`repo_mimocode-supermemory-test__c3d35c834ba4`（git-origin）。插件日志 `loading plugin` 无 build error。

**Journey log**
1. 文件 hook 路径不可用，关键词捕获挂在 module plugin 的 `chat.message`。
2. 嵌套 cache 包损坏会导致 `3 errors building`——两处 `node_modules/**/dist` 必须同步同一合法文件。
3. 内置 MiMo `memory` 工具可能抢答，与 Supermemory 无关。
4. 宿主 `session.post` 缺 git 时可能拖垮无头 CLI（PRE-EXISTING）。

## Tasks

- [x] T1: keyword 匹配/提取/写入 (covers: S2)
- [x] T2: VM cache 双路径部署 (covers: S2)
- [x] T3: keyword.log + git-origin tag 证据 (covers: S2)
- [x] T4: BACKLOG 标记完成 (covers: S2)

## [S1] Problem

官方 opencode-supermemory 在会话中检测 remember / “save this” / “don’t forget” 等关键词后**自动写入**记忆，无需用户调用 supermemory tool。我们此前只有 `session.post` 整段 capture 与显式 tool add。

## [S2] Design

### 关键词（默认，对齐官方语义）

```text
remember, memorize, save this, note this, keep in mind,
don't forget / do not forget, learn this, store this,
record this, make a note, take note, jot down,
commit to memory, remember that, never forget, always remember
```

可用 `supermemory.jsonc` → `keywordPatterns: string[]` 追加（非法正则忽略）。

### 触发

- Hook：`chat.message`（及可选从 session 文本中扫用户 turn）
- 匹配对象：**用户消息**全文（大小写不敏感）
- 命中后提取“值得记的内容”：
  1. `remember(/|:|：|that)?` 之后到句末/换行  
  2. 否则整条用户消息  
  3. 去掉过短噪声（< 8 字符则仍可写入整句，避免误吞）

### 写入

```text
POST /v3/documents
content: extracted
containerTag: <resolveContainerTag>
taskType: memory
sm_capture_mode: keyword
sm_scope: project
project: <projectName>
```

- 幂等：`sha256(sessionID + content)`，重复不写  
- 失败静默；写 `sm-hook-proof/keyword.log` 便于验收  
- **不**在提示词中要求模型调用 tool  

### Out of Scope

- 多语言关键词完整表（先英文官方表 + 少量中文：「记住」「记一下」「别忘了」）
- 关键词触发 forget

## Tasks

- [ ] T1: dist 关键词匹配 + 提取 + 写入 — acceptance: 代码含 keywordPatterns 与 sm_capture_mode: keyword (covers: S2)
- [ ] T2: VM 部署 — acceptance: cache dist 更新 (covers: S2)
- [ ] T3: 非指令关键词会话 — acceptance: 用户消息含 remember… 后 API 可检索 (covers: S2)
- [ ] T4: BACKLOG 标记完成 — acceptance: docs/compose/BACKLOG.md #2 勾选 (covers: S2)
