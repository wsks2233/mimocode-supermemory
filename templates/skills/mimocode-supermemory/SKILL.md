---
name: mimocode-supermemory
description: Use Supermemory persistent memory in MiMoCode — recall prior project context, save durable decisions, inspect profile. Trigger when the user asks about past work, conventions, or "what did we decide".
---

# mimocode-supermemory

This project uses the `supermemory` tool for long-term memory.

## When to use

- The user refers to earlier work, decisions, or preferences
- A task spans sessions or depends on project conventions
- You need the personal/project profile before proposing changes

## How

1. Call `supermemory` with `mode: "search"` and a focused query when recall may help.
2. Call `mode: "profile"` for always-on user/project summary.
3. Call `mode: "add"` only for durable facts (decisions, preferences, constraints) — not chat noise.
4. Scope: default `project` for repo knowledge, `user` for personal preferences.

## Do not

- Dump entire search results into the user-visible answer
- Save secrets or credentials to memory
- Call search on every trivial message
