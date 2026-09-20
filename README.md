# mimocode-supermemory

给 **MiMoCode / MiMo Desktop** 提供接近原生的 Supermemory 记忆插件能力。

以开源 [`opencode-supermemory`](https://github.com/supermemoryai/opencode-supermemory) 为参考实现（MIT），改接到 MiMoCode 的 [`@mimo-ai/plugin`](https://github.com/XiaomiMiMo/MiMo-Code) 宿主 API：同构 `Plugin → Hooks`，配置与落盘路径对齐 `.mimocode` / `~/.config/mimocode`。

## 现状

| 项 | 状态 |
|----|------|
| `plugin[]` 模块插件通道 | **已在 VM 验证可加载** |
| Supermemory tool + hooks 注入 | tool / inject / keyword / capture 已验收 |
| 一键安装 `install.ps1` / `node bin/cli.js` | VM `status ready=YES`；slash commands/skills 已装 |
| Browser OAuth `login` | 与官方同协议 |
| npm 包 `mimocode-supermemory` | **源码已对齐 src→build→dist**；`npm pack` 0.3.0 就绪，**待 publish** |
| `mimo plugin mimocode-supermemory` | 发布后验收（cache 路径与现网一致） |
| file hooks（`.mimocode/hooks/*.ts`） | VM loader 失败（宿主），不作为主路径 |

## OpenCode 路径（我们对齐的目标）

```text
bunx opencode-supermemory install
  → ~/.config/opencode/opencode.jsonc  { "plugin": ["opencode-supermemory"] }
  → OpenCode 启动时加载 npm/模块插件（Plugin → Hooks）
```

MiMoCode 对应：

```text
配置 plugin: ["mimocode-supermemory"]
  → 解析 %USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\...
  → 导出 PluginModule { id, server: SupermemoryPlugin }
```

## 安装（对齐官方 opencode-supermemory）

### 推荐：`mimo plugin`（官方宿主命令）

```powershell
# 本地包目录（VM 实测可用）
mimo plugin file:C:\path\to\mimocode-supermemory-pkg
# 或绝对路径
mimo plugin C:\path\to\mimocode-supermemory-pkg
# 发布 npm 后
mimo plugin mimocode-supermemory
mimo plugin mimocode-supermemory -g
```

**实测（MiMoCode 0.1.14）**：

- `mimo plugin file:...` / 绝对路径 → **安装成功**，写入 `~\.mimocode\mimocode.json` 的 `plugin[]`
- 但运行时对 `file:` 解析可能失败；**稳定加载**依赖包名条目 `"mimocode-supermemory"` + cache  
  `%USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\`
- `github:user/repo` → 需要 **PATH 中有 git**（无 git 会报 `No git binary found`）

### 一键安装（Windows，无 Node）

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
powershell -ExecutionPolicy Bypass -File install.ps1 -Status
```

脚本会：**优先尝试 `mimo plugin file:<包目录>`**，并**始终**执行已验证的 cache 落盘 + 写入 `"plugin": ["mimocode-supermemory"]`。

### 一条命令（有 Node / npx）

```bash
# 发布 npm 后（推荐，对齐官方）
npx mimocode-supermemory install
mimo plugin mimocode-supermemory
# 仓库内
node bin/cli.js install
```

### 开发（src → dist）

```bash
npm install
npm run typecheck
npm run build
npm run test:contract
npm run prepublishOnly
```

### 鉴权

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Login
```

（console browser OAuth，与官方同协议。）

等价于官方 `bunx opencode-supermemory@latest install` 的效果：

1. 把插件放到 MiMoCode 解析路径  
   `%USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\`
2. 合并写入 `%USERPROFILE%\.config\mimocode\mimocode.jsonc`  
   → `"plugin": ["mimocode-supermemory"]`
3. 生成记忆配置模板  
   `%USERPROFILE%\.config\mimocode\supermemory.jsonc`

### 常用命令

```powershell
# 检查是否就绪
powershell -File install.ps1 -Status

# 鉴权说明
powershell -File install.ps1 -Login

# 卸载
powershell -File install.ps1 -Uninstall
```

有 Node 时也可用：

```bash
node bin/cli.js install
node bin/cli.js status
node bin/cli.js login
node bin/cli.js uninstall
```

### 鉴权（对齐官方 Browser login）

```bash
# Node / npx（推荐，与 opencode-supermemory 同协议）
npx mimocode-supermemory login
# 或
node bin/cli.js login
```

```powershell
# Windows 零依赖：本地 HttpListener + 打开浏览器
powershell -ExecutionPolicy Bypass -File install.ps1 -Login
```

流程与官方一致：

```text
打开 https://console.supermemory.ai/auth/connect?callback=http://127.0.0.1:…/callback&client=mimocode
  → Supermemory 授权后回调 apikey=sm_…
  → 写入 %USERPROFILE%\.supermemory-mimocode\credentials.json
  → 同步写入 ~/.config/mimocode/supermemory.jsonc 的 apiKey
```

插件读取顺序：

1. `SUPERMEMORY_API_KEY` 环境变量  
2. `~/.config/mimocode/supermemory.jsonc` → `apiKey`  
3. `~/.supermemory-mimocode/credentials.json`

手动 API Key（官方也支持）：

```powershell
[Environment]::SetEnvironmentVariable("SUPERMEMORY_API_KEY", "sm_...", "User")
```

```powershell
# 查看状态（不打印完整 Key）
powershell -File install.ps1 -Status
# 或
node bin/cli.js status
```

### 重启 MiMoCode

新终端 / 新 Desktop 会话后，日志应出现：

```text
service=plugin path=mimocode-supermemory loading plugin
```

会话中 `supermemory mode=help` 返回 JSON，且含 `"plugin":"mimocode-supermemory"`。

### 通道 B — `.mimocode` 落盘（降级 / 工具可用）

```text
.mimocode/tools/supermemory.ts
.mimocode/hooks/mimocode-supermemory.ts   # 注意：MiMoCode 0.1.14 Windows 可能加载失败
.mimocode/skills/mimocode-supermemory/SKILL.md
```

模板见 [`templates/`](./templates)。

## 架构

```text
MiMoCode
  plugin: ["mimocode-supermemory"]
        │
        ▼
  PluginModule { id, server }
        │
        ├─ tool.supermemory  add|search|profile|list|help
        ├─ chat.message      [SUPERMEMORY] + recall（synthetic parts）
        ├─ system.transform  系统提示注入
        └─ compacting        context.push only
        │
        ▼
  Supermemory HTTP API
    POST /v3/documents · /v4/search (field q) · /v4/profile
    containerTag = repo_{dir}__local
```

### 环境变量

复制 `.env.example`，至少配置 `SUPERMEMORY_API_KEY`。

## 开发

```bash
npm install
npm run typecheck
npm run build
```

宿主类型来自 peerDependency `@mimo-ai/plugin`（本机 MiMoCode 安装树中已有 `0.1.14`）。

## 设计约束（来自调研）

详见 [`research/mimocode-native-plugins/REPORT.md`](./research/mimocode-native-plugins/REPORT.md)：

1. 不重写宿主 compaction 所有权（opencode-supermemory #69/#85 教训）
2. synthetic parts 不得被 capture 回灌
3. 权限/静默失败必须可观测
4. 记忆后端可切换 cloud / self-host
5. 默认注入可配置、可关闭

## 目录

```text
src/           插件实现
templates/     .mimocode 落盘模板
research/      立项调研（deep research 报告与 findings）
```

## License

MIT
