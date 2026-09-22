# mimocode-supermemory

[![npm version](https://img.shields.io/npm/v/mimocode-supermemory.svg)](https://www.npmjs.com/package/mimocode-supermemory)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

Supermemory 记忆插件 for **MiMoCode / MiMo Desktop** — 对齐官方 [`opencode-supermemory`](https://github.com/supermemoryai/opencode-supermemory) 的 **`plugin[]` 模块通道**（不是 MCP-only，也不是 file hooks）。

```text
plugin: ["mimocode-supermemory"]
  → %USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\
  → dist/index.js  (PluginModule { id, server })
```

---

## Install

**推荐（官方宿主命令，已发布 npm）：**

```bash
mimo plugin mimocode-supermemory
# 或全局
mimo plugin mimocode-supermemory -g
```

**有 Node / npx：**

```bash
npx mimocode-supermemory install
# 仓库内
node bin/cli.js install
```

**Windows 零依赖：**

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
powershell -ExecutionPolicy Bypass -File install.ps1 -Status
```

安装器会：优先尝试 `mimo plugin file:<包目录>`，并**始终**执行已验证的 cache 落盘 + 写入 `"plugin": ["mimocode-supermemory"]` 到 `%USERPROFILE%\.config\mimocode\mimocode.jsonc`（**禁止 UTF-8 BOM**，0.3.1 起 no-BOM）。

### 稳定加载条件（MiMoCode 0.1.14 实测）

| 方式 | 结果 |
|------|------|
| 包名条目 + cache 落盘 | **稳定加载**（主路径） |
| `mimo plugin file:...` / 绝对路径 | 可能安装成功，**运行时解析易挂** |
| `mimo plugin github:user/repo` | 需要 PATH 中有 **git** |

cache 路径：

```text
%USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\
  package.json
  dist/index.js
  mimocode-supermemory/package.json
  mimocode-supermemory/dist/index.js
```

安装器会同步维护以上两份 `package.json` / `dist/index.js`，避免宿主不同解析路径读到不同版本。

重启 MiMoCode / 新 Desktop 会话后，日志应出现：

```text
service=plugin path=mimocode-supermemory loading plugin
```

模板通道 B（降级 / 仅工具可用）见 [`templates/`](./templates)：`.mimocode/tools/`、`.mimocode/hooks/`（**Windows file-hook loader 当前失败，不作为主路径**）、`.mimocode/skills/`。

---

## Authenticate

与官方同协议的 Browser OAuth：

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Login
# 或
npx mimocode-supermemory login
node bin/cli.js login
```

```text
https://console.supermemory.ai/auth/connect?callback=http://127.0.0.1:{port}/callback&client=mimocode
  → 回调 apikey=sm_…
  → 写入 %USERPROFILE%\.supermemory-mimocode\credentials.json
  → 同步 ~/.config/mimocode/supermemory.jsonc 的 apiKey
```

**Key 读取顺序：**

1. `SUPERMEMORY_API_KEY` 环境变量
2. `~/.config/mimocode/supermemory.jsonc` → `apiKey`
3. `~/.supermemory-mimocode/credentials.json`

手动 Key（官方也支持）：

```powershell
[Environment]::SetEnvironmentVariable("SUPERMEMORY_API_KEY", "sm_...", "User")
```

查看状态（不打印完整 Key）：`install.ps1 -Status` 或 `node bin/cli.js status`。

---

## Capabilities

### Tool `supermemory`

| Mode | 参数 | 作用 |
|------|------|------|
| `search` | `query`, `scope?` | 对当前 containerTag 做 hybrid 检索 |
| `profile` | — | 返回当前 containerTag 的画像 |
| `add` | `content`, `scope?` | 写入一条记忆 |
| `list` | `scope?` | 列出最近文档 |
| `forget` | `id` 或 `content` / `query`，`scope?` | 按 id 或匹配内容清理 document / memory |
| `help` | — | 返回契约、`containerTag` 与 `tagSource` |

可选 `scope=user|project`：默认 `project`；`user` 写入 `sm_scope=personal`，`project` 写入 `sm_scope=project`。带 `scope` 的 `search` 会优先过滤对应元数据；`list` 在返回中给出 `sm_scope_filter`。

`forget` 的稳定主路径是 **search → `documentId` → `DELETE /v3/documents/{id}`**；传入 `id` 时也会尝试 memory API，传入 `content` / `query` 时还会调用 forget-matching。

### Hooks（模块插件）

| Hook | 行为 |
|------|------|
| `chat.message` | 每会话首回合注入 `[SUPERMEMORY]`，每回合追加 recall 指令；命中关键词时自动写入（`sm_capture_mode: keyword`） |
| `experimental.chat.system.transform` | 系统提示注入同一记忆块 |
| `experimental.session.compacting` | 被动注入 `output.context`，并可把 host checkpoint 写回；**不**设置 `output.prompt` 或触发 summarize |
| `session.post` | 会话结束自动 capture（`sm_capture_mode: automatic`） |
| `permission.ask` | tool=`supermemory` 全 mode allow（try/catch 永不抛）；**宿主未接线前可能无效** |

### containerTag 解析顺序

1. `supermemory.jsonc` → `projectContainerTag`（显式 pin，测试/隔离用）
2. **git origin**（规范化后 sha256 前 12 位）→ `repo_{git-root-name}__{hash}`
3. 非 git / 无 origin：目录 basename → `repo_{name}__local`
4. basename 非法 → `repo_path_{hash}__local`

关键词自动写、session capture、tool `add` 使用**同一** containerTag。

### 架构（精简）

```text
MiMoCode  plugin: ["mimocode-supermemory"]
        │
        ▼
  PluginModule { id, server }
        ├─ tool.supermemory   search|profile|add|list|forget|help
        ├─ chat.message       recall + keyword capture
        ├─ system.transform   系统提示注入
        ├─ compacting         context.push + checkpoint writeback（被动）
        ├─ session.post       automatic capture
        └─ permission.ask     forward-compat allow
        │
        ▼
  Supermemory HTTP API
    POST /v3/documents · POST /v4/search (field q) · POST /v4/profile
    DELETE /v3/documents/{id}   ← forget 主路径
```

---

## Slash commands & skills

安装器写入全局：

- Commands：`/supermemory-index` · `/supermemory-init` · `/supermemory-login` · `/supermemory-logout` · `/supermemory-status`
- Skills：`mimocode-supermemory`、`supermemory-init`、`supermemory-login`、`supermemory-logout`、`supermemory-status`（含 `locales/`）

验收：`mimo debug config` / `mimo debug skill`；交互 TUI 打开项目后可直接 `/supermemory-*`。

---

## Verify

| 检查 | 期望 |
|------|------|
| 日志 | `service=plugin path=mimocode-supermemory loading plugin` |
| Tool | `supermemory` + `mode=help` JSON 含 `"plugin":"mimocode-supermemory"`、`containerTag` / `tagSource` |
| Status | `install.ps1 -Status` 或 `node bin/cli.js status` → commands OK · skills OK · **ready YES** |
| Proof logs | `%USERPROFILE%\sm-hook-proof\` 下按实际触发出现 `tag.log` / `keyword.log` / `compaction.log` |

---

## Host limits（0.1.14 已知）

| 项 | 状态 |
|----|------|
| `.mimocode/hooks/*.ts` | Windows loader 失败 → **主路径是 plugin 模块** |
| `permission.ask` | 插件侧已写 forward-compat allow；宿主**未接线**前可能 no-op |
| Desktop UI 扩展面 | **无** → 仅上游 issue，插件侧不碰 |
| 无头 `mimo run` | VM 可能 `EUNKNOWN`（缺 git / session.post）— **PRE-EXISTING**，与插件无关 |

上游 issue 与正文：[`docs/UPSTREAM.md`](./docs/UPSTREAM.md)（MiMo-Code #2472 / #2473 / #1813 等）。

---

## Configuration

复制 [`.env.example`](./.env.example)，至少配置 `SUPERMEMORY_API_KEY`。

`%USERPROFILE%\.config\mimocode\supermemory.jsonc` 常用字段：

| 字段 | 说明 |
|------|------|
| `apiKey` | Supermemory key（也可用 env） |
| `baseUrl` | 自托管端点；env 也支持 `SUPERMEMORY_API_URL` / `SUPERMEMORY_BASE_URL` |
| `autoInject` | 默认 `true`；关闭自动注入与 keyword/session capture |
| `projectContainerTag` | 显式 pin container（测试/隔离） |
| `keywordPatterns` | 追加关键词正则 |
| `compactionInject` / `compactionWriteback` | 被动 compaction 开关，默认 `true` |

写入 MiMo JSON 配置时 **禁止 UTF-8 BOM**。

---

## Develop

源码真相是 **`src/`**；宿主加载的是 **`dist/index.js`**（esbuild bundle）。`tsconfig.json` 为 `noEmit`。

```bash
npm ci
npm run typecheck        # tsc --noEmit
npm run build            # src → dist
npm run test:contract    # src contract + dist parity
npm run verify-syntax    # node --check dist + bin
npm run prepublishOnly   # 发布门禁
```

改逻辑：改 `src/` → `npm run build` → 同步 cache 安装路径。**禁止**手改 `dist/` 当长期源。

### 目录

| 路径 | 角色 |
|------|------|
| `src/` | TypeScript 源码（无 supermemory SDK） |
| `dist/index.js` | 构建产物 / 宿主加载入口 |
| `scripts/` | build · src-contract · dist-parity |
| `bin/cli.js` | npx/Node 安装器与 login/status |
| `install.ps1` | Windows 一键安装 / OAuth / status |
| `templates/` | slash commands + skills + 通道 B 降级 |
| `docs/compose/spec/` | 各 feature 验收记录 |
| `docs/compose/BACKLOG.md` | 对照官方差距清单 |
| `docs/UPSTREAM.md` | 宿主缺口 issue 正文 |
| `research/` | 立项调研（一般不必在实现时阅读） |

### 设计红线（摘要）

1. 不重写宿主 compaction 所有权（仅 passive inject + checkpoint writeback）
2. synthetic parts 不得被 keyword/session capture 回灌
3. 注入 parts 必须带合法 `sessionID` / `messageID`（`msg` 前缀）
4. 自动捕获/写回失败不得阻断宿主；未接线 hook 写 forward-compat，不假设已生效

详细约束见 [`AGENTS.md`](./AGENTS.md) 与 [`docs/compose/BACKLOG.md`](./docs/compose/BACKLOG.md)。

宿主类型来自 peerDependency `@mimo-ai/plugin`（`>=0.1.0`，可选）。

---

## License

MIT
