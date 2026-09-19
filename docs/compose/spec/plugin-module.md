---
feature: plugin-module
status: designed
updated: 2026-09-19
branch: main
commits: ef0449a..working-tree
---

# mimocode-supermemory plugin[] module

## Report

**What was built** — MiMoCode `plugin[]` 模块插件通道：`dist/index.js` 导出 `PluginModule { id, server: SupermemoryPlugin }`，经 `~/.config/mimocode/mimocode.jsonc` 的 `plugin: ["mimocode-supermemory"]` 加载；宿主解析路径为 `%USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\`。运行时用 `fetch` 调 Supermemory Memory API（`/v4/search` 字段 `q`），提供 `supermemory` tool 与 lifecycle hooks（chat.message / system.transform / compacting / permission.ask）。注入 parts 必须携带 `sessionID` 与以 `msg` 开头的 `messageID`。

**Verification** — VM MiMoCode 0.1.14：日志 `service=plugin path=mimocode-supermemory loading plugin` PASS；`tool.registry ... supermemory` PASS；hooks 注入 `[SUPERMEMORY]` 含真实检索命中 PASS；修复 messageID 后无 invalid part PASS。file hooks 通道 `failed to load file hook`（宿主，非本包）；VM 无 git 导致 session.post ENOENT 为 PRE-EXISTING。

**Journey log**
1. file hooks 在 Windows loader 失败 → 改走与 OpenCode 同构的 plugin[] 模块通道。
2. MiMo 插件包目录不是 `config/node_modules`，而是 `cache/mimocode/packages/<name>@latest/node_modules`。
3. Supermemory search 体字段是 `q` 不是 `query`。
4. chat.message 注入 part 缺 `sessionID`/`messageID` 会被宿主拒绝；`messageID` 须 `msg` 前缀。
5. 以 **`dist/index.js` 为 canonical**；`src/` 在对齐前不要覆盖 dist。

## [S1] Problem

MiMoCode 对齐 OpenCode 的原生插件通道应是 `mimocode.jsonc` 的 `plugin: ["name"]` 加载 **npm/模块插件**。  
实测：VM 上 `.mimocode/hooks/*.ts` 文件钩子加载失败（`Cannot find module '...ts.<ts>.mjs'` / `Bundle failed`），而 `tools/supermemory.ts` 可用。  
因此无法用 file hooks 达到 opencode-supermemory 那种 lifecycle「原生记忆」体验；必须走模块插件路径。  
Supermemory 官方只对 OpenCode 提供 `bunx opencode-supermemory install` + `plugin: ["opencode-supermemory"]`，**没有 MiMo 版**。

## [S2] Design

### 宿主契约（已确认）

- Config：`~/.config/mimocode/mimocode.jsonc` 支持 `"plugin": [string | [string, options]]`
- CLI：`mimo plugin <npm-module> [-g]`
- **解析路径（实测）**：`%USERPROFILE%\.cache\mimocode\packages\<name>@latest\node_modules\package.json`
  （不是 `~/.config/mimocode/node_modules`）
- SDK：`@mimo-ai/plugin@0.1.14`
  - `Plugin = (input: PluginInput, options?) => Promise<Hooks>`
  - `PluginModule = { id?: string; server: Plugin; tui?: never }`

### 包契约

- 包名：`mimocode-supermemory`
- 入口 `dist/index.js`：
  - `export const SupermemoryPlugin`
  - `export default { id: "mimocode-supermemory", server: SupermemoryPlugin }`
- 运行时 **不依赖** npm `supermemory` SDK：`fetch` 调 Memory API
- 鉴权：`SUPERMEMORY_API_KEY` / 可选 `SUPERMEMORY_API_URL`
- search body 字段：**`q`**（不是 `query`）
- containerTag：`repo_{basename(cwd)}__local`

### 行为

| Hook | 行为 |
|------|------|
| `tool.supermemory` | add / search / profile / list / help；结果含 `plugin: mimocode-supermemory` |
| `chat.message` | 首回合 `[SUPERMEMORY]` + recall；part 必须带 `sessionID` 与以 `msg` 开头的 `messageID` |
| `experimental.chat.system.transform` | system prompt 注入记忆块 + recall |
| `experimental.session.compacting` | 仅 `output.context.push` |
| `permission.ask` | tool=supermemory → allow（向前兼容） |

### 安装（VM）

```
%USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\
  package.json          # name/main
  dist\index.js         # PluginModule
  mimocode-supermemory\ # 同构副本（保险）
```

`~/.config/mimocode/mimocode.jsonc`：

```json
{
  "$schema": "https://mimo.xiaomi.com/mimocode/config.json",
  "plugin": ["mimocode-supermemory"]
}
```

## [S3] Out of Scope

- npm 正式发布 / `bunx mimocode-supermemory install`
- Desktop UI 插件面
- 修复 file-hook loader / VM 缺失 git 导致的 session.post ENOENT
- `permission.ask` 宿主接线
- git-origin hash 容器兼容

## Tasks

- [x] T1: 导出 PluginModule 模块入口 — acceptance: `dist/index.js` 含 `default.server` 与 `SupermemoryPlugin` (covers: S2)
- [x] T2: fetch 版 hooks + tool 实现 — acceptance: 无 npm supermemory 依赖；search 使用 `q`；注入 part 带合法 messageID (covers: S2)
- [x] T3: VM 落盘安装 plugin[] — acceptance: cache packages 路径存在包；mimocode.jsonc 含 plugin 数组 (covers: S2)
- [x] T4: VM 端到端验证 — acceptance: 日志 `path=mimocode-supermemory loading plugin`；`tool.registry ... supermemory`；hooks 注入 `[SUPERMEMORY]` 真实记忆；无 `failed to resolve plugin server entry` (covers: S2; depends: T1, T2, T3)
- [x] T5: 文档同步 — acceptance: README 安装节改为 plugin[] 与 cache 路径；containerTag 文档为 `__local`；声明 dist canonical (covers: S2)
