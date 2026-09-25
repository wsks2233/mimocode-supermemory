# mimocode-supermemory

给 **MiMoCode / MiMo Desktop** 加上**长期记忆**：跨会话记住项目约定、决策和偏好。

参考开源项目 [opencode-supermemory](https://github.com/supermemoryai/opencode-supermemory) 的思路，接到 MiMo 的插件通道（`plugin[]`）上。

---

## 它能做什么

| 能力 | 说明 |
|------|------|
| **自动记住** | 会话结束、你说「记住 / Remember」时，写入 Supermemory |
| **自动想起来** | 新会话开始时注入相关记忆；需要时用 `supermemory` 工具搜索 |
| **手动管理** | 搜索、添加、查看画像、删除（forget） |
| **项目隔离** | 按 git 仓库区分记忆（`repo_名__哈希`），不同项目不串 |
| **斜杠命令** | `/supermemory-init` · `login` · `status` 等 |

---

## 三分钟安装

### 方式 A：有 Node（推荐）

```bash
mimo plugin mimocode-supermemory
```

或：

```bash
npx mimocode-supermemory install
```

### 方式 B：Windows，没有 Node

把本仓库或安装包放到任意目录后：

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
powershell -ExecutionPolicy Bypass -File install.ps1 -Status
```

看到 **`ready : YES`** 即安装成功。

### 登录 Supermemory

任选其一：

```powershell
# 浏览器 OAuth（推荐）
powershell -ExecutionPolicy Bypass -File install.ps1 -Login
```

或设置环境变量（从 https://console.supermemory.ai/keys 获取）：

```powershell
[System.Environment]::SetEnvironmentVariable("SUPERMEMORY_API_KEY", "sm_你的密钥", "User")
```

登录后**重启 MiMo / 新建会话**。

---

## 怎么用

在 **MiMo 会话里**（TUI 或 Desktop，不是 PowerShell）输入：

| 命令 | 作用 |
|------|------|
| `/supermemory-status` | 看插件是否就绪 |
| `/supermemory-init` | 深入读一遍项目，把架构/命令/约定写入记忆 |
| `/supermemory-login` | 浏览器登录 |
| `/supermemory-logout` | 清除本机登录（保留安装） |
| `/supermemory-index` | 与 init 相同（官方别名） |

平时也可以直接说：

- 「记住：发布必须走 OIDC」
- 「我们之前定过什么部署窗口？」
- 「把这个项目的测试命令存下来」

插件会在合适时自动读写记忆；需要时调用工具 `supermemory`（模式：`search` / `add` / `profile` / `list` / `forget` / `help`）。

---

## 配置（可选）

文件：`~/.config/mimocode/supermemory.jsonc`

```jsonc
{
  "apiKey": "",              // 也可用 SUPERMEMORY_API_KEY
  "autoInject": true,        // 新会话是否自动注入记忆
  "compactionInject": true,  // 压缩时是否带入项目记忆
  "compactionWriteback": true // 是否把宿主 checkpoint 写回 Supermemory
}
```

- **不要**把真实密钥提交进 Git。  
- 配置文件**不要**带 UTF-8 BOM（记事本另存为时注意）。

---

## 开发者

```bash
npm install
npm run typecheck
npm run build:dist
npm test
npm run test:contract
```

- 源码在 `src/`，构建产物是 `dist/index.js`（宿主加载的是 dist）。  
- 发版：改 `package.json` 的 `version` → 打 tag `vX.Y.Z` → GitHub Actions 自动 `npm publish`。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| `status` 显示 ready NO | 先 `install.ps1 -Status`，看缺 package / plugin / key 哪一项 |
| 找不到 `/supermemory-*` | 在 **MiMo 对话输入框** 里输，不是在 PowerShell；重启 MiMo 后再试 |
| 记忆「想不起来」 | 用 `/supermemory-init` 索引项目；确认在**该项目目录**打开会话 |
| `mimo run` 报 EUNKNOWN | 多为 **MiMoCode 宿主/环境** 问题，与本插件无关；可改用 TUI / Desktop |

更多说明见 `docs/` 与 `docs/compose/`。

---

## 特别鸣谢

**感谢小米公司 MiMo / MiMoCode 团队**，以及 MiMo Desktop 项目所有参与内测的同事与同学。

没有 MiMo 提供的插件通道（`plugin[]`）、会话钩子与工具面，就没有这个记忆插件；本项目在安装、OAuth、slash 命令与官方 OpenCode 生态对齐时，也大量参考了 Supermemory 与开源社区的工作。

---

## 特别声明

> **本项目的初始版本，来源于 MiMo Desktop 项目的内测产物。**

即：最早的插件形态与验证是在 **MiMo Desktop 内测环境**里孵化、打磨和打磨的；随后整理为可独立安装的 `mimocode-supermemory` 包。使用与转载时请保留本声明，并尊重 MiMo 相关商标与使用条款。

---

## License

MIT（见 [LICENSE](./LICENSE)）。

Supermemory 为第三方服务；使用前请阅读其服务条款与隐私政策。
