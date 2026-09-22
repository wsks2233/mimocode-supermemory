# AGENTS.md — mimocode-supermemory

MiMoCode / MiMo Desktop 的 Supermemory 记忆插件。对齐官方 [opencode-supermemory](https://github.com/supermemoryai/opencode-supermemory) 的 **plugin[] 模块通道**，不是 MCP-only，也不是 file hooks。

更完整的差距与验收：`docs/compose/BACKLOG.md`、`docs/compose/spec/*.md`。

## 必读约束

1. **运行时产物是 `dist/index.js`；源码真相是 `src/`**（backlog #5 起）。  
   - 宿主实际加载 cache 里那份 `dist`。  
   - 改逻辑：改 `src/` → `npm run build` → `dist/index.js` → 同步安装路径。  
   - 禁止手改 dist 当长期源；`npm run typecheck` 仅 `--noEmit`。  
   - 发布前跑 `npm run prepublishOnly`（src contract + syntax + parity）。

2. **不要把密钥写进仓库**。`sm_...` 只出现在本机 env / `~/.config/mimocode/supermemory.jsonc` / `~/.supermemory-mimocode/credentials.json`。提交前扫 `sm_[A-Za-z0-9]`。

3. **Host 限制（MiMoCode 0.1.14，Windows VM 已实测）** — 详见 `docs/UPSTREAM.md`  
   - `.mimocode/hooks/*.ts`：loader 失败（`Cannot find module ...ts.<ts>.mjs` / `Bundle failed`）→ **主路径是 plugin 模块**。  
   - `permission.ask`：钩子可写并已 **forward-compat allow**（tool=supermemory），但宿主**未接线**前可能无效。  
   - Desktop UI：无插件扩展面 → **只写上游 issue**，插件侧不碰。  
   - `mimo plugin file:...`：安装可能成功，**运行时解析易挂**；稳定加载 = 配置包名 + cache 落盘（见 README）。  
   - `mimo plugin github:...`：需要 PATH 里有 **git**。  
   - 无头 `mimo run` 在 VM 上可能因宿主 `session.post` 缺 git 报 `EUNKNOWN`（**PRE-EXISTING**，与插件无关）。

## 架构（agent 会猜错的点）

```text
plugin: ["mimocode-supermemory"]
  → %USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\
      package.json + dist/index.js
      （宿主也会看 ...\mimocode-supermemory\dist\index.js，两处要一致）

export default { id, server: SupermemoryPlugin }   // PluginModule，不是 bare Plugin
```

**Hooks / tool（dist 内）**

| 能力 | 说明 |
|------|------|
| `tool.supermemory` | modes: `search \| profile \| add \| list \| forget \| help`；可选 `scope=user\|project`、`id` |
| `chat.message` | 首回合 `[SUPERMEMORY]` + recall；关键词自动写；**parts 须带 `sessionID` + 以 `msg` 开头的 `messageID`** |
| `experimental.chat.system.transform` | 系统提示注入同一记忆块 |
| `experimental.session.compacting` | **只** `output.context.push`，不接管宿主 summarize |
| `session.post` | 会话结束自动 capture（`sm_capture_mode: automatic`） |
| `permission.ask` | tool=supermemory **全 mode** allow，try/catch 永不抛（宿主未接线前无效） |

## Supermemory API（写代码时）

| 操作 | 要点 |
|------|------|
| 写入 | `POST /v3/documents`，`taskType: "memory"`，**单数** `containerTag` |
| 检索 | `POST /v4/search`，body 字段是 **`q`**（不是 `query`），`searchMode: "hybrid"` |
| 画像 | `POST /v4/profile` `{ containerTag }` |
| forget | `DELETE /v4/memories` 常对 document/chunk 返回 not found；有效路径是 **search → `documentId` → `DELETE /v3/documents/{id}`** |
| 鉴权 | `Authorization: Bearer $SUPERMEMORY_API_KEY` |
| 网络 | 部分 Windows/VM 上 `fetch` 走 IPv6 会挂：dist 已 `dns.setDefaultResultOrder("ipv4first")`；命令行 curl 用 `-4` |

**containerTag 解析顺序**（`dist/index.js` `resolveContainerTag`）：

1. `supermemory.jsonc` → `projectContainerTag`（显式 pin，测试/隔离用）  
2. **git origin**（规范化后 sha256 前 12 位）→ `repo_{git-root-name}__{hash}`  
3. 目录 basename → `repo_{name}__local`  
4. 名字非法 → `repo_path_{hash}__local`  

例：origin `https://github.com/wsks2233/mimocode-supermemory.git` → hash **`c3d35c834ba4`**。

**Key 读取顺序**：`SUPERMEMORY_API_KEY` env → `supermemory.jsonc` `apiKey` → `~/.supermemory-mimocode/credentials.json`。

## 本机 / VM 路径速查

| 用途 | 路径 |
|------|------|
| 全局 MiMo 配置 | `%USERPROFILE%\.config\mimocode\mimocode.jsonc`（`plugin[]`） |
| 插件同目录配置 | `%USERPROFILE%\.mimocode\mimocode.json`（`mimo plugin` 可能写这里） |
| Supermemory 配置 | `%USERPROFILE%\.config\mimocode\supermemory.jsonc` |
| OAuth 凭证 | `%USERPROFILE%\.supermemory-mimocode\credentials.json` |
| 插件加载 cache | `%USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\...` |
| Slash commands | `%USERPROFILE%\.config\mimocode\commands\supermemory-*.md`（安装器写入） |
| Skills | `%USERPROFILE%\.config\mimocode\skills\supermemory-*` + `mimocode-supermemory`（含 locales） |
| 验收测试项目 | `C:\Users\wsks\mimocode-supermemory-test`（VM；有 git origin 时用 git-hash tag） |
| 插件 proof 日志 | `%USERPROFILE%\sm-hook-proof\`（`tag.log` / `keyword.log`） |

宿主发现验收：`mimo debug config`（command）· `mimo debug skill`（skill）。无头 `mimo run` 在 VM 可能 `EUNKNOWN`（PRE-EXISTING）。

## 安装与验收命令

```powershell
# Windows 零依赖（推荐）：mimo plugin 尝试 + 稳定 cache/plugin[] 落盘
powershell -ExecutionPolicy Bypass -File install.ps1
powershell -ExecutionPolicy Bypass -File install.ps1 -Status
powershell -ExecutionPolicy Bypass -File install.ps1 -Login    # 浏览器 OAuth
powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall
```

```bash
# 有 Node 时
node bin/cli.js install|status|login|uninstall
node --check dist/index.js && node --check bin/cli.js
npm run typecheck          # tsc --noEmit
npm run build              # src → dist
npm run test:contract      # src contract + dist parity
npm view mimocode-supermemory version   # 发布后
mimo plugin mimocode-supermemory        # 发布后官方安装面
```

`tsconfig.json` 为 **noEmit**；产物只经 `scripts/build.mjs`（esbuild）写入 `dist/`。

**验收插件已加载**（MiMo 日志）：

```text
service=plugin path=mimocode-supermemory loading plugin
```

tool 调用示例：`supermemory` + `mode=help|search|add|forget`，JSON 应含 `plugin: "mimocode-supermemory"` 与 `containerTag` / `tagSource`。

## Supermemory OAuth（与官方同构）

- 端点：`https://console.supermemory.ai/auth/connect?callback=http://127.0.0.1:{port}/callback&client=mimocode`
- 本地 callback 收 `apikey=sm_...`（须 `sm_` 前缀）+ 可选 `api_url`
- 写入 credentials.json + 同步 supermemory.jsonc
- `install.ps1 -Login` 用 PowerShell HttpListener；`bin/cli.js login` 用 Node http（VM 无 Node 时只能用 ps1）
- Windows PowerShell 5.1 **无** `RandomNumberGenerator.Fill`，须 `Create().GetBytes()`

## 目录职责

| 路径 | 角色 |
|------|------|
| `src/` | **TypeScript 源码真相**（对齐已验收 dist 契约；无 supermemory SDK） |
| `dist/index.js` | 构建产物 / 宿主加载入口（`npm run build`） |
| `scripts/build.mjs` | esbuild bundle src → dist |
| `scripts/check-src-contract.mjs` / `check-dist-parity.mjs` | 发布前契约与 parity |
| `bin/cli.js` | npx/Node 安装器与 login/status |
| `install.ps1` | Windows 一键安装 / OAuth / status |
| `templates/` | slash commands + skills（安装器写入）+ 通道 B 降级 hooks/tools |
| `docs/compose/spec/` | 各 feature 的验收记录 |
| `docs/compose/BACKLOG.md` | 对照官方 opencode-supermemory 的差距清单与优先级 |
| `research/` | 立项调研（含本机路径痕迹，一般不必在实现时阅读） |

## 设计红线（来自已验收故障）

- 不要重写宿主 compaction 所有权（opencode-supermemory #69/#85 竞态）。  
- synthetic parts **不要**被 keyword/session capture 回灌（提取时跳过 `part.synthetic`）。  
- 注入 parts 必须带合法 `sessionID` / `messageID`（`msg` 前缀），否则宿主 `invalid user part`。  
- 关键词自动写、session capture、tool add 使用**同一** `containerTag`，避免读写分叉。  
- 宿主未接线/未实现的 hook：写 forward-compatible 逻辑并文档化，不要假设已生效。

## Git / 协作

- 远程：`https://github.com/wsks2233/mimocode-supermemory`  
- Commit：`<type>[scope]: <description>`（如 `feat: tool forget via document delete + scope (backlog #3)`）  
- 作者建议使用 GitHub noreply：`wsks2233 <wsks2233@users.noreply.github.com>`  
- 默认**不自动 push**；用户明确要求再推。历史 rewrite 后需要 `push --force-with-lease` 时先说明。  
- 主目录 `F:\代码\mimocode-supermemory` 即工作区；`.worktrees/` 已 gitignore。

## 全局指令

本机另有 MiMo 全局 `AGENTS.md`（`~/.config/mimocode/AGENTS.md`）：默认 WSL 执行 shell、默认中文回复、**勿自动 commit** 等。与仓库冲突时，仓库内已验证的路径/API 事实优先；流程类默认仍遵守全局。
