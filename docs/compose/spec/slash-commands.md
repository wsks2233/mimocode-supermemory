---
feature: slash-commands
status: delivered
updated: 2026-09-20
branch: main
commits: e2f0e07..working-tree
---

# Slash / Skill 安装体验（backlog #4）

## Report

**What was built** — 安装器在 plugin[]/cache 之外，按 MiMoCode 约定双写官方对齐的 slash 体验：全局 `~/.config/mimocode/commands/` 五条命令（`supermemory-index` / `init` 别名 / `login` / `logout` / `status`）与 `~/.config/mimocode/skills/` 五套 skill（含 Desktop `locales`）。Init/Index 提示词对齐官方深度研究，工具契约改为本插件 `supermemory`（`mode=add/search/list/profile/forget`，`scope`，content 前缀分类，无 `type`）。`install.ps1` 与 `bin/cli.js` 均支持 install/status/uninstall 的 slash 资产；模板 token `{{PS1}}`/`{{CLI}}`/`{{PKG}}` 在安装时替换为 cache 内绝对路径；status 单独显示 commands/skills OK，ready 仍按 package+plugin[]+key。

**Verification** — 本机：`node --check` dist/cli PASS；`scripts/validate-slash-templates.py` TEMPLATES_OK。VM（`install.ps1`，`SUPERMEMORY_SKIP_MIMO_PLUGIN=1`）：commands=5、skills=5；`-Status` → commands OK、skills OK、ready YES。宿主发现：`mimo debug config` 解析 5 个 `supermemory-*` command（路径已展开）；`mimo debug skill` 列出 5 个 skill。Init 写入路径：向 `repo_mimocode-supermemory-test__c3d35c834ba4` 以 init 同款 content `POST /v3/documents` 后，`POST /v4/search` 命中 `slash-init-probe-*` chunk（PASS）。无头 `mimo run` 仍 `EUNKNOWN: unknown error, read` — **PRE-EXISTING**（VM 宿主 session/git），非本改动引入。独立 review：PASS，无 critical。

**Journey log**
1. 无头 SSH 传包用 Chinese 路径易坏：改 VMware 共享 `F:\虚拟机共享文件夹` → VM `\\vmware-host\Shared Folders\<share>\sm-slash-pkg` 再拷本地。
2. PS 5.1 + `$ErrorActionPreference=Stop` 下 `mimo plugin file:` 会 NativeCommandError/挂死：安装须可跳过或超时非致命。
3. cmd 调用 `git.cmd` 必须 `call`，否则批处理在第一跳就结束。
4. 宿主 slash/skill 发现用 `mimo debug config|skill` 验收即可，不必强依赖可交互 TUI。
5. Logout 模板勿把裸 `install.ps1` 写成可执行步骤（无 `-Logout`，会重装）。

## [S1] Problem

官方 [opencode-supermemory](https://github.com/supermemoryai/opencode-supermemory) 的 `install` 除了写 `plugin[]`，还会在 `~/.config/opencode/commands/` 落盘：

- `/supermemory-index`（主命令，深度索引代码库）
- `/supermemory-init`（与 index 同文案别名）
- `/supermemory-login`
- `/supermemory-logout`
- `/supermemory-status`

MiMoCode 当前安装器只装 plugin 模块 + `supermemory.jsonc`，会话里没有对应的 slash 命令 / skill 文案，体验落后官方一截。

MiMo 官方约定（已核实）：

| 通道 | 路径 | 触发 |
|------|------|------|
| 自定义 slash command | 全局 `~/.config/mimocode/commands/<name>.md`；项目 `.mimocode/commands/<name>.md` | `/name`，文件名=命令名 |
| Skill | 全局 `~/.config/mimocode/skills/<id>/SKILL.md`；项目 `.mimocode/skills/**/SKILL.md` | `/skill-name` 或 agent `skill` 工具；Desktop Plugins 页读 `locales/*.json` |

同名时 **command 覆盖 skill**（skill 不会覆盖已有 command）。

## [S2] Design

### 决策（本 spec 已定）

1. **交付通道**：Commands + Skills **双写**（主通道=全局 commands，对齐官方；skills 供 Desktop / agent 自动匹配）。
2. **命令集合**：完整官方 5 个（index / init 别名 / login / logout / status）。
3. **Init 深度**：对齐官方「深度研究索引」流程；工具契约改用本插件 `supermemory` tool。

### 安装产物

**Commands**（全局，installer 写入）：

```text
%USERPROFILE%\.config\mimocode\commands\
  supermemory-index.md
  supermemory-init.md      # 与 index 同 body
  supermemory-login.md
  supermemory-logout.md
  supermemory-status.md
```

**Skills**（全局 + Desktop locales）：

```text
%USERPROFILE%\.config\mimocode\skills\
  supermemory-init/SKILL.md + locales/{zh-CN,en-US}.json
  supermemory-login/SKILL.md + locales/...
  supermemory-logout/SKILL.md + locales/...
  supermemory-status/SKILL.md + locales/...
  mimocode-supermemory/SKILL.md + locales/...   # 总览 skill（更新 forget/scope 与命令表）
```

**仓库模板源**：

```text
templates/commands/*.md
templates/skills/<id>/SKILL.md
templates/skills/<id>/locales/{zh-CN,en-US}.json
```

### Command 文件契约

Frontmatter（MiMo）：

```markdown
---
description: <一句话，TUI 列表显示>
agent: build
---
```

Body = 提示词模板。占位符由安装器替换：

| Token | 替换为 |
|-------|--------|
| `{{PS1}}` | 安装后的 `install.ps1` 绝对路径（含 cache 内副本） |
| `{{CLI}}` | 安装后的 `bin/cli.js` 绝对路径 |
| `{{PKG}}` | `mimocode-supermemory` |

**Init/Index body（要点）**——移植官方深度索引，但写路径必须用本插件 tool：

```text
supermemory(mode: "add", content: "...", scope: "project"|"user")
supermemory(mode: "list", scope: "project")
supermemory(mode: "search", query: "...", scope: "project")
```

- 无 `type` 参数；分类写在 content 前缀（如 `[architecture] ...`、`[project-config] ...`）。
- 先 `list` 查已有记忆，再增量 add。
- 覆盖：技术栈、目录结构、构建/测试命令、约定、已知坑、贡献者节奏（git 有则做）。
- 禁止写入密钥 / `<private>` 类敏感内容。

**Login / Logout / Status body**——指示 agent 执行安装器命令并汇报（不打印完整 API key）：

```powershell
powershell -ExecutionPolicy Bypass -File "{{PS1}}" -Login
powershell -ExecutionPolicy Bypass -File "{{PS1}}" -Status
# Uninstall credentials: 删除 credentials.json 或 cli logout（有 Node 时）
```

无 Node 的 Windows 主机以 `install.ps1` 为准（与现有 elegant-install 一致）。

### Skill 契约

- 目录名 = frontmatter `name` = 稳定 ID（`supermemory-init` 等，仅字母数字连字符）。
- `description` 含 WHAT + WHEN + 字面触发词（`/supermemory-init`、index this codebase 等）。
- Body 简短：说明该入口做什么、调用哪条 command 文案或 CLI、指向 `supermemory` tool 模式表。
- `locales/zh-CN.json` / `locales/en-US.json`：仅 `displayName` + `brief`；不翻译 `name`/`description`。
- 总览 skill `mimocode-supermemory` 更新：modes 含 `forget`/`scope`；列出 5 个 slash 入口。

### 安装器行为

`install.ps1` / `bin/cli.js` `install` 在现有 cache + plugin[] 之外 **幂等**：

1. 将 `install.ps1`、`bin/cli.js`、`templates/**` 复制到 cache 包根（与 `dist/index.js` 同级），保证 command 里的路径可执行。
2. 从 `templates/commands` 复制并替换 `{{PS1}}`/`{{CLI}}`/`{{PKG}}` → `~/.config/mimocode/commands/`。
3. 从 `templates/skills` 复制整目录（含 locales）→ `~/.config/mimocode/skills/`。
4. `status` 增加：`commands` OK/MISSING（计数或五文件）、`skills` OK/MISSING。
5. `uninstall` 删除本包安装的 5 个 command 文件 + 5 个 skill 目录（保留用户自定义同名文件以外的其他 skill；同名由我们覆盖安装的则删除）。

### 验收路径

| 步骤 | 期望 |
|------|------|
| VM `install.ps1` | cache 含 install.ps1/bin/templates；commands 5 个文件存在；skills 5 个目录 + locales |
| `install.ps1 -Status` | package/dist/plugin/key ready=YES；commands=OK；skills=OK |
| 会话触发 | TUI `/supermemory-status` 等可出现在 slash 列表（文件名）；skill 在 `/` 或 skill 列表可见 |
| Init 索引 | 在测试项目按 init/skill 文案执行后，Supermemory API search 能命中项目要点（架构/命令等） |
| 密钥 | 任何 command/skill/status 输出不得打印完整 `sm_` key |

## [S3] Out of Scope

- npm 发布与 `mimo plugin mimocode-supermemory`（backlog #5）
- 宿主 `command` JSON schema 动态注入（我们用文件通道，不改宿主）
- 项目级 `.mimocode/commands` 强制安装（全局足够；测试项目可选）
- Desktop 图形侧一键按钮
- 修改 `dist/index.js` 记忆逻辑（本项只动安装体验与文案；init 通过现有 tool 写入）

## Tasks

- [x] T1: 设计并落盘 `docs/compose/spec/slash-commands.md` — acceptance: status 可 delivered，S1–S3 与 tasks 覆盖验收 (covers: S2)
- [x] T2: `templates/commands` 5 个官方对齐 md + `templates/skills` 5 套（含 locales）+ 更新总览 skill — acceptance: 文件齐全，frontmatter name/description 合法，command 含 `{{PS1}}` 占位 (covers: S2)
- [x] T3: `install.ps1` / `bin/cli.js` 扩展 install/status/uninstall — acceptance: 本机 `node --check`；逻辑含 templates 复制、token 替换、commands/skills 写入与卸载 (covers: S2)
- [x] T4: VM 部署与文件验收 — acceptance: install 后 commands/skills 路径存在且 status 显示 OK；无密钥落盘到仓库 (covers: S2; depends: T2, T3)
- [x] T5: Init 验收 — acceptance: 宿主发现 command/skill；init 同款 API 写入后 search 命中项目要点/probe (covers: S2; depends: T4)
- [x] T6: BACKLOG #4 标完成 + 本地 commit（默认不 push）— acceptance: BACKLOG 有验收结果；git log 含 backlog #4 commit (covers: S2; depends: T4, T5)
