---
feature: elegant-install
status: designed
updated: 2026-09-19
branch: main
commits: ef0449a..working-tree
---

# Elegant install (OpenCode parity)

## Report

**What was built** — 对齐官方 `bunx opencode-supermemory install` 的一键安装体验：`npx mimocode-supermemory install`（Node/Bun）与 **`install.ps1`**（Windows 零依赖）。安装器把 `package.json`+`dist/index.js` 放到 MiMoCode 解析路径 `~/.cache/mimocode/packages/mimocode-supermemory@latest/node_modules/`，合并写入 `mimocode.jsonc` 的 `plugin: ["mimocode-supermemory"]`，并生成 `supermemory.jsonc` 配置模板；提供 `status` / `login` / `uninstall`。插件运行时读取 env 与 `supermemory.jsonc`。

**Verification** — VM `install.ps1`：package/dist/plugin[]/API key 全 OK，`ready: YES`。其后 `mimo run` 日志仍为 `service=plugin path=mimocode-supermemory loading plugin`（PRE-EXISTING：VM 无 git 导致 session.post ENOENT）。

**Journey log**
1. 官方优雅点在 CLI：install/status/login，而非手动拷 cache。
2. MiMo 解析目录是 `cache/mimocode/packages/<name>@latest/node_modules`，安装器按此落盘。
3. Windows PowerShell `$HOME` 只读，安装器须用 `$env:USERPROFILE` / `GetFolderPath`。
4. 测试 VM 无 Node → `install.ps1` 是与官方等价的主安装路径。

## [S1] Problem

官方 OpenCode 体验是一条命令完成安装：

```bash
bunx opencode-supermemory@latest install
# → 写 ~/.config/opencode/opencode.jsonc  plugin: ["opencode-supermemory"]
# → 可选 login / status
```

MiMo 侧目前要手动：拷 cache 包路径 + 改 `mimocode.jsonc` + 配 env，不够「像官方」。  
目标：提供同等优雅的一键安装，且在 **无 Node 的 Windows 主机**（如测试 VM）也能用。

## [S2] Design

### 对齐官方的用户命令

| 官方 OpenCode | 本项目 MiMo |
|---------------|-------------|
| `bunx opencode-supermemory@latest install` | `npx mimocode-supermemory install`（有 Node/Bun 时） |
| （Windows 无 node） | **`powershell -File install.ps1`** 或 `irm .../install.ps1 \| iex`（发布后） |
| `bunx ... login` | `mimocode-supermemory login` / `install.ps1 -Login` |
| `bunx ... status` | `mimocode-supermemory status` / `install.ps1 -Status` |
| 配置 `~/.config/opencode/opencode.jsonc` | `~/.config/mimocode/mimocode.jsonc` |
| 记忆配置 `supermemory.jsonc` | `~/.config/mimocode/supermemory.jsonc` |

### 安装器行为（幂等）

1. **放置插件包**到宿主解析路径：

```text
%USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\
  package.json
  dist/index.js
```

2. **合并配置** `~/.config/mimocode/mimocode.jsonc`：
   - 保留已有键（`$schema`、`mcp` 等）
   - `plugin` 数组去重加入 `"mimocode-supermemory"`
   - 尽量保持 JSONC 可读（无注释则整文件重写为 pretty JSON）
3. **记忆配置**（可选）`~/.config/mimocode/supermemory.jsonc`：

```jsonc
{
  "apiKey": "",              // 或用 SUPERMEMORY_API_KEY
  "baseUrl": "",             // 可选 self-host
  "autoInject": true,
  "maxMemories": 5,
  "maxProjectMemories": 10,
  "similarityThreshold": 0.6
}
```

4. **Status** 打印：包路径是否存在、config 是否含 plugin、Key 是否可见、cache 文件摘要
5. **Uninstall**：从 plugin 数组移除；可选删除 cache 包目录

### 运行时

`dist/index.js` 在读 env 之后覆盖读取 `supermemory.jsonc`（文件优先于部分默认值；apiKey 仍优先 env，避免把密钥写进聊天/仓库）。

### 分发

| 形态 | 命令 | 依赖 |
|------|------|------|
| npm/npx（发布后） | `npx mimocode-supermemory@latest install` | Node/Bun |
| Git npx（未发 npm） | `npx github:wsks2233/mimocode-supermemory install` | Node/Bun + 网络 |
| 仓库内 CLI | `node bin/cli.js install` | Node |
| **Windows 零依赖** | `powershell -ExecutionPolicy Bypass -File install.ps1` | 仅 PowerShell |

`package.json`：`bin.mimocode-supermemory = ./bin/cli.js`，`files` 含 `bin/`、`install.ps1`、`dist/`。

## [S3] Out of Scope

- npm 正式发版与账号登录 Supermemory 浏览器 OAuth
- Desktop 图形安装向导
- 自动安装 Git for Windows
- 与官方 OpenCode cache 路径混用

## Tasks

- [x] T1: bin/cli.js install|status|login|uninstall — acceptance: 有 node 时 `node bin/cli.js install` 写 cache + plugin[] (covers: S2)
- [x] T2: install.ps1 零依赖安装 — acceptance: VM 上 PowerShell 完成包落盘 + config 合并 + status ready=YES (covers: S2)
- [x] T3: dist 读取 supermemory.jsonc — acceptance: 插件读 env 与 `~/.config/mimocode/supermemory.jsonc`（apiKey/baseUrl/autoInject）(covers: S2)
- [x] T4: README 官方风格安装节 — acceptance: npx / install.ps1 / status 说明 (covers: S2)
- [x] T5: VM 端到端 — acceptance: install.ps1 后 status ready=YES；mimo 日志 `loading plugin` (covers: S2; depends: T1, T2)
