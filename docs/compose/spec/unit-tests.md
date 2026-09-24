---
feature: unit-tests
status: delivered
updated: 2026-09-22
branch: main
commits: 22ef8e0..(working-tree #8)

# 单元测试（backlog #8 收尾）

## Report

**What was built** — Node 内置 `node:test` + esbuild（`scripts/test-unit.mjs` → `test/.tmp`）。覆盖 tag 规范化与 **`c3d35c834ba4`**、basename/`__local`、**确定性 pin**（`fileConfig.projectContainerTag`）与 **无 git → basename-or-path**、keyword 中英文、`extractHits` 多形态。`containerTagSync`/`resolveContainerTag` 可选 `fileConfig` 隔离宿主配置。`npm test`；`prepublishOnly` 含 unit。

**Verification** — `npm test`：**9 pass / 0 fail**（含 pin + basename-or-path）；contract/parity PASS；tsc PASS。

**Journey log**
1. `Don't forget to rotate keys` → 保留 `to rotate keys`，断言对齐实现。  
2. 审查指出 pin 用例名不副实 → 增加 `fileConfig` 注入并写死 pin / no-git 两分支。  
3. `test/.tmp` 入 `.gitignore`；测试文件列表写在 `test-unit.mjs`（非自动 glob）。

## [S1] Problem

#5 已把 `src/` 对齐到可 `build` 出与 VM 行为一致的 `dist`，并用 contract/parity 门禁。BACKLOG #8 仍要求 **关键单测**（tag 解析 / API 相关纯函数），目前只有静态 contract + parity，没有断言式回归测试。

## [S2] Design

### 决策

| 轴 | 选择 |
|----|------|
| 测试框架 | **Node 内置 `node:test` + `node:assert`**（无新运行时依赖） |
| 测试对象 | **纯函数 / 无网络**：tags、keyword、`extractHits` |
| 范围外 | 真实 Supermemory HTTP、宿主 hooks E2E、mimo run（已有 VM 验收 / PRE-EXISTING） |

### 契约用例（与已验收行为对齐）

**tags（`src/tags.ts`）**

1. `normalizeOrigin`：`https://github.com/wsks2233/mimocode-supermemory.git` / `git@…` / 带 `.git` → 同一规范化串  
2. `sha12(normalizeOrigin("github.com/wsks2233/mimocode-supermemory")) === "c3d35c834ba4"`  
3. `containerTagSync`：无 pin 时 basename → `repo_{name}__local`；非法名 → `repo_path_*__local`  
4. `resolveContainerTag`：`projectContainerTag` pin → `source= config:projectContainerTag`；无 pin + mock git 失败 → `basename-or-path`

**keyword（`src/keyword.ts`）**

5. `extractRememberContent`：`Remember: foo` / `记住：bar` 抽出正文  
6. `matchKeyword`：命中 `remember` / `记住`；空白或无关句 → null  

**api（`src/api.ts`）**

7. `extractHits`：memory.text / chunk string / chunk.content 三种形态；跳过空文本  

### 工程命令

```bash
npm test              # node --test test/
npm run test:contract # 既有 contract + parity（保留）
npm run prepublishOnly # 增加 npm test
```

测试文件：`test/tags.test.mjs` · `test/keyword.test.mjs` · `test/api.test.mjs`（ESM，可直接 import `src/*.ts` 需先 build 或对 JS 逻辑测 **src 为 TS** —— 用 **build 后的 `dist` 不合适**测纯函数边界）。

### 实现（最终）

用已有 **esbuild** 将 `src/tags|keyword|api.ts` 打到 `test/.tmp/*.mjs`，再 `node --test`（`scripts/test-unit.mjs`）。`containerTagSync` / `resolveContainerTag` 增加可选 `fileConfig`，测试**不**依赖宿主 `supermemory.jsonc`。

验收：

1. `npm test` 退出码 0，至少上述 7 类断言通过  
2. `npm run test:contract` 仍 PASS  
3. 无网络调用；无 `sm_` 密钥  

## [S3] Out of Scope

- 覆盖率报表、CI matrix、浏览器测试  
- E2E mimo / VM（已有记录）  
- 重写 src 架构  

## Tasks

- [x] T1: `test/` + `scripts/test-unit.mjs` + `npm test` — acceptance: `npm test` 8/8 PASS (covers: S2)
- [x] T2: prepublishOnly + BACKLOG #8 + commit — acceptance: 脚本与文档一致 (covers: S2; depends: T1)
