---
feature: npm-publish
status: in-progress
updated: 2026-09-20
branch: main
commits: 65b5a1f..(pending)
---

# npm 发布 + mimo plugin 安装（backlog #5）

## Report

（实现前：调研与步骤已定，待用户指示动手。）  
**决策修订 2026-09-20**：包名由 scoped `@wsks2233/mimocode-supermemory` 改为 **非 scope `mimocode-supermemory`**（用户指定，对齐官方安装体验）。

## [S1] Problem

当前只能靠「拷 cache + 手写 plugin[]」或 `install.ps1`。官方体验应是：

```bash
mimo plugin <npm-package>
# 或 npx <npm-package> install
```

阻塞点：

1. **包未发布** — registry 上 `mimocode-supermemory` 为 404（未占用）。
2. **npm 未登录** — 本机 `npm whoami` → `ENEEDAUTH`；`.npmrc` 无 authToken。
3. **src ≠ dist** — 宿主 canonical 是 `dist/index.js`（672 行手维）；`src/` 是另一套草稿，且依赖 npm 包 `supermemory`（**package.json 未声明**），行为契约与 dist 多处不一致。
4. **发布后需实测** — `mimo plugin mimocode-supermemory` 是否从 npm 落盘到已验证 cache 路径 `packages/mimocode-supermemory@latest/node_modules`。

## [S2] Design

### 已锁定决策（本轮 grill）

| 轴 | 决策 |
|----|------|
| src↔dist | **本项内完成对齐**（不是只做发布卫生） |
| 包名 | **`mimocode-supermemory`（非 scope）** — 2026-09-20 用户改定；对齐官方 `opencode-supermemory` 安装体验 |
| 验收环境 | **VM 安装 Node 后** `mimo plugin` + status |
| 流程 | 先调研写步骤；**用户指示后再动手** |

### 调研结论：src vs dist 差距（对齐基准 = dist 行为）

| 能力 | dist（canonical / 已 VM 验证） | src（当前草稿） |
|------|-------------------------------|-----------------|
| 依赖 | **无** npm 依赖，HTTP `fetch` | `import Supermemory from "supermemory"`（未进 dependencies） |
| 配置 | env → `supermemory.jsonc` → credentials.json | 仅 env + plugin options；**不读 jsonc/credentials** |
| `isConfigured` | 有 apiKey 才算就绪 | apiKey **或** baseUrl 即 true（过宽） |
| containerTag | pin → git-origin `repo_{name}__{sha12}` → `repo_{name}__local` → path hash；tool JSON 含 `tagSource`/`origin` | 无 pin；无 origin 时也 `hash(path)`，**不是** `__local` 约定 |
| normalizeOrigin | 去 `.git`、协议、`git@host:` | 无 |
| tool 形态 | 普通对象 `{description, parameters, execute}` | `@mimo-ai/plugin` 的 `tool()` helper |
| forget | id **或** content/query；v4 memories + v3 documents | **仅 id**；SDK documents.delete |
| tool JSON | 含 `plugin`, `containerTag`, `tagSource` | 薄 JSON，无 tagSource |
| keyword 自动写 | 有（中英文 pattern + extractRememberContent + proof log） | **无** |
| chat.message | keyword + 首回合记忆块 + 每回合 recall；parts 带 `sessionID`/`msg*` | 仅 inject；无 keyword |
| system.transform | 有 | **无** |
| session.post | user+assistant；`sm_capture_mode: automatic` | 多偏 assistant；cadence 逻辑不同 |
| IPv4 | `dns.setDefaultResultOrder("ipv4first")` | **无** |
| default export | `{ id, server: SupermemoryPlugin }` | 同形态（id 相同） |
| 运行时验证 | VM cache 加载 / tool / capture 已验收 | **从未作为 canonical 加载** |

**结论**：对齐不是「编译 src 覆盖 dist」，而是 **以 dist 契约为规格重写/收敛 src，再让 build 产出与 dist 行为等价的 `dist/index.js`**；禁止在 parity 测试通过前用 tsc 盲目覆盖 dist（AGENTS.md 红线）。

### 目标包契约（发布后）

```jsonc
{
  "name": "mimocode-supermemory",
  "version": "0.3.0",
  "type": "module",
  "main": "./dist/index.js",
  "exports": { ".": "./dist/index.js" },
  "bin": { "mimocode-supermemory": "./bin/cli.js" },
  "files": ["bin", "dist", "install.ps1", "templates", "README.md", "LICENSE"],
  "repository": { "type": "git", "url": "https://github.com/wsks2233/mimocode-supermemory" },
  "engines": { "node": ">=18" },
  "scripts": {
    "verify-syntax": "node --check dist/index.js && node --check bin/cli.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "node scripts/build.mjs",
    "prepublishOnly": "npm run verify-syntax && node scripts/check-dist-parity.mjs"
  }
}
```

- **PLUGIN_ID / package.name / plugin[]**：三者统一为 **`mimocode-supermemory`**（与官方 `opencode-supermemory` 同构）。
- **对外命令**：`mimo plugin mimocode-supermemory` · `npx mimocode-supermemory install`。
- **风险**：全局名先到先得；publish 前再次 `npm view mimocode-supermemory` 确认未被占用。

### 宿主 resolve（非 scope，与现有 VM 路径一致）

| 项 | 路径 / 字符串 |
|----|----------------|
| cache（已验证布局） | `~/.cache/mimocode/packages/mimocode-supermemory@latest/node_modules/{package.json,dist/index.js}` |
| plugin[] | `["mimocode-supermemory"]` |
| 命令 | `mimo plugin mimocode-supermemory` |

发布后 VM 复测：npm 拉包是否落到上述 cache，以及 `mimo plugin` 写入哪份 config（`~/.config/mimocode/mimocode.jsonc` vs `~/.mimocode/mimocode.json`）。

### src→dist 对齐策略（推荐）

1. **规格源**：当前 `dist/index.js` 行为 + 已验收 backlog #1–#4。
2. **src 重写**：去掉 `supermemory` SDK；模块化实现与 dist 同契约（config/tags/keyword/tool/hooks）。
3. **build**：`scripts/build.mjs` 将 `src/**` 打成单文件 ESM → `dist/index.js`（esbuild via `npx` 或仓库内 devDependency）。
4. **parity**：`scripts/check-dist-parity.mjs` — 导出形状、tag 四分支、keyword 正则、tool mode 表、IPv4 尝试存在等。
5. **切换规则**：parity PASS 后才允许 `npm run build` 更新 dist；再部署 VM 一次冒烟（tool help / tag.log）。
6. **文档**：AGENTS.md / README — canonical 仍为 dist，但 **src 为 source of truth**；`tsc` 仅 `--noEmit` typecheck，产物由 build 脚本写入 dist。

### 安装器改动（src 对齐之后）

- `PKG_NAME` / cache 路径 / plugin[]：**保持/确认** 非 scope `mimocode-supermemory`（与 #4 及 VM 现状一致，无需 scoped 迁移）。
- status / 文档 / slash token 继续指向同一包名；README 安装节补 `npx` / `mimo plugin mimocode-supermemory`。
- 全局名占用风险：publish 前复核 registry。

### 验收（BACKLOG #5）

1. `npm pack` 产物含 `dist/index.js`、`bin/cli.js`、`install.ps1`、`templates/**`；无 `sm_` 密钥。
2. `npm run typecheck` + `verify-syntax` + parity **PASS**。
3. `npm publish` 成功（需用户 npm 登录；包名 `mimocode-supermemory`）。
4. VM：安装 Node → `mimo plugin mimocode-supermemory` → cache/plugin[] 为 `mimocode-supermemory` → `install.ps1 -Status` **ready=YES**。
5. 无密钥进 git/npm 包。

## [S3] Out of Scope

- Backlog #6 compaction 策略变更
- Desktop 图形市场
- 宿主 resolver 对 npm 源的未文档化差异（实测后文档化；install.ps1 仍作 fallback）
- 回退到 scoped 包名（仅当全局名在 publish 前被抢注时）
- 强制 VM 生产环境切换；本项以 VM 验收 + 本机 pack 为准

## 具体步骤（待你指示后按序动手）

> 约定：每步完成后我汇报证据；**你不喊「继续/动手」我不做下一步改代码/发布**。  
> 破坏性/不可逆：`npm publish`、删除 cache、改 plugin[] 前单独确认。

### Phase 0 — 基线冻结（只读）

| 步骤 | 动作 | 产出 |
|------|------|------|
| 0.1 | 记录 `git rev-parse HEAD`、dist sha256、src 文件列表 | 基线 |
| 0.2 | 备份 `dist/index.js` → `dist/index.js.pre-npm-backup`（本地，不提交） | 可回滚 |
| 0.3 | 确认 registry 仍无占用、`npm whoami` 状态 | 发布前置 |

### Phase 1 — src 重写对齐 dist 契约（不覆盖 dist）

| 步骤 | 动作 | 验收 |
|------|------|------|
| 1.1 | 新增/重写 `src/config.ts`：env + jsonc + credentials；key 优先级与 dist 一致 | 单测/脚本对照 |
| 1.2 | 重写 `src/tags.ts`：pin / git-origin / `__local` / path-hash；`normalizeOrigin`；返回 `{canonical,source,origin,projectName}` | 已知 origin→`c3d35c834ba4` 用例 |
| 1.3 | 重写 `src/api.ts`（或 memory）：fetch `/v3/documents` `/v4/search` `/v4/profile` forget 链；**删除 supermemory SDK** | 无该 import |
| 1.4 | 重写 `src/keyword.ts`：pattern + extract + 内存 seen | 与 dist 同 pattern 表 |
| 1.5 | 重写 `src/tool.ts`：对象形态 + 完整 forget + JSON 含 plugin/tagSource | 模式表一致 |
| 1.6 | 重写 `src/plugin.ts` / `src/index.ts`：hooks 与 dist 同集（chat.message / system.transform / compacting / permission.ask / session.post）+ IPv4 | default `{id,server}` |
| 1.7 | `scripts/check-src-contract.mjs`：静态断言源码含关键契约（无 SDK import、有 ipv4first 等） | PASS |

### Phase 2 — build + parity（此步前不覆盖 dist）

| 步骤 | 动作 | 验收 |
|------|------|------|
| 2.1 | `scripts/build.mjs`（esbuild bundle src→单文件 ESM） | 产出可 `node --check` |
| 2.2 | build 输出写到 `dist/index.built.js`（临时） | 不动 canonical |
| 2.3 | `scripts/check-dist-parity.mjs`：built vs 行为契约（导出、tag 分支、keyword、tool modes） | PASS |
| 2.4 | 人工 diff 关键片段；**你确认后** 才 `built` → `dist/index.js` | 用户闸门 |
| 2.5 | 本机 `npm run verify-syntax` + typecheck | PASS |
| 2.6 | 同步 VM 两处 cache dist 冒烟（tool help / 不回归） | 可选，建议做 |

### Phase 3 — 包元数据与安装命令文档（非 scope）

| 步骤 | 动作 | 验收 |
|------|------|------|
| 3.1 | `package.json`：`name: mimocode-supermemory`、0.3.0、repository、engines、scripts | 字段齐 |
| 3.2 | 确认 install.ps1 / cli.js PKG_NAME 仍为非 scope（与 plugin[] 一致） | marker 检查 |
| 3.3 | README/AGENTS/模板安装命令：`mimo plugin mimocode-supermemory` + `npx mimocode-supermemory install` | 文档一致 |
| 3.4 | `npm pack --dry-run` / tarball：files 列表正确、无密钥 | PASS |

### Phase 4 — npm 发布（需你登录）

| 步骤 | 动作 | 闸门 |
|------|------|------|
| 4.1 | **你** 在终端执行 `npm login`（或提供已配置的 token；**不要**把 token 发进聊天） | 我只检测 `whoami` |
| 4.2 | `npm publish`（非 scope 包，无需 access=public） | 你口头「可以 publish」后我才执行 |
| 4.3 | `npm view mimocode-supermemory version` | 版本可解析 |
| 4.4 | 记录 publish 时 git SHA / tarball shasum | 审计 |

### Phase 5 — VM 验收

| 步骤 | 动作 | 验收 |
|------|------|------|
| 5.1 | VM 安装 Node 18+（nvm/zip；路径 ASCII） | `node -v` |
| 5.2 | `mimo plugin mimocode-supermemory`（记录 stdout/stderr） | 安装日志 |
| 5.3 | 核对 cache 为 `packages/mimocode-supermemory@latest/...` + plugin[] 写入位置 | 与文档一致 |
| 5.4 | 必要时 install.ps1 补齐 cache/plugin[] | ready |
| 5.5 | `install.ps1 -Status`：package/dist/plugin/key ready=YES + commands/skills OK | **验收点** |
| 5.6 | 可选：`mimo debug config`；tool `mode=help` JSON 含 `plugin: mimocode-supermemory` | 冒烟 |

### Phase 6 — 收尾

| 步骤 | 动作 | 产出 |
|------|------|------|
| 6.1 | 独立 review（compose-next） | PASS/critical 清单 |
| 6.2 | spec → delivered；BACKLOG #5 验收结果 | 文档 |
| 6.3 | 本地 commit（默认不 push；你要 push 再说） | `<type>: ... (backlog #5)` |
| 6.4 | 你选：push / 下一项 backlog | — |

### 风险与回滚

| 风险 | 缓解 |
|------|------|
| build 产出与 dist 行为漂移 | parity 脚本 + **你确认后** 才替换 dist；保留 `.pre-npm-backup` |
| 全局包名被他人抢注 | publish 前 `npm view`；若已被占用则回退 scoped 并改文档 |
| npm 登录/网络失败 | 发布步骤单独闸门；pack/publish 可重试 |
| src 重写引入回归 | 对齐以 **已验收 dist 行为** 为规格；VM 冒烟在替换 dist 后 |
| 密钥进包 | pack 后扫描 tarball；prepublishOnly |

### 你需要拍板的点（动手前）

1. 包名已定：**非 scope `mimocode-supermemory`**（本条已按你指示改入 spec）。  
2. Phase 2.4「替换 dist」是否要求你逐步确认，还是 Phase 2 结束后一次确认？  
3. npm 登录方式：你本机 `npm login` 后我只跑 publish，还是你希望自己 `npm publish`？  
4. 其余步骤是否按 Phase 0→6 执行（plugin[] 与包名已统一，无需 scoped 迁移）？

## Tasks

- [ ] T0: 用户批准步骤/闸门 — acceptance: 明确「按此计划动手」或修改意见；包名=非 scope (covers: S2)
- [ ] T1: src 契约重写（无 SDK，对齐 dist）— acceptance: contract 脚本 PASS；无 `supermemory` import (covers: S2)
- [ ] T2: build + parity，经确认后更新 dist — acceptance: parity PASS；verify-syntax PASS (covers: S2; depends: T1)
- [ ] T3: package.json 非 scope 元数据 + 文档安装命令 — acceptance: pack 清单正确；无密钥 (covers: S2; depends: T2)
- [ ] T4: npm publish `mimocode-supermemory`（用户登录闸门）— acceptance: `npm view` 可解析该版本 (covers: S2; depends: T3)
- [ ] T5: VM Node + `mimo plugin mimocode-supermemory` + status ready=YES — acceptance: cache/plugin[] 一致；ready YES (covers: S2; depends: T4)
- [ ] T6: review + BACKLOG #5 + 本地 commit — acceptance: review PASS；commit 含 backlog #5 (covers: S2; depends: T5)
