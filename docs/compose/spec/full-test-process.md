# 全面测试流程说明（优化版）

**目标**：在 VM 上验证 MiMo 重装/模型配置 + `mimocode-supermemory` 新包的安装、功能、卸载全链路，产出可复核、可脱敏、可回滚的测试报告。

## 0. 执行原则

1. **先备份，再操作**；未备份不得执行 T2/T3/T7。
2. **密钥只落盘、只掩码**；禁止在聊天、日志、报告中记录完整 `sm_` / 模型 API key。
3. **版本冻结**：记录 MiMo、Node、npm 包、模型 ID、OS/VM 信息。
4. **每步留证**：命令、exit code、HTTP status、关键输出、日志路径。
5. **失败分级**：`PASS / FAIL / BLOCKED`。网络超时记 `BLOCKED(网络)`，不直接记功能 FAIL。
6. **不擅自继续**：前置缺失先确认；严重安全项失败立即停止。

---

## 1. 前置条件与准入

| 项 | 检查命令/方式 | 期望 |
|---|---|---|
| 网络 | `curl.exe -4 -I https://github.com`、`registry.npmjs.org`、`api.supermemory.ai` | TCP/TLS 可达；401/404 不算网络失败 |
| Node | `node --version` | ≥ 18，记录实际版本 |
| MiMo | `mimo --version`、`providers whoami` | 已安装，whoami 正常 |
| 模型 | `mimo models` / 配置 | 记录 `model`、`small_model`，如 `xiaomi/mimo-v2.6-pro` / `flash` |
| Supermemory key | env 或 `supermemory.jsonc` | 存在；仅记录掩码，如 `sm_****abcd` |
| 备份 | `sm-full-backup-*` | 有可用备份或本次新建 |
| 权限 | PowerShell 执行策略、目录写权限 | 可执行 `install.ps1`、可写 `.mimocode` |
| 版本 | `npm view mimocode-supermemory version`、包内 `package.json` | 记录待测版本，避免 `@latest` 漂移 |

缺任一项 → **先确认，不强行继续**。

---

## 2. 测试顺序与通过标准

```text
T0 环境冻结/证据目录
  → T1 备份
  → T2 卸载插件/清环境（可选清 MiMo，密钥保留）
  → T3 全新安装
  → T4 status/slash/skill 发现
  → T5 功能闭环（API）
  → T6 真实模型
  → T7 卸载（留密钥）
  → T8 报告归档/结论
```

| ID | 步骤 | 操作 | 通过标准 | 证据 |
|---|---|---|---|---|
| **T0** | 环境冻结 | 建报告目录、开 transcript、记录版本/网络/模型 | 信息完整 | `env.txt`、`transcript.log` |
| **T1** | 备份 | 复制 credentials、supermemory.jsonc、mimocode*.json、auth.json；生成 MANIFEST | 文件齐全；key 仅掩码；SHA256 可核 | `MANIFEST.txt` |
| **T2** | 清环境 | `install.ps1 -Uninstall`；检查 cache/commands/skills/plugin[] | cache=0、slash=0；creds/key 仍在 | 卸载日志、config 快照 |
| **T3** | 全新安装 | ① `mimo plugin mimocode-supermemory --force` ② 运行包内 `install.ps1` | Plugin Installed；slash 写入；无报错 | 安装日志、exit code |
| **T4** | 状态与发现 | `install.ps1 -Status`；`mimo debug config`；`mimo debug skill` | **ready YES**；commands=5、skills=5；debug 可见 | status 输出、debug 日志 |
| **T5** | 功能闭环 API | Node 脚本：add → search → forget；keyword；compaction checkpoint；profile | 各子项 **PASS**；记录 `/v3` `/v4` 与 HTTP status | `T5-api.log` |
| **T6** | 真实模型 | 优先 `mimo run`；备选 `mimo serve` + `/v1/chat/completions` | 返回 **MODEL_OK** 或等价内容 | `T6-model.log`、HTTP status |
| **T7** | 卸载 | `install.ps1 -Uninstall` | 插件/slash 删除；**密钥仍在** | 卸载日志、config 快照 |
| **T8** | 报告归档 | 汇总结果、阻塞、安全确认、后续建议 | 报告可复核；无完整密钥 | `report.md` |

可选补充：TUI 内 `/supermemory-status`（人工截图）；OAuth `-Login`（需浏览器）。

---

## 3. 命令速查（PowerShell / VM）

```powershell
# T0 环境与证据目录
$TS = Get-Date -Format "yyyyMMdd-HHmmss"
$REPORT = "$env:USERPROFILE\sm-test-report-$TS"
New-Item -ItemType Directory -Force $REPORT | Out-Null
Start-Transcript "$REPORT\transcript.log"

$MIMO = "$env:USERPROFILE\.mimocode\bin\mimo.exe"
$NODE = "C:\Program Files\nodejs\node.exe"

& $MIMO --version | Tee-Object "$REPORT\mimo-version.txt"
& $NODE --version | Tee-Object "$REPORT\node-version.txt"
npm view mimocode-supermemory version | Tee-Object "$REPORT\npm-version.txt"
curl.exe -4 -I https://github.com | Tee-Object "$REPORT\net-github.txt"
curl.exe -4 -I https://registry.npmjs.org | Tee-Object "$REPORT\net-npm.txt"
curl.exe -4 -I https://api.supermemory.ai | Tee-Object "$REPORT\net-sm.txt"

# 解析实际包路径，不要硬编码
$PKG = (Get-ChildItem "$env:USERPROFILE\.cache\mimocode\packages" -Recurse -Filter install.ps1 |
  Where-Object { $_.FullName -match "mimocode-supermemory" } |
  Select-Object -First 1).DirectoryName
$PKG
Get-Content "$PKG\package.json" -Raw | ConvertFrom-Json | Select-Object name,version

# T1 备份（路径按实际调整；密钥只写文件，不贴聊天）
$BK = "$env:USERPROFILE\sm-full-backup-$TS"
New-Item -ItemType Directory -Force $BK | Out-Null
Copy-Item "$env:USERPROFILE\.supermemory-mimocode\credentials.json" $BK -ErrorAction SilentlyContinue
Copy-Item "$env:USERPROFILE\.config\mimocode\supermemory.jsonc" $BK -ErrorAction SilentlyContinue
Copy-Item "$env:USERPROFILE\.config\mimocode\mimocode.jsonc" $BK -ErrorAction SilentlyContinue
Copy-Item "$env:USERPROFILE\.mimocode\mimocode.json" $BK -ErrorAction SilentlyContinue
Copy-Item "$env:USERPROFILE\.local\share\mimocode\auth.json" $BK -ErrorAction SilentlyContinue
Get-ChildItem $BK | Get-FileHash | Out-File "$BK\MANIFEST.txt"

# T2 卸载插件
powershell -ExecutionPolicy Bypass -File "$PKG\install.ps1" -Uninstall
& $MIMO debug config | Tee-Object "$REPORT\T2-config-after-uninstall.txt"

# T3 安装
& $MIMO plugin mimocode-supermemory --force | Tee-Object "$REPORT\T3-plugin-install.txt"
powershell -ExecutionPolicy Bypass -File "$PKG\install.ps1" | Tee-Object "$REPORT\T3-install.txt"

# T4 状态
powershell -ExecutionPolicy Bypass -File "$PKG\install.ps1" -Status | Tee-Object "$REPORT\T4-status.txt"
& $MIMO debug config | Tee-Object "$REPORT\T4-debug-config.txt"
& $MIMO debug skill | Tee-Object "$REPORT\T4-debug-skill.txt"

# T5 API
& $NODE "$env:USERPROFILE\sm-api-loop.mjs" *>&1 | Tee-Object "$REPORT\T5-api.log"

# T6 模型：优先 run
& $MIMO run --dir C:\Users\wsks\mimocode-supermemory-test --model xiaomi/mimo-v2.6-pro --dangerously-skip-permissions "Reply MODEL_OK" *>&1 | Tee-Object "$REPORT\T6-model.log"

# T7 再卸载
powershell -ExecutionPolicy Bypass -File "$PKG\install.ps1" -Uninstall | Tee-Object "$REPORT\T7-uninstall.txt"
powershell -ExecutionPolicy Bypass -File "$PKG\install.ps1" -Status | Tee-Object "$REPORT\T7-status-after.txt"
& $MIMO debug config | Tee-Object "$REPORT\T7-config-after.txt"

# T8
Stop-Transcript
```

> 说明：备份路径以本 VM 实际为准（credentials 常在 `~\.supermemory-mimocode\`，config 在 `~\.config\mimocode\`）。上文 T1 中若路径调整，以实测为准。

---

## 4. 记录格式（报告用）

每步记录：**结果 + 一行证据 + 证据路径**。  
禁止记录完整 `sm_` / 模型 API key。

| ID | 结果 | 证据 | 证据路径 |
|---|---|---|---|
| T0 |  |  |  |
| T1 |  |  |  |
| T2 |  |  |  |
| T3 |  |  |  |
| T4 |  |  |  |
| T5 |  |  |  |
| T6 |  |  |  |
| T7 |  |  |  |
| T8 |  |  |  |

报告结论模板：

```text
整体结论：PASS / FAIL / BLOCKED
关键阻塞：
安全确认：未泄露完整密钥；T7 后密钥仍在
版本信息：MiMo=..., Node=..., 包=...
建议后续：
```

---

## 5. 失败处理

| 现象 | 分级 | 处理 | 重跑范围 |
|---|---|---|---|
| 装不上 / status NO | FAIL | 查路径、BOM、`plugin[]`、权限 | T3–T4 |
| Supermemory API 超时 | BLOCKED(网络) | 先 `curl -4` 复核连通；重试 1 次；不记功能 FAIL | T5 |
| `mimo run` EUNKNOWN | BLOCKED(宿主) | 查宿主问题；换 `serve`；记录宿主依赖 | T6 |
| 模型 401/无模型 | FAIL(配置) | 查 `providers whoami`、`mimo models`、model id | T6 |
| 密钥丢失/泄露 | FAIL(严重) | 立即停止；从 T1 备份恢复；安全事件记录 | 全流程 |
| 版本漂移 | FAIL/BLOCKED | 固定版本后重装；核对 `package.json` | T3–T4 |

---

## 6. 执行前确认

请回复以下信息后执行：

1. 按 **T0→T8** 执行；
2. 当前包版本：`package.json` / `npm view`；
3. 是否先卸插件再装：严格 T2→T3，还是现有安装覆盖测；
4. T6 优先 `run` 还是 `serve`；
5. 是否允许 TUI/OAuth 人工补充项。
