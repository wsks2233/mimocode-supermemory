---
feature: mimo-plugin-install
status: designed
updated: 2026-09-19
branch: main
commits: 
---

# P1 mimo plugin / npm install channel

## Report

**What was built** — P1 探测并接入官方 `mimo plugin` 安装通道。VM 实测：`mimo plugin file:<pkg>` / 绝对路径 **安装成功**（`Plugin package ready` / `Plugin config updated`，写入 `~\.mimocode\mimocode.json`）；`github:user/repo` 因 **无 git** 失败；`file:` 条目在 0.1.14 **运行时解析失败**（cache 下 `node_modules\file:...` ENOENT）。稳定加载仍是 **包名** `mimocode-supermemory` + `cache\...\mimocode-supermemory@latest\node_modules`。`install.ps1` 现在：先调 `mimo plugin file:...`（对齐官方命令面），再强制 cache+包名配置并清理无效 `file:` 项。

**Verification** — 日志 `path=mimocode-supermemory loading plugin` PASS；`status ready=YES`；`mimo plugin file:...` 安装输出 PASS；`github:` → `No git binary found`。

**Journey log**
1. `mimo plugin` 是官方安装面，优先接入。
2. 宿主 cache 里 npm 名与 `file:` 名布局不同。
3. 0.1.14 的 `file:` 运行时 resolver 有 bug → 包名路径作生产加载路径。
4. 无 git 则无法 `github:` 安装。

## Tasks

- [x] T1: 探测 VM `mimo plugin` — acceptance: file: 安装成功；github: 缺 git 失败 (covers: S2)
- [x] T2: 包结构 bin+dist+exports — acceptance: 可被 mimo plugin 识别为 server target (covers: S2)
- [x] T3: 安装器双通道 — acceptance: install.ps1 调 mimo plugin + 稳定 cache/包名配置 (covers: S2)
- [x] T4: README 官方命令 + 实测限制 — acceptance: 已更新 (covers: S2)

## [S1] Problem

官方 OpenCode 体验是 `bunx opencode-supermemory@latest install` + 配置 `plugin: ["name"]`。  
MiMoCode 有 `mimo plugin <module>`，但本包未验证：npm 解析路径、GitHub 安装、本地包安装、与手写 cache 落盘的关系。

## [S2] Design

### 目标命令面

```bash
# 发布 npm 后
mimo plugin mimocode-supermemory
mimo plugin mimocode-supermemory -g

# 未发 npm 时的等价路径（需实测宿主是否支持）
mimo plugin github:wsks2233/mimocode-supermemory
mimo plugin file:./mimocode-supermemory
npx github:wsks2233/mimocode-supermemory install
```

### 包契约（供 npm / mimo plugin）

- `name`: `mimocode-supermemory`
- `main`/`exports`: `./dist/index.js`
- `bin.mimocode-supermemory`: `./bin/cli.js`
- `files`: dist, bin, install.ps1, templates, README, LICENSE
- default export: `{ id, server: SupermemoryPlugin }`
- peer: `@mimo-ai/plugin`

### 期望宿主行为（待验证）

| 命令 | 期望 |
|------|------|
| `mimo plugin <npm-name>` | 下载包 → 写 cache packages → 更新 mimocode.jsonc plugin[] |
| `mimo plugin <github:path>` | 同上（若支持） |
| 手写 cache + plugin[] | 已验证可用（fallback） |

### 验收

1. VM 上 `mimo plugin --help` 与实际 install 输出可解析  
2. 至少一条「非手工拷贝」路径成功：mimo plugin 或 npx/cli install 落盘  
3. status ready=YES；`supermemory` tool 可用  
4. 文档写清：npm 未发布时的 GitHub/本地安装步骤  

## [S3] Out of Scope

- 正式 npm publish（需用户账号/token）
- Desktop 图形市场
- file-hook 通道

## Tasks

- [ ] T1: 探测 VM `mimo plugin` 真实安装行为 — acceptance: 记录命令、路径、错误 (covers: S2)
- [ ] T2: 包结构满足 plugin/npx 安装 — acceptance: bin+dist+exports 完整 (covers: S2)
- [ ] T3: 一键安装路径打通 — acceptance: mimo plugin 或 cli install 非手工 cache 成功 (covers: S2; depends: T1,T2)
- [ ] T4: README 更新安装节 — acceptance: 官方式命令 + fallback (covers: S2)
