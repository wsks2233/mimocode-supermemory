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

### 3. tool `forget` + 更完整 scope — **完成 2026-09-20（API 验收）**

| | |
|--|--|
| **验收结果** | `add` probe → search 命中 → `DELETE /v3/documents/{id}` → search **不再命中** |
| **契约** | forget：search 取 documentId → DELETE documents；同时尝试 v4 memories API（chunk 场景常 Memory not found） |
| **scope** | tool 参数 `scope=user\|project` → 写入 `sm_scope`；search 尽力过滤 |

### 4. Slash 命令 / skill 安装体验 — **完成 2026-09-20**

| | |
|--|--|
| **验收结果** | 安装器双写全局 commands（index/init/login/logout/status）+ skills（含 locales）；VM `install.ps1 -Status`：`commands OK` / `skills OK` / `ready YES`；`mimo debug config` 解析 5 个 command；`mimo debug skill` 列出 5 个 skill；init 同款 API 写入后 search 命中 probe（tag `repo_mimocode-supermemory-test__c3d35c834ba4`） |
| **通道** | `~/.config/mimocode/commands/*.md` + `~/.config/mimocode/skills/<id>/SKILL.md` |
| **备注** | 无头 `mimo run` 仍 PRE-EXISTING `EUNKNOWN`；交互 TUI 打开测试项目后可直接 `/supermemory-*` |

### 5. npm 发布 + `mimo plugin mimocode-supermemory` — **完成 2026-09-20（0.3.1）**

| | |
|--|--|
| **验收结果** | npm **`mimocode-supermemory@0.3.0/0.3.1`** 已发布（`npm view` PASS）；src→esbuild→dist parity PASS；`mimo plugin mimocode-supermemory` VM 输出 `Plugin package ready` / `Installed`；cache `package.json` version **0.3.x**；`install.ps1 -Status` → commands/skills OK · **ready YES** |
| **包名** | 非 scope `mimocode-supermemory`（与 plugin[] / 官方体验一致） |
| **备注** | host JSON **拒 BOM**；0.3.1 修复 `install.ps1` no-BOM 写入。发布前跑 `prepublishOnly`（contract+syntax+parity） |

### 6. Compaction 对齐（宿主 summarize / 被动） — **完成 2026-09-21（被动路径）**

| | |
|--|--|
| **验收结果** | **不做**主动 80%/summarize 触发；`experimental.session.compacting`：注入 project 记忆到 `output.context`；**不**设置 `output.prompt`；将宿主 `sessions/<id>/checkpoint.md` 写回 Supermemory（`sm_capture_mode=compaction` / `[host-checkpoint]`）。配置 `compactionInject` / `compactionWriteback` 默认 true 可关。本机 tsc/contract/parity PASS；VM cache dist 含 host-checkpoint，status ready YES；API 写回路径 search 命中 `VM_HOST_SUM_7C21` |
| **契约** | 宿主 owns summarize timing；插件仅 passive inject + checkpoint write-back |
| **备注** | 无头 hook 探测需 Node；VM 当前无 node → 以 dist 标记 + API 契约验收。见 `docs/compose/spec/compaction-passive.md` |

### 7. 宿主能力依赖项（可能无法在插件侧关闭） — **完成 2026-09-22（插件侧）**

| | |
|--|--|
| **差距** | `permission.ask` 未接线；Desktop UI；file-hook loader |
| **要做的事** | 向上游反馈/跟版；插件侧保持向前兼容 hook；文档写清限制 |
| **验收** | 不因宿主未接线导致插件崩溃；上游支持后无需改业务代码即可 auto-allow `supermemory` tool |
| **验收结果** | `permission.ask` 加固为 tool=supermemory 全 mode allow 且 try/catch 永不抛；`package.json` 声明 `mimo.hooks`；`docs/UPSTREAM.md` 含三份 issue 正文。上游：[MiMo-Code#2472](https://github.com/XiaomiMiMo/MiMo-Code/issues/2472)（permission.ask）、[MiMo-Code#2473](https://github.com/XiaomiMiMo/MiMo-Code/issues/2473)（Desktop UI）已创建；file-hook 沿用 [#1813](https://github.com/XiaomiMiMo/MiMo-Code/issues/1813) 并已补 0.1.14 评论。Desktop **仅上游 issue、插件侧不碰**。见 `docs/compose/spec/host-limits.md`。 |

### 8. 工程化（src 与 dist 对齐 + 测试） — **完成 2026-09-22**

| | |
|--|--|
| **验收结果** | #5 已 src→esbuild→dist + parity；本项 **`npm test`**（node:test）**9/9**：normalizeOrigin、**sha12=`c3d35c834ba4`**、`__local`/path、**确定性 pin**、**无 git→basename-or-path**、keyword、extractHits；`tags` 支持 `fileConfig` 隔离；`prepublishOnly` 含 unit+contract |
| **命令** | `npm test` · `npm run test:contract` · `npm run build:dist` |
| **备注** | 单测用 esbuild 打到 `test/.tmp` 再 `node --test`（gitignore）；无网络 E2E |

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
