---
name: mimocode-supermemory
description: Supermemory persistent memory for MiMoCode — recall prior project context, save durable decisions, inspect profile, index a codebase. Trigger when the user asks about past work, conventions, "what did we decide", or mentions Supermemory / supermemory tool / supermemory-init / supermemory-status.
---

# mimocode-supermemory

Host plugin channel: `plugin: ["mimocode-supermemory"]` (canonical runtime `dist/index.js`).

## Slash / skill entries

| Entry | Purpose |
|-------|---------|
| `/supermemory-index` · `/supermemory-init` | Deep-index this codebase into memory |
| `/supermemory-login` | Browser OAuth |
| `/supermemory-logout` | Clear local credentials |
| `/supermemory-status` | Install/connection readiness |

Installer also copies these under `~/.config/mimocode/commands/` and skills under `~/.config/mimocode/skills/`.

## `supermemory` tool modes

| Mode | Args | Purpose |
|------|------|---------|
| help | — | Usage; JSON includes `plugin: mimocode-supermemory` |
| search | `query`, `scope?` | Hybrid search in current containerTag |
| add | `content`, `scope?` | Store durable fact (`taskType` memory) |
| profile | — | Profile snapshot |
| list | `scope?` | List/search stored documents when API allows |
| forget | `id`, `scope?` | search → documentId → DELETE `/v3/documents/{id}` |

Optional: `scope=user|project` (writes `sm_scope`), `id` for forget.

Category prefixes in `content` when helpful: `[project-config]`, `[architecture]`, `[learned-pattern]`, `[error-solution]`, `[preference]`.

## When to use

- User refers to earlier work, decisions, or preferences
- Task spans sessions
- Need project context before proposing changes
- Explicit request to index / remember / forget

## Do not

- Dump entire search results to the user
- Save secrets or private personal data
- Call search on every trivial message
- Assume `permission.ask` auto-allow works on all host versions
