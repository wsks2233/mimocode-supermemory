---
feature: compaction-passive
status: delivered
updated: 2026-09-21
branch: main
commits: 300d847..(working-tree #6)
---

# Compaction 被动对齐（backlog #6）

## Report

**What was built** — 采用 **宿主 summarize** 路径：插件 **不** 触发压缩、**不** 替换 `output.prompt`。`experimental.session.compacting` 在有 API key 时：(1) 向 `output.context` 注入 project 记忆（供宿主压缩 prompt 使用）；(2) 若存在宿主落盘 `sessions/<sessionID>/checkpoint.md`，则写回 Supermemory（`[host-checkpoint]` + `sm_capture_mode=compaction`，幂等）。`supermemory.jsonc` 可用 `compactionInject` / `compactionWriteback`（默认 true）关闭对应行为。

**Verification** — `tsc --noEmit` / `check-src-contract` / `build` / `check-dist-parity` / `node --check` **PASS**；dist **无** `output.prompt=` 与 `compactionThreshold`；VM cache 已同步该 dist，`install.ps1 -Status` **ready YES**；以同契约 API 写入 host-checkpoint 风格内容后 search 命中 marker **PASS**。本机 hook 探测无 SUPERMEMORY_API_KEY 时 context 为空（预期 early-return）。VM 无 Node，未在 guest 内直接 import dist 调钩子。

**Journey log**
1. 官方主动 80% 路径风险高（#69/#85）；MiMo 已有 checkpoint/rebuild，插件不应抢所有权。
2. hook-api：`compacting` 仅 `sessionID` + `output.context`；`output.prompt` 会替换宿主压缩 prompt — **禁止赋值**。
3. 「走宿主 summarize」的可操作定义：注入宿主压缩上下文 + 读取宿主 `checkpoint.md` 写回记忆，而不是插件自建 summarize。
4. 无 Node 的 VM 上，验收以 dist 契约标记 + status + API 写回路径为准。

## [S1] Problem

官方 `opencode-supermemory` 在上下文约 80% 时 **主动触发** OpenCode summarize，并把 memories 塞进摘要、再把 session 摘要写回 Supermemory。该路径在宿主侧有竞态前科（#69/#85）。MiMo 已有 checkpoint / rebuild / `compaction.*`，插件不应抢「何时压缩」的所有权。

当前实现：`experimental.session.compacting` 仅 search 一段后 `context.push`；**没有**在压缩时把宿主产出的摘要/检查点有意识写回 Supermemory。

## [S2] Design

### 决策（用户已定）

| 轴 | 选择 |
|----|------|
| 是否主动触发宿主压缩 | **否** |
| 摘要引擎 | **宿主**（MiMo summarize / checkpoint） |
| 插件角色 | 压缩时 **被动注入** project 记忆 + **尽量写回**宿主已有摘要/检查点 |

### 宿主钩子契约（evolve hook-api）

```text
experimental.session.compacting
  input.sessionID: string
  output.context: string[]   // 附加到「压缩 prompt」的上下文
  output.prompt?: string     // 若设置会整体替换默认压缩 prompt —— 禁止设置
```

文档 **未** 提供 summarize 正文回传字段。因此「走宿主 summarize 写回」通过 **读取宿主落盘的 checkpoint** 实现：

```text
%USERPROFILE%\.local\share\mimocode\sessions\<sessionID>\checkpoint.md
# 或 MIMOCODE 数据目录下 sessions/<id>/checkpoint.md
```

### 运行时行为

**`experimental.session.compacting`（被动）**

1. **禁止** 设置 `output.prompt`；**禁止** 调用任何触发宿主压缩的 API。  
2. **注入**：`POST /v4/search`（project 相关 query）→ 把 hits 写入 `output.context`（`[COMPACTION CONTEXT INJECTION]` + 记忆列表 + containerTag）。  
3. **写回**（宿主产物）：  
   - 解析 checkpoint 路径候选（Windows/Unix 数据目录 + `sessionID`）；  
   - 若 `checkpoint.md` 存在且非空 → `POST /v3/documents`，`sm_capture_mode: "compaction"`，`sm_scope: "project"`，content 前缀 `[host-checkpoint]` + 文件摘要（截断）；  
   - 幂等：`compactionSeen` 按 `sessionID + sha12(content)` 去重。  
4. 若无 checkpoint 文件：仅注入，**不**在此钩子里再跑 LLM summarize。  
5. 所有错误吞掉，**不得**阻断宿主压缩。

**`session.post`（已有）** — 继续整段 trajectory capture（`sm_capture_mode: "automatic"`），作为压缩写回失败时的兜底。

**可选配置**（`supermemory.jsonc`）：

| 键 | 默认 | 含义 |
|----|------|------|
| `compactionInject` | `true` | 压缩时是否注入 project memories |
| `compactionWriteback` | `true` | 是否把 checkpoint 写回 Supermemory |

关闭方式：配置布尔为 `false`（可真正关掉对应行为；**不存在**插件侧 80% 抢占逻辑）。

### 明确不实现（Out of 主动路径）

- 不实现 `compactionThreshold` / 80% 占用检测  
- 不调用宿主 summarize / rebuild  
- 不替换 `output.prompt`  
- 不把插件变成 compaction 所有者  

### 验收

1. 代码中 **无** 独立抢占式压缩触发逻辑。  
2. compacting 时：有 API key 则 `output.context` 被填充（日志/单测/VM proof 可选）。  
3. 若 sessions 下存在 checkpoint.md：Supermemory search 能命中 `[host-checkpoint]` / `sm_capture_mode=compaction` 类文档。  
4. `compactionInject`/`compactionWriteback` 为 `false` 时对应行为停止。  
5. 宿主会话不因插件异常中断（钩子无 throw）。  
6. npm 包行为与 dist 一致（build + parity）。

## [S3] Out of Scope

- 官方式主动 80% 压缩  
- 接管 `output.prompt`  
- Desktop UI  
- 宿主 permission.ask 接线（#7）

## Tasks

- [x] T1: spec 落盘 — acceptance: delivered + Report (covers: S2)
- [x] T2: compacting 注入 + checkpoint 写回 + 配置开关 — acceptance: 无 prompt 替换；幂等与错误吞噬 (covers: S2)
- [x] T3: build + contract/parity — acceptance: PASS (covers: S2; depends: T2)
- [x] T4: VM cache 同步 + status ready + API 写回路径 — acceptance: ready YES；search 命中 host-checkpoint marker (covers: S2; depends: T3)
- [x] T5: BACKLOG #6 + commit — acceptance: backlog 与 spec 已更新 (covers: S2; depends: T4)
