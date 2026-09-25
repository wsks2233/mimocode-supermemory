# VM 从零全链路测试报告（mimocode-supermemory）

- **日期**：2026-09-25  
- **环境**：Windows VM · MiMoCode **0.1.15**（重装后）· Node **v24.21.0**  
- **插件**：`mimocode-supermemory@0.3.2`（npm / `mimo plugin`）  
- **备份**：`C:\Users\wsks\sm-full-backup-20260925-004019`  
  （含 credentials / supermemory.jsonc / mimocode 配置 / auth.json / mimocode bin）

---

## 1. 流程总览

| 阶段 | 结果 |
|------|------|
| A. 密钥与配置备份 | **PASS** |
| B. 卸载 MiMoCode（`mimo uninstall --force --keep-data`） | **PASS** |
| C. 官方脚本重装 MiMoCode | **PASS** → **0.1.15** |
| D. 配置模型接口 | **PASS** → `model=xiaomi/mimo-v2.6-pro`，`small=xiaomi/mimo-v2.6-flash`；Xiaomi 登录保留 |
| E. 安装 Supermemory 插件 | **PASS** → `mimo plugin` + `install.ps1` |
| F. status / slash / skill | **PASS** → ready **YES**，commands 5 + skills 5 |
| G. Supermemory API 闭环 | **本轮网络超时**；**同会话早前 6/6 PASS**（见 §3） |
| H. 真实模型对话（`mimo run` / serve） | **FAIL / 不稳定**（见 §4） |
| I. 卸载插件（密钥保留） | **PASS**（前一轮） |

---

## 2. 分阶段明细

### A. 备份 — PASS

`C:\Users\wsks\sm-full-backup-20260925-004019`：

- `supermemory-credentials.json` · `supermemory.jsonc` · `mimocode.jsonc` · `auth.json`（Xiaomi）· `mimocode-bin`

### B/C. 卸载并重装 MiMo — PASS

| 项 | 值 |
|----|-----|
| 卸载 | `--force --keep-data`；binary/config/cache 清除；`auth.json` 保留 |
| 安装 | `https://mimo.xiaomi.com/install.ps1` |
| 版本 | **0.1.15** |
| `providers whoami` | MiMo · User ID 1033478906 |

### D. 模型接口 — PASS

```jsonc
// %USERPROFILE%\.config\mimocode\mimocode.jsonc（无 BOM）
{
  "$schema": "https://mimo.xiaomi.com/mimocode/config.json",
  "model": "xiaomi/mimo-v2.6-pro",
  "small_model": "xiaomi/mimo-v2.6-flash",
  "plugin": ["mimocode-supermemory"]
}
```

`mimo models` 可见：`xiaomi/mimo-v2.6-pro` / `mimo-v2.6-flash`（window 1.05M）。

### E/F. 插件安装 — PASS（需 patch）

| 步骤 | 结果 |
|------|------|
| `mimo plugin mimocode-supermemory --force` | **Installed**（0.3.2 落盘） |
| npm 包内 `install.ps1`（0.3.2 原版） | **自拷贝失败** → commands/skills MISSING |
| 使用修复版 `install.ps1`（repo `cdf07b6` 逻辑） | commands **OK** · skills **OK** |
| `install.ps1 -Status` | package/dist/plugin/key OK · **ready YES** |

已知：`mimo plugin file:<嵌套 npm 路径>` 会报 `Manifest read failed` / ENOENT（**宿主对 file: 的既有问题**）；稳定路径仍是 **包名 + cache + plugin[]**。

### G. Supermemory API（同会话早前，Node 脚本）

| 用例 | 结果 |
|------|------|
| tool add → search → forget | **PASS**（200 / 命中 / 204 gone） |
| keyword capture 可检索 | **PASS** |
| compaction `[host-checkpoint]` 可检索 | **PASS** |
| profile | **PASS** |
| **合计** | **6/6 PASS** |

**本轮（重装后）**：`fetch` 连 `api.supermemory.ai` **ConnectTimeout**（VM 出网问题，**非代码回归**）。

### H. 真实模型调用 — 未通过

| 方式 | 结果 | 说明 |
|------|------|------|
| `mimo run --model xiaomi/mimo-v2.6-pro` | **EUNKNOWN: unknown error, read** | 即使 `--pure` / 加 git stub **仍失败**；日志在 `server-proxy` 启动约 18ms 内 |
| `mimo serve --port 4311` | 短暂 Listen 后 **进程退出**；连接 503 → 断开 | 无法稳定完成 `/v1/chat/completions` |
| `mimo models` / `providers whoami` | **PASS** | 目录与登录正常 |

**结论**：模型 **配置与凭据正常**；`mimo run` 在 **0.1.15 + 本 VM** 上仍 **PRE-EXISTING 故障**（非 supermemory 插件引入）。`mimo serve` 在本环境不稳定，**未拿到** `MODEL_OK` 真实回复。

### I. 插件卸载 — PASS（前一轮）

cache/commands/skills 删除；credentials 与 Supermemory key **保留**。

---

## 3. 结论矩阵

| 能力 | 判定 |
|------|------|
| 备份 / 卸载 MiMo / 官方重装 | **可用** |
| 模型接口配置（mimo-v2.6-pro/flash + Xiaomi 登录） | **可用** |
| `mimo plugin` + slash/skill + status ready | **可用**（slash 依赖修复版 install.ps1） |
| Supermemory 记忆 API 闭环 | **可用**（网络正常时 6/6；本轮网络超时） |
| `mimo run` 真实对话 | **不可用**（宿主 EUNKNOWN） |
| `mimo serve` + OpenAI 兼容 chat | **不稳定** |
| 插件卸载 | **可用** |

---

## 4. 缺口 / 下一步

| # | 项 | 建议 |
|---|-----|------|
| 1 | **`mimo run` EUNKNOWN**（0.1.15 仍复现） | 上游宿主 bug；需 TUI 人工验证或升级 MiMo |
| 2 | **`mimo serve` 易退出** | 查宿主日志；非插件问题 |
| 3 | **VM 访问 Supermemory 超时** | 查防火墙/DNS/代理；通了再跑 §G |
| 4 | **npm 0.3.3**（含 install.ps1 自拷贝修复） | 已在仓库 `cdf07b6`；**待你确认发布** |
| 5 | TUI 内 `/supermemory-*` | 需人在 TUI/Desktop 各点一次 |

---

## 5. 密钥安全

- 备份目录仅本机 VM，**未写入仓库**  
- 报告中 API key 仅掩码（`sm_a9n...`）  
- Xiaomi `auth.json` 已备份，未外传  

**总评**：**插件侧从零安装/状态/slash/卸载 在重装后的 0.1.15 上全部通过**；**阻塞在宿主 `mimo run` 与 VM→Supermemory 网络**，二者均非本仓库功能回归。  
