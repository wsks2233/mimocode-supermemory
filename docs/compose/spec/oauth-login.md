---
feature: oauth-login
status: designed
updated: 2026-09-19
branch: main
commits: ef0449a..working-tree
---

# Supermemory browser OAuth login (OpenCode parity)

## Report

**What was built** — 与官方 `opencode-supermemory login` 同协议的浏览器 OAuth：本地 `127.0.0.1` callback + `state` 校验，打开 `https://console.supermemory.ai/auth/connect?callback=...&client=mimocode`；授权回调 `apikey=sm_...` 写入 `%USERPROFILE%\.supermemory-mimocode\credentials.json` 并同步到 `supermemory.jsonc`。入口：`bin/cli.js login|logout|status` 与 `install.ps1 -Login|-Status`。

**Verification** — VM：`install.ps1 -Status` → package/plugin/key OK，`ready: YES`；缓存 dist 含 `loadCredentialsFile`；`mimo run` 日志仍 `service=plugin path=mimocode-supermemory loading plugin`。完整浏览器点授权需在有桌面的环境执行 `-Login` / `cli.js login`。

**Journey log**
1. 官方「OAuth」= console connect + 本地 callback 换 `sm_` Key，非 RFC 设备码。
2. 凭证目录 `~/.supermemory-<client>/credentials.json`，client 区分宿主。
3. 插件读取：env → supermemory.jsonc → credentials.json。
4. VM 无 Node → PowerShell HttpListener 同构实现。

## [S1] Problem

官方 `bunx opencode-supermemory login` 会打开浏览器完成 Supermemory 授权并写本机凭证；我们此前 `login` 只引导 API Key，体验不一致。

## [S2] Design

### 官方协议（opencode-supermemory@2.0.13）

```text
AUTH_BASE_URL = https://console.supermemory.ai/auth/connect
1. 本地 HTTP 127.0.0.1:随机端口
2. state = random hex
3. 打开 {AUTH_BASE_URL}?callback=http://127.0.0.1:{port}/callback?state=...
     &client={name}&hostname=...&os=...&cwd=...&cli_version=...
4. 回调 ?state&apikey=sm_...[&api_url=]
5. 校验 state；apikey 须 sm_ 前缀；写 credentials.json
超时 5 分钟
```

### MiMo 落点

| 项 | 值 |
|----|-----|
| client | `mimocode` |
| 凭证 | `~/.supermemory-mimocode/credentials.json` |
| 同步配置 | `~/.config/mimocode/supermemory.jsonc` apiKey |
| 读取顺序 | env → jsonc → credentials.json |
| 命令 | login / logout / status |

## [S3] Out of Scope

- Desktop 内嵌 OAuth UI
- 授权服务器实现（依赖 Supermemory console）
- 设备码流

## Tasks

- [x] T1: dist 读取 credentials.json (covers: S2)
- [x] T2: bin/cli.js login/logout/status 浏览器流 (covers: S2)
- [x] T3: install.ps1 -Login HttpListener 同构 (covers: S2)
- [x] T4: README 鉴权章节 (covers: S2)
- [x] T5: VM status ready=YES + plugin 仍加载 (covers: S2; depends: T1–T3)
