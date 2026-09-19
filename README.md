# mimocode-supermemory

给 **MiMoCode / MiMo Desktop** 提供接近原生的 Supermemory 记忆插件能力。

以开源 [`opencode-supermemory`](https://github.com/supermemoryai/opencode-supermemory) 为参考实现（MIT），改接到 MiMoCode 的 [`@mimo-ai/plugin`](https://github.com/XiaomiMiMo/MiMo-Code) 宿主 API：同构 `Plugin → Hooks`，配置与落盘路径对齐 `.mimocode` / `~/.config/mimocode`。

## 现状

| 项 | 状态 |
|----|------|
| 项目骨架 / 类型契约 | 已就绪 |
| Supermemory 读写与注入 | 实现中（见 `src/`） |
| `permission.ask` 自动放行 | 受宿主限制：钩子已定义但尚未接线，先写向前兼容逻辑 |
| Compaction | 使用 MiMo 宿主 `experimental.session.compacting`，**不**接管宿主 summarize 所有权 |
| 双通道安装 | npm `plugin[]` + `.mimocode` 落盘模板 |

## 架构（目标）

```text
MiMoCode / MiMo Desktop
        │
        ├─ plugin[] / .mimocode/hooks|tools   ← 本仓库
        │         │
        │         ├─ chat.message  首回合注入 + 每回合 recall 指令
        │         ├─ event / session.*  会话 capture
        │         ├─ tool.supermemory   add|search|profile|list|forget
        │         └─ experimental.session.compacting  协同压缩（只追加 context）
        │
        └─ Supermemory Memory API
              POST /v3/documents · /v4/search · /v4/profile
              containerTag = repo_{name}__{hash(git origin)}
```

## 规范 API（集成契约）

- 鉴权：`Authorization: Bearer $SUPERMEMORY_API_KEY`
- 写入：`POST /v3/documents`
- 召回：`POST /v4/search`（推荐 `searchMode: "hybrid"`）
- 画像：`POST /v4/profile`
- 隔离：JSON body 单数 `containerTag`（勿用复数）

自托管：`npx supermemory local`，将 `baseUrl` / `SUPERMEMORY_API_URL` 指到 `http://localhost:6767`。

## 安装（规划）

### 通道 A — npm 插件（原生向）

```jsonc
// ~/.config/mimocode/mimocode.jsonc
{
  "plugin": ["mimocode-supermemory"]
}
```

### 通道 B — 落盘到 `.mimocode`（保证可用）

```text
.mimocode/tools/supermemory.ts          ← 自定义 tool
.mimocode/hooks/mimocode-supermemory.ts ← Hooks
.mimocode/skills/mimocode-supermemory/SKILL.md
```

模板见 [`templates/`](./templates)。

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
