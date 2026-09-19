---
name: mimocode-supermemory
description: Use Supermemory persistent memory in MiMoCode — recall prior project context, save durable decisions, inspect profile. Trigger when the user asks about past work, conventions, or "what did we decide".
---

# mimocode-supermemory

This host uses the `supermemory` tool (plugin[] module preferred).

## Modes

| Mode | Params | Purpose |
|------|--------|---------|
| help | — | Show usage; JSON includes `plugin: mimocode-supermemory` |
| search | query | Hybrid search in current containerTag |
| add | content | Store durable fact (taskType memory) |
| profile | — | Profile snapshot |
| list | — | List documents (if API available) |

No `scope` / `forget` in the current module tool (v0.1).

## When to use

- User refers to earlier work, decisions, or preferences
- Task spans sessions
- Need project context before proposing changes

## Do not

- Dump entire search results to the user
- Save secrets
- Call search on every trivial message
