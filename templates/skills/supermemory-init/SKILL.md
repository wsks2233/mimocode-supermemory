---
name: supermemory-init
description: Index the current codebase into Supermemory persistent memory. Use when the user runs /supermemory-init or /supermemory-index, says "index this project into memory", "initialize supermemory", "记住这个项目", or asks to explore and memorize architecture, build commands, and conventions for future sessions.
---

# supermemory-init

Deep-index this project into Supermemory via the `supermemory` tool (plugin `mimocode-supermemory`).

## Do this

1. Prefer the installed slash command body when present: `/supermemory-init` or `/supermemory-index` (global commands under `~/.config/mimocode/commands/`).
2. If the command file is missing, follow the same workflow here:
   - `supermemory mode=list scope=project` first
   - Research README / AGENTS.md / package manifests / CI / git history / key dirs
   - `supermemory mode=add` one insight at a time with prefixes:
     - `[project-config]`, `[architecture]`, `[learned-pattern]`, `[error-solution]`
     - preferences → `scope=user`
3. No secrets. No full-file dumps.
4. Report what was saved and offer refinement.

## Tool modes

`search` · `add` · `profile` · `list` · `forget` · `help`

Optional args: `scope=user|project`, `id` (forget).

## Related

- `/supermemory-status` — readiness
- `/supermemory-login` — OAuth
- Skill `mimocode-supermemory` — overall tool guide
