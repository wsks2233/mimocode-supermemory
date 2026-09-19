# Research Brief: 给 MiMoCode / MiMo Desktop 装上接近原生的插件能力

## Refined question

如何为 MiMoCode（以及 MiMo Desktop）构建一套插件能力层，使其在扩展体验上接近 Claude Code / Cursor / OpenCode 等 coding agent 的「原生插件」水平？本轮调研以 Supermemory、opencode-supermemory、MiMo-Code 三份一手材料为锚点，并横向对比主流 agent 的插件/记忆/扩展架构，为后续项目设计（compose-next Grill/Spec）提供证据。

## Scope boundaries

### In scope
- Supermemory 产品形态、Memory API、与 coding agent 的集成模型
- `opencode-supermemory` 的插件接线方式（hooks / tools / memory injection）
- MiMoCode 与 MiMo Desktop 现有的扩展面（MCP、skills、hooks、config、session-chat 等）
- 主流 coding agent 的「原生插件」体验与技术实现（Claude Code、Cursor、OpenCode、Continue、Cline 等）
- 记忆层作为一等公民能力的模式（supermemory / mem0 / letta / zep 等）
- 标准与协议：MCP、ACP、skills/commands、工具注入
- 实践者反馈：扩展 coding agent 时的痛点与失败案例

### Out of scope
- 本阶段不做代码实现、不写 feature spec、不建 worktree
- 不评估商业定价/SLA（除非直接影响架构选型）
- 不调研与 agent 扩展无关的通用后端/SaaS 技术

## Assumptions
- 用户目标项目将落在当前空仓库 `F:\代码\mimocode-supermemory`（greenfield，尚无 git 历史）
- 「接近原生」指：安装/发现/配置/调用路径短、状态进入 agent 上下文自然、错误与权限可预期、像官方能力而非外挂脚本
- Supermemory 是用户关注的**首个/代表性**插件场景（记忆），但项目野心可能是更通用的插件宿主/适配层
- 调研时间锚点：2026-09-19；优先近 12–18 个月材料
- 用户消息中「和其他 agent…」一句被截断，按「其他主流 coding agent 的原生插件能力」理解

## Depth mode
**deep**（5–8 sub-agents，≤2 follow-up rounds，目标 25+ sources）

## Today
2026-09-19

## Workspace
`research/mimocode-native-plugins/`

## Angles

| ID | Angle | 目的 |
|----|-------|------|
| F1 | Supermemory 产品与 Memory API 架构：文档、集成入口、数据模型、与 agent 的契约 | 搞清「记忆服务」作为插件时对外暴露什么 |
| F2 | `opencode-supermemory` 集成模式：插件生命周期、hook 点、工具/上下文注入方式 | 提取可复制的「把第三方能力装进 coding agent」参考实现 |
| F3 | MiMoCode / MiMo Desktop 现状：已有的 MCP、skills、hooks、配置、会话能力与缺口 | 明确宿主今天有什么、缺什么才能「原生插件」 |
| F4 | 主流 coding agent 插件生态：Claude Code / Cursor / OpenCode / Continue / Cline 等如何做扩展 | 定义「接近原生」的体验基线与技术路径 |
| F5 | Agent 记忆层横向对比：supermemory vs mem0 / Letta / Zep 等，以及它们如何挂到 coding agent | 若项目含记忆插件，架构上有哪些可选形态 |
| F6 | 标准与协议：MCP 全貌、ACP、skills/commands 模式、工具与资源注入规范 | 判断「原生插件」应绑定哪些标准、自研边界在哪 |
| F7 | 实践者经验与反例：GitHub issues / 社区里扩展 agent 时的真实失败点 | 避免重蹈覆辙，收集设计约束 |

## Relationship to compose-next
- 本轮 **pipeline 第一棒 = deep-research**，唯一交付物：`research/mimocode-native-plugins/REPORT.md`
- 报告落地后，再进入 compose-next 的 Grill（用证据收敛插件宿主 vs 单点适配等决策）→ Workspace → Spec → Implement
- 冲突解决：调研过程与报告归 deep-research；项目规格/工作区/提交归 compose-next

## Audience
项目开发者（用户本人 + 后续 agent）：需要可落地的架构证据，而非科普综述。
