---
feature: vm-zero-deploy
status: delivered
updated: 2026-09-25
branch: main
commits: cdf07b6
---

# VM 从零全链路（backup → 重装 MiMo → 装插件 → 测 → 卸载）

## Report

**What was built** — 无新功能代码；在 VM 上完成**真实从零流程**并写出 `docs/compose/spec/vm-zero-deploy-report.md`：备份密钥 → 卸载 MiMo → 官方重装 0.1.15 → 配置 `xiaomi/mimo-v2.6-pro/flash` → `mimo plugin` + 修复版 `install.ps1` 装 slash → status ready=YES → API 闭环（早前 6/6）→ 卸载插件留密钥。

**Verification** — 备份目录与 manifest OK；`mimo --version=0.1.15`；`providers whoami` MiMo 登录保留；status **ready YES**（commands/skills OK）；节点 Node 24 下 Supermemory API 早前 **6/6**；`mimo run` 重装后仍 **EUNKNOWN（PRE-EXISTING）**；`mimo serve` 不稳定。

**Journey log**
1. 卸载 MiMo 用 `--keep-data` 保留 `auth.json`，避免重登 Xiaomi。  
2. npm 0.3.2 的 `install.ps1` 在嵌套路径自拷贝失败 → 必须用 repo 修复版才能装 slash。  
3. `mimo run` 在 0.1.15 与 0.1.14 同样 EUNKNOWN，与插件无关。

## [S1] Problem

需要证明：备份 → 重装宿主 → 配模型 → 装插件 → 功能 → 卸载 在真实 VM 上可用，并列出缺口。

## [S2] Design

见 `vm-zero-deploy-report.md` 全文（矩阵、缺口、备份路径）。

## [S3] Out of Scope

- 修复宿主 `mimo run` / `serve`  
- 发 npm 0.3.3（已单独说明）

## Tasks

- [x] T1: 备份 — acceptance: MANIFEST 齐全 (covers: S2)
- [x] T2: 卸载+重装 MiMo+模型配置 — acceptance: 0.1.15 + mimo-v2.6-pro + whoami (covers: S2)
- [x] T3: 装插件+status+slash — acceptance: ready YES (covers: S2)
- [x] T4: API/模型/卸载 — acceptance: 报告矩阵 (covers: S2)
- [x] T5: 报告落盘 — acceptance: vm-zero-deploy-report.md (covers: S2)
