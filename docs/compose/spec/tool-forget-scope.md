---
feature: tool-forget-scope
status: designed
updated: 2026-09-20
branch: main
commits: bb1232b..(this commit)
---

# Tool forget + scope (official parity)

## Report

**What was built** — tool 增加 `mode=forget`：按 `id`/`content`/`query` 先 `POST /v4/search` 取 documentId，再 **`DELETE /v3/documents/{id}`**（实测有效）；并尝试 `DELETE /v4/memories` 与 `forget-matching`（后者易超时/对 chunk 文档无效）。`add`/`search`/`help` 暴露 `scope=user|project` 与 `sm_scope`。

**Verification** — VM API：`add` probe `forget-probe-686ec219` → search 命中（similarity 0.93）→ `DELETE /v3/documents/{id}` → 再 search **不再出现该 probe**（PASS）。`DELETE /v4/memories` 对 document chunk 返回 Memory not found；`forget-matching` 曾超时。

**Journey log**
1. tool add 的内容进的是 **documents/chunks**，不是 graph memory 条目。
2. 因此 forget 必须删 **document**，不能只调 memories API。
3. 有效契约：`smRequest("/v3/documents/"+id, undefined, "DELETE")`。
4. scope 以写入 metadata `sm_scope` 为主；检索过滤为尽力而为。

## Tasks

- [x] T1: tool forget（search→documentId→DELETE documents + 尝试 memories API） (covers: S2)
- [x] T2: VM cache 部署 forget 逻辑 (covers: S2)
- [x] T3: add→search→forget→search API 验收 PASS (covers: S2)
- [x] T4: BACKLOG #3 完成标记 (covers: S2)

## [S1] Problem

官方 opencode-supermemory tool 含 `forget` 与 `scope`。我们仅有 add/search/profile/list/help，且 add 可写 `sm_scope` 但检索无法按 scope 说明/过滤。

## [S2] Design

### Tool modes

| mode | 参数 | API |
|------|------|-----|
| forget | `id` 或 `content` 或 `query` | 优先 `DELETE /v4/memories`（containerTag+id 或 containerTag+content）；否则 `POST /v4/memories/forget-matching` `{ containerTag, query, dryRun?: false }` |
| search | `query`, `scope?` | `POST /v4/search` hybrid；结果中按 `sm_scope`/metadata 尽力过滤（API 无字段则原样返回并标注） |
| add | `content`, `scope?` | 不变：`sm_scope: personal\|project` |
| profile / list / help | — | help 列出 forget 与 scope |

### smRequest

- 支持 `method`：POST / DELETE；DELETE body 同 JSON。

### 验收

1. `add` 唯一内容 `forget-probe-{ts}` → search 命中  
2. `forget` 用 content 或 query 后 → search 不再命中（或标记 forgotten）  
3. help JSON 含 `forget`  
4. scope 信息出现在 add 响应与 search 的 tagSource/sm_scope 字段  

### Out of Scope

- 官方全部 forget-matching dryRun UI  
- 跨容器批量删除  

## Tasks

- [ ] T1: dist tool forget + DELETE/forget-mapping (covers: S2)
- [ ] T2: VM 部署双 cache 路径 (covers: S2)
- [ ] T3: add→search→forget→search 验收 (covers: S2)
- [ ] T4: BACKLOG #3 完成 (covers: S2)
