# mimocode-supermemory 差距 Backlog（对照官方 opencode-supermemory）

> 整理日期：2026-09-19 · 仓库：https://github.com/wsks2233/mimocode-supermemory  
> 规则：一次只推进一项；每项含验收标准。完成后再选下一项。

## 已完成（不再列队）

| ID | 项 |
|----|-----|
| — | plugin[] 模块插件通道 |
| — | Browser OAuth login |
| — | session.post 原生 capture + 新会话召回（amber-bridge） |
| — | 一键安装（mimo plugin file: + install.ps1 + cache 包名路径） |
| — | Supermemory API 契约（q / containerTag） |
| — | git-origin containerTag **算法** + sm_scope 代码 |

---

## Backlog（建议顺序）

### 1. Git-hash tag 端到端生效（去掉 pin） — **完成 2026-09-20**

| | |
|--|--|
| **验收结果** | VM 实测 `tag.log`：`tag=repo_mimocode-supermemory-test__c3d35c834ba4 source=git-origin origin=github.com/wsks2233/mimocode-supermemory` |
| **条件** | 去掉 `projectContainerTag` pin；git 可解析 origin（VM 可用 stub 或真 git） |
| **备注** | 与本地算法一致；无 git 时仍回退 `__local` |

### 2. 关键词自动写入记忆 — **完成 2026-09-20**

| | |
|--|--|
| **验收结果** | 用户消息含 `Remember: the staging deploy window is Thursday 22:00 UTC for amber-bridge.` 后：`keyword.log` 有记录；API search `staging deploy window` **total≥2**（含该句，similarity ~0.82） |
| **机制** | `chat.message` 关键词命中 → `POST /v3/documents`，`sm_capture_mode: keyword`，tag=当前 git-origin container |

### 3. tool `forget` + 更完整 scope

| | |
|--|--|
| **差距** | 官方 tool 有 forget、scope；我们仅有 add 时写 sm_scope |
| **要做的事** | tool 增加 `mode=forget`（DELETE /v4/memories 或文档等价接口）；search/list 可按 sm_scope 过滤（若 API 支持） |
| **验收** | add → forget 后 search 不再命中（或标记 forgotten）；help 列出 forget |

### 4. Slash 命令 / skill 安装体验

| | |
|--|--|
| **差距** | 官方 `/supermemory-init`、`/supermemory-login`、`/supermemory-status` |
| **要做的事** | 按 MiMoCode 约定生成 commands/skills；install.ps1 一并写入 |
| **验收** | MiMo 会话中能触发对应命令或 skill 文案；init 可索引当前项目要点写入记忆 |

### 5. npm 发布 + `mimo plugin mimocode-supermemory`

| | |
|--|--|
| **差距** | 无 npm 包；`github:` 需 git；`file:` 运行时解析不稳 |
| **要做的事** | 对齐 src↔dist；`npm publish`（你的 npm 账号）；VM 上 `mimo plugin mimocode-supermemory` 一条命令安装并加载 |
| **验收** | 全新机器仅用 npm/mimo plugin 完成安装，status ready=YES |

### 6. Compaction 对齐（谨慎）

| | |
|--|--|
| **差距** | 官方 80% threshold + summarize 写回记忆；我们只 context.push |
| **要做的事** | 评估是否采用官方抢占式策略；若采用，必须避免 #69/#85 类竞态（阈值可关、不用错误 model limit） |
| **验收** | 大会话压缩后摘要可检索；宿主 compaction 不被破坏；阈值可配置且可真正关闭 |

### 7. 宿主能力依赖项（可能无法在插件侧关闭）

| | |
|--|--|
| **差距** | `permission.ask` 未接线；Desktop UI；file-hook loader |
| **要做的事** | 向上游反馈/跟版；插件侧保持向前兼容 hook；文档写清限制 |
| **验收** | 不因宿主未接线导致插件崩溃；上游支持后无需改业务代码即可 auto-allow search |

### 8. 工程化（src 与 dist 对齐 + 测试）

| | |
|--|--|
| **差距** | canonical 为手维 dist；src 未完全同步；缺自动化测试 |
| **要做的事** | src 实现 PluginModule + 与 dist 同契约；typecheck/build；对 tag 解析/API mock 做最小单测 |
| **验收** | `npm run build` 产出与 VM 所用行为一致的 dist；关键单测通过 |

---

## 依赖关系（简图）

```text
1 git-hash 端到端  ──►  5 npm/官方安装（多项目 tag 才完整）
2 关键词自动写      ──►  3 forget（先有写入再谈删除）
4 slash/skill       ──►  依赖 1/2 的稳定读写
6 compaction        ──►  建议在 2/3 之后，风险最高
7 宿主项            ──  外部，可并行跟进
8 工程化            ──  可与 2/3 并行，利于 5
```

## 推荐单次推进方式

1. 你指定 backlog 编号（如「做 2」）  
2. 我开 compose-next：spec → 实现 → VM 验收 → 本地 commit（默认不 push，除非你说 push）  
3. 更新本文对应项为完成，再选下一项
