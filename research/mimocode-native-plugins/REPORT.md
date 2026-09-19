# 给 MiMoCode / MiMo Desktop 装上接近原生的插件能力

> Generated 2026-09-19 · depth: deep · ~40+ primary sources · workspace: research/mimocode-native-plugins/

## Executive summary

- 行业在 2026-09 已把「接近原生插件能力」收敛为六面基线：**MCP**（stdio/HTTP/OAuth）+ **Agent Skills**（SKILL.md 渐进披露）+ **多模式 Rules** + **带决策控制的生命周期 Hooks** + **可分发插件包**（manifest/marketplace）+ **跨工具路径发现**（`.claude/`、`.agents/`、`AGENTS.md`）[1]。
- **Supermemory 不是单一 API，而是多门共享一店的上下文基础设施**：cloud API、coding-agent 插件、remote MCP、SMFS 文件系统、self-host binary 共用同一记忆引擎；agent 规范契约极小——`Bearer sm_…` + `POST /v3/documents` / `POST /v4/search` / `POST /v4/profile` + 单数 `containerTag` 隔离 [2][3]。
- **`opencode-supermemory` 是最可复制的参考实现**：OpenCode 插件工厂返回 hooks + 自定义 `supermemory` tool；读路径为「首回合 unshift 记忆块 + 每回合 reasoned-recall 指令」（均 `synthetic:true`）；写路径为 tool 显式读写 + idle/deleted/dispose 的批量幂等 capture + 80% 上下文 preemptive compaction [4][5]。
- **MiMoCode 已是 OpenCode 分支，插件骨架在位但碎片化**：配置 schema 保留 `plugin[]`、`mimo plugin` CLI、`@mimo-ai/plugin@0.1.14`（`Plugin → Hooks`）；并行存在 `.mimocode/{tools,hooks,skills,workflows,tui}` 文件级扩展与完整 MCP 面。缺口是：无统一「原生插件包」规范、`permission.ask` 未接线、Desktop 不扫跨品牌 skill 根且 MCP 不热加载、TUI 插件与 Electron Desktop 割裂 [6][7]。
- **标准绑定结论清晰**：公共层应绑定 **MCP（当前规范 2026-07-28，无状态 + `server/discover`）** 与 **Agent Skills（agentskills.io）**；MCP Skills 扩展（SEP-2640）与 Agent Plugins 1.0.0（Amazon/Cursor/Microsoft/OpenAI/Vercel TSC）是可移植打包方向。自研边界应落在宿主侧加载/权限/命名空间/私有 marketplace，而不是发明对立工具协议 [8][9]。
- **记忆层挂接收敛为三层叠加**：(A) REST/SDK；(B) remote HTTPS MCP；(C) host-native plugin（capture/inject/compaction/scope）。存储内核差异大（Supermemory temporal vector-graph + dreaming [16]；Mem0 ADD-only SQL+vector+entity [64]；Letta 记忆即 harness 状态/MemFS git [68]；Zep Graphiti temporal graph [70][71]）。
- **实践失败点应写进设计约束**：插件接管 compaction 会与宿主原生逻辑竞态（opencode-supermemory #69/#85）；阈值无法真正关闭、模型上下文元数据失败回退 200K；no-auth URL-as-key 有凭据/cookie 持久性风险；permission pending 时用户消息可被静默丢弃（MiMo-Code #2426）[11][12]。
- **对本项目的直接含义**（证据归纳，非实现决策）：优先做「宿主插件能力层」——统一 package 格式 + 打通 lifecycle hooks/permission + 兼容 Agent Skills/MCP/跨品牌路径——再把 Supermemory 作为第一个参考插件打样，而不是只写一个 supermemory 适配器。Mem0 从 v0.2 的 9 个 MCP 工具砍到 v0.3 单工具 + skills + hooks，也说明「原生感」来自生命周期与注入，而非工具数量 [13]。

## Background & scope

**问题**：如何为 MiMoCode（以及 MiMo Desktop）构建插件能力层，使其扩展体验接近 Claude Code / Cursor / OpenCode 等 coding agent 的「原生插件」水平。

**锚点材料**：`supermemoryai/supermemory`（含 README.zh-CN）、`XiaomiMiMo/MiMo-Code`、`supermemoryai/opencode-supermemory`，并横向对比主流 agent 插件生态、记忆层与公共标准。

**边界**：本轮只调研、不实现、不写 feature spec。假设工作区 `F:\代码\mimocode-supermemory` 为后续 greenfield 项目落点；「接近原生」定义为安装/发现/配置/调用路径短、状态自然进入上下文、错误与权限可预期。用户消息中「和其他 agent…」一句被截断，按「其他主流 coding agent 的原生插件能力」理解。调研日 2026-09-19；优先近 12–18 个月一手材料。

**方法限制**：本环境 WebSearch 插件不可用，7 路子代理改用定向 WebFetch 一手文档/仓库 API/npm/本机已安装包；社区面以 HN Algolia + GitHub issues 为主。引用均来自 findings 中实际抓取的 URL。

---

## 1. Supermemory：作为「记忆插件」的服务端契约

Supermemory 官方定位是 *Context infrastructure for AI agents*，卖点是 **Every door, one store**——API、MCP、plugins、SMFS、connectors 共享同一记忆 [2]。中文 README 进一步说明开源 coding-agent 插件「本质上是 supermemory API 的实现」[14]。

### 1.1 规范 API（给任何 MiMo 集成用的最小面）

| 用途 | 端点 | 要点 |
|------|------|------|
| 鉴权 | `Authorization: Bearer sm_…` | 避免已弃用的 `x-supermemory-api-key` |
| 写入 | `POST /v3/documents` | 文档进管线；`customId` 支持后续 diff 计费 |
| 召回 | `POST /v4/search` | `searchMode`: `memories` / `documents` / **`hybrid`（推荐）** |
| 画像 | `POST /v4/profile` | `profile.static` + `profile.dynamic`（+ 可选 buckets） |
| 隔离 | JSON body 单数 `containerTag` | 复数 `containerTags` 已弃用；越权 tag → 403 |

官方 agents 文档明确禁止把 `/v3/memories`、`/v3/search`（作记忆检索）或复数 `containerTags` 当作规范面 [3]。`containerTag` 是硬边界命名空间（`^[a-zA-Z0-9_:-]+$`，≤100），不是软 metadata；可发 scoped key（`POST /v3/auth/scoped-key`）且不能跨容器 [15]。

### 1.2 内部模型（插件必须理解的异步契约）

- 双引擎：自研 learning model（学什么/何时忘/如何建关系）+ Temporal Vector-graph（Vector + FTS + graph）；客户端不预切块、不选 embedding [16]。
- 同一 document 在同一 `containerTag` 下产出三类结果：**chunks**（SuperRAG grounding）/ **graph memories**（事实）/ **profile**（always-on 摘要）[16]。
- `status: done` **不等于**记忆就绪：graph memories 来自第二阶段 **dreaming**。`dreaming: dynamic`（默认，质量更好、可能延迟）vs `instant`（立刻出图、每文档 +1 operation，适合下一步就要 search 的插件路径）[16]。
- 图关系仅三种：`updates`（时序替换 + `isLatest`）、`extends`（ enrich）、`derives`（推断）；另有 Facts/Preferences/Episodes 与自动遗忘。集成方**不要**手工维护图 [17]。
- 召回侧：hybrid 结果字段是 `memory` 或 `chunk`；可 `include.relatedMemories` / `include.forgottenMemories`；文档称 profile 组装上下文约 1 call / 50–100ms，优于 3–5 次 search / 200–500ms [18]。
- 摄入旋钮：`taskType: "memory"`（默认，抽事实/profile/graph）vs `"superrag"`（只 chunk/embed/index，文档称按 token 便宜 5x）；`entityContext` ≤1500 chars/容器；文件上限 50MB；OpenAPI 3.1 在 `api.supermemory.ai` [19]。

### 1.3 多门集成（MiMo 可对标的分层）

1. **HTTP Memory API / SDK**（npm/pypi `supermemory`）[3]
2. **Remote MCP**：`https://mcp.supermemory.ai/mcp`，OAuth；工具 `search_memory` / `get_profile` / `add_memory` / `list_*` / `who_am_i`；MCP Apps widgets；resources `supermemory://profile|spaces` [20]
3. **Host-native plugins**：Claude Code marketplace、OpenCode `plugin` 数组等，实现 lifecycle capture/inject [21][22]
4. **SMFS**：把 container 挂成真实目录（macOS NFSv3 / Linux FUSE），语义 grep、虚拟 `profile.md`、双向同步；serverless 用 `@supermemory/bash` [23]
5. **Self-host**：`npx supermemory local` 单二进制，同 API，端口 6767；插件用 `SUPERMEMORY_API_URL` / `baseUrl` 切换；connectors 与 hosted MCP 仍是平台侧 [24]

**对 MiMo 的启示**：不要假设「插件 = 一个 tool」。原生记忆能力在优秀实现里是 **API + MCP + lifecycle plugin + 文件系统视图** 的分层；Desktop 若只做 MCP，会丢掉 capture/inject/compaction 这些真正「原生」的部分 [2][20][23]。

---

## 2. `opencode-supermemory`：可复制的宿主接线模式

### 2.1 包与宿主契约

- npm `opencode-supermemory`：TypeScript 插件，MIT；调研时 npm 2.0.13（约 2026-09-01 发布），repo 已 2.0.14；stars 1587 / forks 104；创建于 2025-12-24 [25]。
- OpenCode 宿主：JS/TS 模块 `export const Plugin = async ({project, client, $, directory, worktree}) => hooks`；加载源 = config `plugin: ["name"]` 或本地 `.opencode/plugins/`、`~/.config/opencode/plugins/`；npm 包由 Bun 自动装到 `~/.cache/opencode/node_modules/` [26]。
- package.json 声明：`"@opencode-ai/plugin": "^1.0.162"`，`"supermemory": "^4.0.0"`；`opencode.hooks: ["chat.message", "permission.ask", "event"]`；bin `opencode-supermemory` 负责 install/login/status [27]。
- **词表冲突（设计前必须钉死）**：插件 package.json 用 `chat.message` / `permission.ask`，OpenCode 文档事件名是 `message.updated` / `permission.asked` 等。MiMoCode 必须选定一套稳定 hook 词表 [26][27]。

### 2.2 读路径（上下文注入）

`src/index.ts` 返回三类 chat.message 变更，**全部 `synthetic: true`**（capture 排除）[28]：

1. 首回合：`parts.unshift` `[SUPERMEMORY]` 块（User Profile / Recent Context / Project Knowledge / Relevant Memories；默认 profile 5 条、project 10 条、user 5 条、similarity ≥0.6；仅 header 时返回空串不注入）[28][29]
2. 每回合：`parts.push` reasoned-recall 指令——模型先静默判断「记忆是否 materially improve THIS answer」，值得才 `supermemory mode:"search"`；平凡消息跳过 [30]
3. 可选：关键词 nudge，push 要求 `mode:"add"` 的合成消息 [28]

`permission.ask` 对 `supermemory + search` **自动 allow**，保证 recall 零摩擦 [30]。

### 2.3 写路径（工具 + 生命周期）

- **显式工具**：单一 `supermemory` tool，modes `add|search|profile|list|forget|help`；`add` 剥离 `<private>`，全 private 拒绝；scope `user|project` → metadata `sm_scope`；写入附 `sm_capture_mode:"tool"`、项目 id、共享 `AGENT_ENTITY_CONTEXT` [31]
- **自动 capture**：`event` 钩子上 `session.idle` 按 `captureEveryNTurns`（默认 3）批量刷新；`session.deleted` / `server.instance.disposed` 冲刷剩余；幂等 ID `opencode:capture:{sha256(sessionID:firstTurn:lastTurn)}`；只保留 final assistant 消息，丢弃 synthetic/ignored，剥 `<private>` [32]
- **Preemptive compaction**：不在 `experimental.session.compacting` 内实现，而在 `event` 里盯 assistant `message.updated` 的 token 用量；`(input+cache.read+output)/contextLimit` vs 阈值 0.80；守卫 MIN 50k tokens / cooldown 30s / 默认 limit 200k。触发后：注入项目记忆到磁盘 hook message → `client.session.summarize()` → 摘要以 `sm_capture_mode:"compaction"` 存回 Supermemory [33]

### 2.4 作用域与安装 UX

- 统一仓库容器：`repo_{project-name}__{hash(normalized Git origin remote)}`；无 origin 则 hash(真实路径)。Claude Code / Codex / OpenCode 对同一 repo 共容器；人/项目用容器内 `sm_scope` 区分；仍读 legacy `user_project_*` / `claudecode_*` 等 [34]
- 安装：`bunx opencode-supermemory@latest install` 写入 `~/.config/opencode/opencode.jsonc` 的 `plugin` 数组 + slash commands 到 `~/.config/opencode/commands/`；self-host 用 `baseUrl` / `SUPERMEMORY_API_URL` [5][22]
- OpenCode 自定义工具：`tool({description, args, execute})` 与内置并列，同名插件工具优先；`tool.execute.before` 可改 args；`shell.env` 可注 env [26]

### 2.5 可复制到 MiMoCode 的六面宿主能力（综合）

| # | 宿主必须提供 | 参考实现用途 |
|---|--------------|--------------|
| 1 | config 驱动安装（plugin 名数组 + 本地目录） | OpenCode `plugin[]` / Bun 安装 |
| 2 | chat/message 变更 hooks（可 unshift/push parts） | 首回合记忆块 + recall 指令 |
| 3 | permission 策略 hook | 自动 allow 记忆 search |
| 4 | 会话生命周期 event bus | idle/deleted/dispose capture |
| 5 | 自定义 tool 注册 | `supermemory` 多 mode 工具 |
| 6 | synthetic part 安全的 capture/compaction 协同 | 避免记忆回灌与宿主 compaction 竞态 |

---

## 3. MiMoCode / MiMo Desktop：已有扩展面与结构化缺口

### 3.1 已有能力（一手）

- **血统**：官方 README——MiMoCode 是 OpenCode fork，保留 multi-provider / TUI / LSP / **MCP / plugins**，再叠加 memory、context、subagent、compose、evolve 等 [35]。
- **配置 schema**（`mimo.xiaomi.com/mimocode/config.json`）：`plugin` 数组支持 string 或 `[string, options]` 元组；`skills.paths[]` + `skills.urls[]`（远程 skill 索引）；`mcp`；`command`。CLI 文档含 `mimo plugin (plug)` [36]。
- **插件 SDK**：本机已装 `@mimo-ai/plugin@0.1.14`（MIT，`packages/plugin`），exports `.` / `./tool` / `./tui`；类型 `Plugin = (input, options?) => Promise<Hooks>`；`PluginInput` 含 `client/project/directory/worktree/$` 与 `experimental_workspace.register` [37]。
- **文件级 evolve 面**：`.mimocode/{tools,hooks,skills,workflows,tui}`；除 TUI 外热加载；类型从 `@mimo-ai/plugin` 导入 [38]。
- **自定义工具文档**：项目 `.mimocode/tools/` + 全局 `~/.config/mimocode/tools/`；文件名即 tool id；同名覆盖内置；官方中文侧栏有 Custom tools/MCP/Skills 等，**未见 Plugins 专页** [39]。
- **MCP**：local（command/env/cwd/timeout 默认 5000ms）与 remote（url/headers/oauth，RFC 7591 DCR，token 在 `~/.local/share/mimocode/mcp-auth.json`）；组织 `.well-known/mimocode` 下发默认服务器；`mimo mcp add|list|auth|…` [40]。
- **Desktop 约束**：只扫/装 MiMoCode 根（`~/.config/mimocode/skills`、`<project>/.mimocode/skills/`）；**不扫** `~/.claude|~/.codex|~/.agents|~/.opencode/skills`；MCP 变更不热进当前会话 [41]。
- **Hooks 能力面（引擎 skill 文档）**：`session.pre/post`（可 cancel，post 含完整 trajectory）、`session.userQuery.*`、`actor.preStop/postStop`（`continue=true` 强制再跑）、`experimental.chat.system.transform` / `messages.transform`、`chat.params/headers`、`experimental.session.compacting` [38]。
- **硬边界**：`permission.ask` 在 Hooks 接口存在但 **not yet wired**；且官方明确 permissions **不能被自定义 tools/hooks 修改** [38]。
- **TUI 插件**：启动扫描 `~/.config/mimocode/tui/*` 与项目 `.mimocode/tui/*`；渲染绑定 opentui+Solid（非 HTML/CSS）；需 restart；与 Electron Desktop 插件模型割裂 [38]。
- **Desktop UI 扩展极窄**：settings 仅 theme/font_size/diff_style/language；主题色字体不开放；Browser Use 走「装插件 → 统一 MCP+skill」而非独立 `browser_*` 工具 [41]。

### 3.2 距「原生插件」的缺口（综合评估）

能力以**碎片化并行面**存在（OpenCode 遗产 `plugin` + evolve 文件级 + MCP + skills 远程索引 + Desktop Plugins 页），但缺少把 **MCP + skill + hook + custom tool + Desktop UI + 权限策略 + 版本/签名/市场** 打成单一可安装单元的公开规范。具体缺口：

1. 无 Plugins 产品文档与统一 package manifest
2. `permission.ask` 未接线 → 零摩擦 recall / 插件审批策略无法落地
3. Desktop 跨工具路径发现被品牌隔离（对比 OpenCode/Cline 主动读 `.claude/skills`）
4. MCP 不热加载 → 安装体验不像原生
5. TUI 插件与 Desktop UI 扩展割裂，Desktop 几乎无开放 UI 插件面
6. Hook 词表相对 OpenCode 父项目/第三方插件可能不一致（需以 `@mimo-ai/plugin` 类型与运行时为准做差集）

---

## 4. 行业基线：什么叫「接近原生」

截至 2026-09，一手文档显示主流 agent 已收敛出六面能力（与 Executive summary 一致）：

| 面 | 代表实现 | 关键细节 |
|----|----------|----------|
| MCP | Claude Code / Cursor / OpenCode / MiMoCode | stdio + Streamable HTTP + OAuth/DCR；Cursor 还支持 Roots/Elicitation/MCP Apps |
| Agent Skills | agentskills.io；Claude/OpenCode/Cline/Devin/… | 元数据 ~100 tokens 启动加载；正文建议 <5000 tokens；`name` 须与目录一致 |
| Rules | Cursor `.cursor/rules/*.mdc`；Devin 四模式；Continue/AGENTS.md | 激活：always / glob / model_decision / manual |
| Hooks | Claude Code 深生命周期 + 决策 JSON；OpenCode TS hooks | Pre/PostToolUse、session、compaction、permission |
| 插件包/市场 | Claude marketplace；Cursor Marketplace；Agent Plugins 1.0.0 | manifest + skills + mcp.json；团队安装模式 |
| 跨工具路径 | OpenCode/Cline/Windsurf 读 `.claude`/`.agents`/AGENTS.md | 兼容本身就是体验基线 |

薄基线反例：Aider 仅 CONVENTIONS.md（`/read` 或 conf 加载），说明「约定文件」本身不是原生插件层 [42]。

**Agent Plugins 1.0.0**：vendor-neutral 打包标准——`plugin.json` + `skills/`（Agent Skills）+ `mcp.json`（stdio/HTTP/legacy SSE）+ reverse-domain 客户端扩展命名空间；TSC 含 Amazon/Cursor/Microsoft/OpenAI/Vercel。明文：可移植的是组件结构；分发/安装/权限/UX 仍由各 client 控制 [9]。

Claude Code 插件包形态（行业最完整参考）：`.claude-plugin/plugin.json` 聚合 skills/agents/hooks/MCP/LSP/monitors/bin/settings；插件 skill 命名空间 `/plugin:skill`；官方 + 社区双 marketplace，社区审批 pin 到 commit SHA；另有 `claude plugin eval` [43][44]。

---

## 5. 标准与自研边界

### 5.1 MCP

- 规范线：**2026-07-28**——无状态（移除 initialize 握手），每请求 `_meta` 带 protocolVersion/capabilities，`server/discover` 为 MUST；Sampling/Logging/Roots 进入 deprecation [45]。
- 架构原语：Tools / Resources / Prompts；JSON-RPC 2.0 + stdio 或 Streamable HTTP [46]。
- 设计原则：只标准化已被多实现验证的模式；能组合就不进核心；extensions 是试验场 [47]。
- Tools：model-controlled；宿主应保持 human-in-the-loop；非可信 server 的 annotations 视为 untrusted [48]。
- **MCP Skills 扩展（SEP-2640 Final）**：`skills/list` + `skills/get`，内容仍 `resources/read`；宿主校验 SHA-256 digest/size/frontmatter；建议 ≤512 files / 16 MiB per skill；SDK/host 实现仍在推进 [49]。
- Registry 处于 preview：只托管公开 server 元数据、不支持私有、**不建议 host 直连**——应消费下游 marketplace/聚合器（自研私有市场对标此角色）[50]。

### 5.2 Agent Skills 与宿主插件层

- Agent Skills = 轻量开放扩展格式：目录 + `SKILL.md`（YAML frontmatter + Markdown）+ 可选 scripts/references；progressive disclosure 控制成本；已被 Claude Code、Gemini CLI、Cursor、VS Code Copilot、OpenCode、Goose、ChatGPT/Codex 等采用 [51]。
- 字段：必填 `name`（≤64，小写数字连字符，**等于父目录名**）与 `description`（≤1024）；建议 SKILL.md <500 行、正文 <5000 tokens；`allowed-tools` 实验性 [52]。
- Claude Code 在开放标准之上叠加私有能力（invocation control、subagent execution、dynamic context、plugin namespacing）；自定义 commands 已并入 skills（`.claude/commands/x.md` 与 skills 均产生 `/x`）[53]。

### 5.3 ACP 与 OpenAI

- **ACP** 标准化的是 **IDE ↔ coding agent** 会话/UX（JSON-RPC，stdio / 远程 HTTP-WS），复用 MCP JSON 类型并转发 MCP 配置——**不是**插件/工具协议本身 [54]。
- OpenAI Agents SDK 工具面 = functions / MCP / hosted tools，依赖 MCP Python SDK；ChatGPT/Codex 也在 Agent Skills 客户端列表。行业没有与 MCP 对立的私有插件总线可依赖 [55] [single source，README 级]。

### 5.4 建议的绑定边界（证据 → 设计原则）

| 应绑定公共标准 | 应自研/宿主私有 |
|----------------|-----------------|
| MCP tools/resources（+ Skills 扩展跟踪） | 插件包 manifest 的 MiMo 私有字段（Desktop UI、权限策略、签名） |
| Agent Skills 目录与 frontmatter | 加载顺序、热加载策略、跨品牌路径扫描策略 |
| Agent Plugins 1.0.0 结构作可移植 floor | 私有 marketplace / 组织 `.well-known/mimocode` 分发 |
| hook **语义**对齐 OpenCode/Claude 生命周期 | hook **词表与 API 形状**（必须与 `@mimo-ai/plugin` 钉死） |
| Supermemory containerTag / sm_scope 语义（若做记忆插件） | capture 默认策略、compaction 协同方式、隐私红线 |

---

## 6. 记忆层形态对比（若项目含记忆插件）

| 产品 | 存储内核 | Coding-agent 挂接 | 作用域 | 与「原生」相关的特点 |
|------|----------|-------------------|--------|----------------------|
| Supermemory | learning model + temporal vector-graph；dreaming 二阶段 | API / remote MCP / host plugin / SMFS / self-host | `containerTag` 硬边界 + `sm_scope` | 多门一店；跨 agent 统一 `repo_*__{git-hash}` |
| Mem0 | SQL+vector+entity（Platform graph）；ADD-only | MCP `mcp.mem0.ai` + native plugins + Agent Plugins v1 包 | `user_id`/`agent_id`/`app_id`/`run_id` | v0.3 单 `search_memories` + hooks；shared/personal 双桶 |
| Letta | memory blocks → MemFS git（记忆=agent 状态） | 定位对标 Claude/Codex/OpenCode SDK | agent-owned git repo | 离群：不是外部 memory API 而是 harness |
| Zep | Graphiti temporal Context Graph | skill + docs MCP（build plugin） | user graph + thread | 更偏「教你接」而非自动 capture 插件 |
| cognee | relational+vector+graph 管线 | Python API or MCP | 库侧作用域 | remember/recall/improve/forget 用户面 |

可复用结论：

- 原生感来自 **(C) host-native plugin** 做 capture/inject/compaction，而不是再堆 MCP 工具 [5][13][66]。
- 作用域设计应支持 **同一 git origin 跨 agent 共享 + 人/项目元数据分离** [34][13]。
- Letta 路线提醒：若 MiMo Desktop 想要「离线、进程内、零服务」记忆，那是 harness 内建状态问题，不是 Supermemory 适配器问题 [67][68][69]。

---

## 7. 实践失败点 → 设计约束

1. **不要让插件重写宿主 budget/compaction 所有权**  
   opencode-supermemory：模型 limit 元数据失败时回退硬编码 200K，~1M 模型在 ~160K 就被 compact；`compactionThreshold: 0` 被校验还原 0.8，`1` 在空 cache 下仍触发；宿主 `compaction.auto=false` 拦不住插件 `session.summarize()` [11]。issue #69 另有三连：summarize 后卡在 compaction 模型、小上下文 compaction 模型溢出、与原生 compaction 竞态；且 capture 仅有 compaction 后有损摘要、无 pre-compaction 抽取（13 天窗口 47 session >1M、104 >200K）[12]。  
   **约束**：hooks 应 observe/协同原生 budget，而不是私有实现一套 summarize 所有权；compaction 阈值必须可真正禁用；模型上下文 limit 必须可探测且失败策略显式。

2. **静默失败是原生体验的反面**  
   Supermemory cartesia SDK PR：纯字符串 search 结果在 dedup 中被静默丢弃，永远进不了 prompt；缺 role/content 的 tool-call 消息 KeyError 而非 skip [56]。MiMo Desktop #2426：permission pending 期间新聊天指令看似被接受实则静默丢弃 [57]。  
   **约束**：插件读写路径要可观测；权限门控要么排队要么明确拒绝；禁止「看起来成功」。

3. **Auth UX 与安全的权衡要显式**  
   Supermemory MCP 博客承认 no-auth URL-as-key：清 cookie 丢记忆、URL 泄露即全量可读 [58]。企业侧社区报告 MCP 配置明文密钥、rug-pull、每设备多 AI 应用×多 MCP 的攻击面 [59] [community]。  
   **约束**：MiMo 原生插件 auth 优先正式凭据存储（已有 `mcp-auth.json` 模式），避免 URL=密钥作为默认。

4. **工具型记忆的 token 与遗忘问题**  
   Supermemory 自己的分析：tool-mediated 写入反而更贵；无法感知已有记忆导致冗余；静态文件记忆不会遗忘 [60]。HN 亦有 MCP token 膨胀与「本地小 CLI、拒 hosted memory」的声音 [59][61] [community]。  
   **约束**：默认应支持隐式 lifecycle capture + 有遗忘/更新语义的存储；MCP 工具面保持精简（Mem0 教训）。

5. **产品稳定性现实**  
   Supermemory 2026-09-09 公告下线 company brain 与 Nova，但称 MCP/plugins 继续 [62]。社区仍质疑其相对 vector DB+profile 的技术差异 [62][61]。  
   **约束**：项目不应把宿主插件层锁死在单一记忆 SaaS；self-host/baseURL 可切换应是架构要求。

6. **Desktop 侧前置问题**  
   进程内存随项目/上下文膨胀的社区反馈说明：插件若默认注入大上下文，会放大宿主已知问题 [63] [single source, medium]。  
   **约束**：默认注入预算、可配置、可关闭。

---

## 8. 综合判断（供 compose-next Grill 使用）

以下是从证据推出的 **问题定义与候选方向**，不是最终产品决策：

**真正的问题**不是「缺一个 supermemory MCP 配置」（本机已能配 remote MCP），而是：

> MiMoCode/Desktop 已有插件/MCP/skills/hooks 碎片，但缺少让第三方能力以 **统一可安装单元 + 生命周期注入 + 权限可预期 + 跨工具兼容** 的方式变成「接近原生」体验的宿主层。

**候选方向（互斥程度递减，待 Grill）**

| 方向 | 做什么 | 证据支持 | 主要风险 |
|------|--------|----------|----------|
| A. 宿主插件能力层（通用） | 统一 plugin package、对齐 OpenCode/Agent Plugins、接线 permission、跨品牌 skills 路径、Desktop 安装 UX | 缺口集中在宿主；行业六面基线；Agent Plugins 1.0.0 | 工作量大；可能触及 MiMo 闭源 Desktop 限制 |
| B. Supermemory 原生参考插件 | 以 opencode-supermemory 为模板，做 `mimo-supermemory`：hooks+tool+scope+capture | F1/F2 完整可抄；MiMo 本就是 OpenCode fork，SDK 同构 | 受制于宿主缺口（尤其 permission.ask）；compaction 竞态教训 |
| C. 适配器/安装器项目 | 不改宿主，做 CLI：装 MCP、写 skills、生成 `.mimocode` 片段、跨品牌路径兼容层 | 成本最低；立刻可用现有 MCP/skills | 难「接近原生」；仍是外挂 |
| D. 记忆 harness 内建（Letta 向） | 记忆进 MiMo 自身状态而非外部服务 | 离线/隐私诉求；Desktop 已有 memory 能力叙事 | 与开源 Supermemory 生态脱节；产品归属可能不在本仓库 |

**推荐倾向（待用户确认）**：以 **A 为项目主轴**，把 **B 作为 A 的第一个垂直打样**（否则 A 缺真实负载）；C 可作为 A 的兼容子集/迁移工具；D 仅在明确要做离线记忆产品时再议。

---

## Comparison table（插件能力面对照）

| 能力面 | Claude Code | OpenCode | MiMoCode/Desktop（现状） | Supermemory 插件依赖点 |
|--------|-------------|----------|---------------------------|-------------------------|
| 插件包+市场 | plugin.json + 双 marketplace + eval | npm/local + config 数组 | schema 有 plugin；文档无 Plugins 页；Desktop 主要是 skills 页 | 安装 CLI 写 config；无统一 MiMo 包规范 |
| MCP | 完整 | local/remote + OAuth DCR | local/remote + OAuth + `.well-known/mimocode` | remote MCP 可即插 |
| Skills | Agent Skills + 插件命名空间 | 跨 `.claude`/`.agents` 发现 | 配置 paths/urls；Desktop 不扫跨品牌根 | 可附 skill/commands |
| Hooks | 深生命周期+决策控制 | 20+ 事件 TS hooks | evolve hooks 较全；`permission.ask` 未接线 | 需要 chat inject + event capture |
| 权限与 hooks | PermissionRequest 等 | permission.asked/replied | permissions **不可**被 hooks 改；ask 未接线 | recall 自动 allow 做不了 |
| 自定义 tool | MCP/插件 | `tool()` 优先于内置 | `.mimocode/tools` 同名覆盖内置 | `supermemory` 多 mode tool |
| 上下文注入 | skills/memory 多种 | chat.message 可 mutate | `experimental.chat.system.transform` 等存在 | 首回合块 + recall 指令 |
| Compaction 协同 | Pre/PostCompact | `experimental.session.compacting` | `experimental.session.compacting` 存在 | 现实现私有抢占，有竞态前科 |
| 路径兼容 | 定义方 | 读 `.claude`/`.agents` | 不扫品牌外 skills | 跨 agent 容器靠 git hash |

---

## Open questions

1. **`mimo plugin` 运行时完整度**：schema 与 CLI 存在，但是否完整继承 OpenCode Bun 自动安装、本地 plugins 目录、与第三方 npm 插件（含 opencode-supermemory）兼容，需在实现阶段用真实 runtime 验证（F3 dead end）。
2. **Hook 词表权威差集**：`@mimo-ai/plugin@0.1.14` Hooks 类型 vs OpenCode 文档事件全集 vs opencode-supermemory package.json hooks 列表，尚未做源码级 diff。
3. **Desktop 闭源边界**：Electron Desktop 侧是否存在未文档化的插件/事件面；Plugins 页是否会扩展超出 skills/marketplace。
4. **独立记忆基准**：Supermemory 声称 LongMemEval/LoCoMo/ConvoMem 第一，未做独立复核 [2][14]。
5. **量化成本**：coding-agent 场景下各家记忆插件的 token 开销、注入延迟、compaction 策略无公开可复现对比。
6. **OpenAI/部分 Claude 文档**：本环境 403/区域限制，OpenAgent SDK 证据停在 README 级。
7. **用户产品边界**：项目是「给 MiMoCode 装插件宿主」「给 MiMo Desktop 做 UI 插件」「先只做 supermemory 原生体验」还是「通用第三方插件平台」——需 compose-next Grill 用本报告收敛。

---

## Sources

访问日期均为 2026-09-19（除非页面自带更早 published）。

[1] Agent Plugins 1.0.0 — https://agent-plugins.org/ (accessed 2026-09-19)  
[2] Supermemory Docs Overview — https://supermemory.ai/docs/overview/what-is-supermemory  
[3] Supermemory Agents & MCP（canonical API）— https://supermemory.ai/docs/agents-and-mcp  
[4] opencode-supermemory install/docs 引用 — https://supermemory.ai/docs/integrations/opencode  
[5] opencode-supermemory npm README — https://www.npmjs.com/package/opencode-supermemory  
[6] MiMoCode README — https://raw.githubusercontent.com/XiaomiMiMo/MiMo-Code/main/README.md  
[7] MiMoCode config schema — https://mimo.xiaomi.com/mimocode/config.json  
[8] MCP changelog 2026-07-28 — https://modelcontextprotocol.io/specification/2026-07-28/changelog  
[9] Agent Plugins 规范站（可移植 floor）— https://agent-plugins.org/  
[10] 记忆层挂接归纳 — 支撑见 [supermemory docs][mem0][letta][zep][cognee] 各条  
[11] opencode-supermemory issue #85 — https://github.com/supermemoryai/opencode-supermemory/issues/85 (2026-09-13)  
[12] opencode-supermemory issue #69 — https://github.com/supermemoryai/opencode-supermemory/issues/69 (2026-08-11)  
[13] Mem0 Claude Code plugin — https://docs.mem0.ai/integrations/claude-code  
[14] Supermemory README.zh-CN — https://github.com/supermemoryai/supermemory/blob/main/README.zh-CN.md  
[15] Container tags — https://supermemory.ai/docs/concepts/container-tags  
[16] How it works — https://supermemory.ai/docs/concepts/how-it-works  
[17] Graph memory — https://supermemory.ai/docs/concepts/graph-memory  
[18] Recall/search — https://supermemory.ai/docs/recall/search  
[19] Ingestion + OpenAPI — https://supermemory.ai/docs/ingestion/add-memories ; https://api.supermemory.ai/v4/openapi  
[20] Supermemory MCP — https://supermemory.ai/docs/supermemory-mcp/mcp  
[21] Claude Code integration — https://supermemory.ai/docs/integrations/claude-code  
[22] OpenCode integration — https://supermemory.ai/docs/integrations/opencode  
[23] SMFS — https://supermemory.ai/docs/smfs/overview  
[24] Self-hosting — https://supermemory.ai/docs/self-hosting/overview  
[25] opencode-supermemory repo meta — https://api.github.com/repos/supermemoryai/opencode-supermemory  
[26] OpenCode Plugins docs — https://opencode.ai/docs/plugins/ (Last updated Sep 18, 2026)  
[27] opencode-supermemory package.json — https://api.github.com/repos/supermemoryai/opencode-supermemory/contents/package.json  
[28] opencode-supermemory src/index.ts — https://api.github.com/repos/supermemoryai/opencode-supermemory/contents/src/index.ts  
[29] context service — https://api.github.com/repos/supermemoryai/opencode-supermemory/contents/src/services/context.ts  
[30] recall service — https://api.github.com/repos/supermemoryai/opencode-supermemory/contents/src/services/recall.ts  
[31] tool registration（src/index.ts）— 同 [28]  
[32] capture service — https://api.github.com/repos/supermemoryai/opencode-supermemory/contents/src/services/capture.ts  
[33] compaction service — https://api.github.com/repos/supermemoryai/opencode-supermemory/contents/src/services/compaction.ts  
[34] 仓库 container / sm_scope — https://www.npmjs.com/package/opencode-supermemory  
[35] MiMoCode README — https://raw.githubusercontent.com/XiaomiMiMo/MiMo-Code/main/README.md  
[36] MiMoCode config schema — https://mimo.xiaomi.com/mimocode/config.json  
[37] @mimo-ai/plugin@0.1.14 — 本机 `~/.config/mimocode/node_modules/@mimo-ai/plugin/package.json`（lock 指向 npmjs 0.1.14）[primary local]  
[38] MiMoCode evolve/hook/permission 文档 — 本机 engine-config skills：evolve/reference/hook-api.md、mimocode-docs/reference/permissions.md [primary local]  
[39] Custom tools — https://mimo.xiaomi.com/zh/mimocode/custom-tools  
[40] MCP servers — https://mimo.xiaomi.com/zh/mimocode/mcp-servers  
[41] mimo-desktop-guide SKILL — 本机 engine-config skills/mimo-desktop-guide/SKILL.md [primary local]  
[42] Aider conventions — https://aider.chat/docs/usage/conventions.html  
[43] Claude Code plugins — https://code.claude.com/docs/en/plugins  
[44] Claude Code hooks — https://code.claude.com/docs/en/hooks  
[45] MCP changelog — https://modelcontextprotocol.io/specification/2026-07-28/changelog  
[46] MCP architecture — https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture  
[47] MCP design principles — https://modelcontextprotocol.io/community/design-principles  
[48] MCP tools spec — https://modelcontextprotocol.io/specification/2025-06-18/server/tools  
[49] MCP Skills extension SEP-2640 — https://modelcontextprotocol.io/extensions/skills/overview  
[50] MCP Registry — https://modelcontextprotocol.io/registry/about  
[51] Agent Skills — https://agentskills.io/  
[52] Agent Skills specification — https://agentskills.io/specification  
[53] Claude Code skills — https://code.claude.com/docs/en/skills  
[54] ACP architecture — https://agentclientprotocol.com/overview/architecture  
[55] OpenAI Agents SDK README — https://github.com/openai/openai-agents-python [single source, medium]  
[56] Supermemory PR #1683 — https://github.com/supermemoryai/supermemory/pull/1683 (2026-09-18)  
[57] MiMo-Code issue #2426 — https://github.com/XiaomiMiMo/MiMo-Code/issues/2426 (2026-09-18)  
[58] Supermemory MCP UX blog — https://supermemory.ai/blog/the-ux-and-technicalities-of-awesome-mcps/ (2025-06-08)  
[59] HN Algolia MCP security/bloat — https://hn.algolia.com/api/v1/search?query=MCP%20context%20bloat%20tools%20agents&hitsPerPage=10 ; https://hn.algolia.com/api/v1/search_by_date?query=MCP%20security%20vulnerability&tags=story&hitsPerPage=10 [community]  
[60] Supermemory OpenClaw memory analysis — https://supermemory.ai/blog/why-everyone-is-complaining-about-openclaws-memory-it-sucks-and-why-supermemory-fixes-it (2026-02-19)  
[61] HN Algolia supermemory — https://hn.algolia.com/api/v1/search?query=supermemory&hitsPerPage=20 [community]  
[62] Supermemory product update — https://supermemory.ai/blog/an-update-to-supermemory (2026-09-10)  
[63] MiMo-Code issue #2428 — https://github.com/XiaomiMiMo/MiMo-Code/issues/2428 (2026-09-18) [single source, medium]  

**补充记忆层一手文档（对比表引用）**  
[64] Mem0 how-it-works — https://docs.mem0.ai/core-concepts/how-it-works  
[65] Mem0 MCP — https://docs.mem0.ai/platform/mem0-mcp  
[66] Mem0 llms.txt / agent-plugin-core — https://docs.mem0.ai/llms.txt  
[67] Letta memory blocks — https://docs.letta.com/v1-sdk/memory/memory-blocks/  
[68] Letta Agent SDK memory (MemFS) — https://docs.letta.com/agent-sdk/memory/  
[69] Letta V1 vs V2 — https://docs.letta.com/v1-sdk/  
[70] Zep concepts — https://help.getzep.com/concepts  
[71] Zep graph overview — https://help.getzep.com/graph-overview  
[72] Zep implement with agents — https://help.getzep.com/implement-zep-with-agents  
[73] cognee overview — https://docs.cognee.ai/core-concepts/overview  
[74] OpenCode skills（跨工具路径）— https://opencode.ai/docs/skills/  
[75] OpenCode MCP — https://opencode.ai/docs/mcp-servers/  
[76] Cursor plugins — https://cursor.com/docs/plugins  
[77] Cursor rules — https://cursor.com/docs/context/rules  
[78] Cursor MCP — https://cursor.com/docs/context/mcp  
[79] Cline rules/plugins — https://docs.cline.bot/customization/cline-rules.md  
[80] Devin memories/rules — https://docs.devin.ai/desktop/cascade/memories  
[81] Continue rules — https://docs.continue.dev/customize/deep-dives/rules  

---

## Journey log / 研究过程说明

- 深度：deep；7 个并行角度（F1–F7），0 次 follow-up（覆盖已足够）。
- WebSearch 不可用 → 全部改为一手 URL 定向抓取；GitHub HTML/raw 偶发传输错误时改用 GitHub Contents API / npm / 本机已安装包。
- findings 明细：`findings/F1.md`…`F7.md`（共约 107 条 sourced claims）。
