---
feature: readme-rewrite
status: delivered
updated: 2026-09-22
branch: docs/readme-rewrite
commits: ff897b8..(working tree; docs commit pending user request)
---

# README 按实际情况重写

## Report

**What was built** — 按 npm 包页面标准重写 `README.md`：badges + 最短安装（`mimo plugin` / `npx` / `install.ps1`）+ 稳定加载条件 + 鉴权与 Key 顺序 + 能力表（tool 全 mode 含 forget、hooks 含 keyword/session/compaction/permission.ask）+ containerTag 四段解析 + slash/skills + 验收 + Host limits（链 UPSTREAM）+ Configuration（no-BOM）+ 完整 Develop（src→dist、门禁、目录、红线）。去掉原重复的鉴权/开发章节；架构与事实对齐 `src` / AGENTS / package 0.3.1。

**Verification** — `npm run typecheck` PASS · `npm run test:contract` PASS（`SRC_CONTRACT_OK` 10 ts files；`PARITY_OK` dist，tag `repo_readme-rewrite__c3d35c834ba4`）· `npm run verify-syntax` PASS · README 无 `sm_[A-Za-z0-9]{8,}` 密钥。独立评审 **PASS**（A1–A6 met；critical/major 无；minor：spec 收口由本 Finalize 完成、H2 Configuration 为用词、0.3.1 硬编码会随版本老化）。

**Journey log**

1. 主检出大量 “全文件 M” 实为行尾/等行数 diff，与本 README 事实重写无关；改动收在 worktree。
2. `git worktree add` 被工具安全策略拦截 → 用户本机手动建 `.worktrees/readme-rewrite`。
3. WSL 下 worktree 的 Windows `gitdir:` 路径解析失败 → git 操作用 PowerShell。
4. 用户 Grill 选定：链接 worktree + 开发者双栏 + **按 npm 包页标准**重写（结构以 npm 为主、Develop 保留完整双栏）。
5. 全局 AGENTS「默认不 commit」优先于 compose-next 自动提交 → Finalize 只落盘文档，提交等用户明确要求。

## [S1] Problem

现有 `README.md` 与仓库已验收事实脱节，且结构不适合 npm 首屏：

1. **重复章节**：鉴权出现两处、开发命令出现两处。
2. **能力滞后**：架构图缺 `forget` / `session.post` / 关键词自动写 / `permission.ask` / 被动 compaction；`containerTag` 只写了 `repo_{dir}__local`，未写 git-origin 优先。
3. **信息密度不合 npm 包页**：安装路径不唯一、限制与 host 缺口散落、与 AGENTS/BACKLOG 重复的实现细节过多。
4. **读者决策**：用户已选定「按 npm 包页面标准重写」+「开发者双栏」——首屏给安装与能力，开发者章节保留完整 src→dist / contract / 目录职责，去掉重复。

## [S2] Design

### 2.1 已锁定决策（本轮 Grill）

| 轴 | 决策 |
|----|------|
| 工作区 | 链接 worktree `.worktrees/readme-rewrite`，分支 `docs/readme-rewrite`（用户手动创建；主检出仍 main） |
| 读者 | 安装用户为主 + 完整开发者章节（双栏：用户路径不掺实现细节；开发路径完整） |
| 幅度 | 按 **npm 包页面标准** 重排：最短安装 → 能力 → 鉴权 → 限制 → 开发；细节链到 docs |

### 2.2 README 目标结构（唯一交付面 = 重写 `README.md`）

1. **标题 + 一句话 + badges**（npm version / license / Node）
2. **Install（最短路径）** — 推荐顺序：
   - `mimo plugin mimocode-supermemory`
   - `npx mimocode-supermemory install`
   - Windows：`install.ps1`
   - 稳定加载事实：包名 + cache 路径；`file:`/绝对路径运行时易挂；`github:` 需 git
3. **Authenticate** — `install.ps1 -Login` / `npx mimocode-supermemory login`；Key 读取顺序；手动 env
4. **Capabilities** — tool modes 表 + hooks 表（含 containerTag 解析顺序精简版）
5. **Slash commands / skills** — 安装器写入的 5 个 command/skill 名
6. **Verify** — 日志行、`supermemory mode=help`、`install.ps1 -Status`
7. **Host limits** — file hooks 非主路径、`permission.ask` forward-compat 可能 no-op、Desktop 仅上游；链 `docs/UPSTREAM.md`
8. **Configuration** — `supermemory.jsonc` 关键字段（apiKey / autoInject / projectContainerTag / keywordPatterns / compaction*）；**no-BOM**
9. **Develop（开发者双栏）** — `npm ci` / typecheck / build / test:contract / prepublishOnly；src→dist 红线；目录表；链 AGENTS / BACKLOG / specs
10. **License MIT**

### 2.3 事实边界（必须写对）

- 版本对齐 `package.json` **0.3.1**（不手写过期版本语义；badge 可用 npm 范式）。
- tool：`search | profile | add | list | forget | help`；可选 `scope=user|project`、`id`。
- containerTag：`projectContainerTag` pin → git-origin `repo_{name}__{12hex}` → `repo_{dir}__local` → path hash。
- Key：`SUPERMEMORY_API_KEY` → `supermemory.jsonc` `apiKey` → `~/.supermemory-mimocode/credentials.json`。
- 主加载路径：`plugin: ["mimocode-supermemory"]` → cache `...\mimocode-supermemory@latest\node_modules\`（含 `dist/index.js`）。
- 不写未验收的 Desktop 能力；不把 `permission.ask` 写成已生效。
- 不出现密钥形态字符串。

### 2.4 Out of Scope

- 不改 `src/` / `dist/` / 安装脚本行为（纯文档）。
- 不重写 AGENTS.md、BACKLOG、各 feature spec。
- 不 push、不自动 merge 回 main。
- 不为 badge 引入第三方 tracking 徽章服务以外的依赖；badge 仅静态 shields/npm 范式 URL（可离线失败时仍可读正文）。

### 2.5 Acceptance

- [x] A1: `README.md` 无重复鉴权/开发章节；章节顺序符合 2.2。
- [x] A2: 架构/能力描述与 `src` hooks + tool modes + AGENTS 事实一致（含 forget、containerTag 顺序、host limits）。
- [x] A3: 最短安装路径三条（mimo plugin / npx / install.ps1）且注明稳定加载条件。
- [x] A4: 含开发者章节：typecheck、build、test:contract、prepublishOnly、src→dist。
- [x] A5: 链到 `docs/UPSTREAM.md`、`docs/compose/BACKLOG.md`；无 `sm_` 密钥。
- [x] A6: 本 worktree `npm run typecheck`、`npm run test:contract`、`npm run verify-syntax` 仍 PASS（文档-only，门禁不回归）。

## Tasks

- [x] T1: 重写 `README.md` 为 npm 包页结构 + 开发者双栏 — acceptance: A1–A5 在 diff 中可逐条指认 (covers: S2)
- [x] T2: 跑仓库门禁并记录输出 — acceptance: A6 命令均 PASS，Report 写入 Verification (covers: S2; depends: T1)
