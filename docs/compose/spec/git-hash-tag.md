---
feature: git-hash-tag
status: designed
updated: 2026-09-20
branch: main
commits: 
---

# Git-hash containerTag (official parity)

## Report

**What was built** — containerTag 解析顺序：`projectContainerTag` pin → **git origin hash**（`repo_{root-name}__{sha256(normOrigin)[0:12]}`）→ basename `__local` → path hash。tool/capture 写入 `sm_scope`（project/personal）。tool help 返回 `tagSource` + `origin`。

**Verification** — **PASS（VM 2026-09-20）**：去 pin 后 `tag.log` 为  
`repo_mimocode-supermemory-test__c3d35c834ba4` / `source=git-origin` / `origin=github.com/wsks2233/mimocode-supermemory`，与本地 sha256 算法结果一致。无 git 时回退 `__local`（设计如此）。

**Journey log**
1. 官方公式 = name + origin hash，不是路径 hash。
2. pin 优先，保护既有 `__local` 记忆验收。
3. 无 git 主机必须 fallback。
4. sm_scope 与 tag 正交。
5. 验收需去掉 pin + git origin 可解析 + 插件工厂被执行（写 tag.log）。

## Tasks

- [x] T1: dist resolveContainerTag git-origin (covers: S2)
- [x] T2: sm_scope on add/capture (covers: S2)
- [x] T3: VM e2e tag=repo_*__c3d35c834ba4 source=git-origin (covers: S2)
- [x] T4: README 解析顺序说明 (covers: S2)

## [S1] Problem

官方 opencode-supermemory 使用：

```text
repo_{project-name}__{hash(normalized git origin remote)}
+ metadata sm_scope: personal|project
```

我们当前默认 `repo_{basename}__local` 或配置 pin，**同一 git 仓库在不同机器/目录 basename 下会分叉**，也难以与 Claude Code / OpenCode 共记忆。

## [S2] Design

### Tag 解析顺序（非破坏）

1. `supermemory.jsonc` → `projectContainerTag`（显式 pin，测试可用）  
2. **git origin**（若宿主 `$` 可执行 git）：
   - `origin = git -C <dir> remote get-url origin`（规范化：小写、去尾 `/`、`.git`）
   - `name = basename(git root)` 或 `basename(dir)`
   - `tag = repo_{name}__{sha256(origin).slice(0,12)}`  
3. 无 origin / 无 git：`repo_{basename}__local`（现行为）  
4. basename 非法：`repo_path_{hash(fullPath)}__local`

### sm_scope

- tool `add` / capture metadata：`sm_scope: "project"`（默认）  
- 可选 `scope=user` → `sm_scope: "personal"`  
- 与容器 tag 正交：同一 tag 内用 metadata 区分人/项目（与官方一致）

### 兼容

- 已 pin 的 `projectContainerTag` 优先，不打断 amber-bridge 测试  
- 文档说明：与 OpenCode 共记忆时需相同 origin + 相同 name/hash 算法  

### Out of Scope

- 跨 agent 自动迁移旧 `__local` 数据  
- 恢复 git CLI（VM 可装 Git for Windows 后自动生效）

## Tasks

- [ ] T1: dist 异步 resolve origin hash tag — acceptance: 代码含 git origin 与 sha12 逻辑 (covers: S2)
- [ ] T2: sm_scope 写入 metadata — acceptance: add/capture 含 sm_scope (covers: S2)
- [ ] T3: 本地/VM 验证 — acceptance: 有 git origin 时 tag 形如 repo_*__<hash>；无 git 回退 __local (covers: S2)
- [ ] T4: README/supermemory.jsonc 说明 — acceptance: 解析顺序与 pin 文档化 (covers: S2)
