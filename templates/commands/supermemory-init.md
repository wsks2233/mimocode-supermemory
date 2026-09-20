---
description: Alias of /supermemory-index — explore and memorize this codebase
agent: build
---

# Indexing codebase into Supermemory

You are initializing **persistent Supermemory memory** for this codebase via the plugin `{{PKG}}`. This is not data collection theater — you are building context that should make future sessions materially better.

## Tool contract (use this exactly)

Call the host tool `supermemory`:

| Mode | Args | Purpose |
|------|------|---------|
| `list` | `scope?: "project"\|"user"` | What is already stored |
| `search` | `query`, `scope?` | Check before duplicating |
| `add` | `content`, `scope?: "project"\|"user"` | Store one distinct insight |
| `profile` | — | User profile snapshot |
| `forget` | `id`, `scope?` | Remove a memory if you stored junk |

There is **no** `type` argument. Encode category as a prefix inside `content`:

- `[project-config]` — stack, commands, tooling, env layout
- `[architecture]` — modules, data flow, key directories
- `[learned-pattern]` — repo-specific conventions
- `[error-solution]` — known failures and fixes
- `[preference]` — coding/communication preferences (`scope: "user"`)

Example:

```text
supermemory mode=add scope=project content="[project-config] Build/test: npm run verify-syntax only (no tsc build). Plugin runtime is dist/index.js."
```

## Scopes

- **project** (default): architecture, build/test, team conventions, tech choices, known issues for *this* repo.
- **user**: personal preferences that still help in this project (tone, depth, style).

Do **not** store secrets, API keys, tokens, private personal data, or full transcripts.

## Research approach

This is a **deep** initialization (official opencode-supermemory parity). Prefer thoroughness over a 30-second skim. Aim for a coherent set of distinct memories, not one giant dump.

1. **Upfront** (skip if the user already answered): ask about hard rules, communication preference, and depth if the human is present. If running from a slash command with no human pause, continue with defaults and report what you assumed.
2. **Existing memories first**: `supermemory mode=list scope=project` (and `search` for obvious topics). Incrementally update/add; do not blindly re-add duplicates.
3. **Ecosystem auto-detect** before deep dives — do not assume JS/TS:
   - JS/TS: package.json, lockfiles, tsconfig
   - Python: pyproject.toml, requirements.txt, setup.py
   - Go / Rust / .NET / Java / Ruby / PHP / etc. manifests
   - MiMo/agent: AGENTS.md, `.mimocode/`, CLAUDE.md, README
4. **File-based**: README, CONTRIBUTING, AGENTS.md, package manifests, lint/format configs, CI (`.github/workflows/`), docs.
5. **Git-based** (if git works): `git log --oneline -20`, branch layout, commit style, shortlog.
6. **Explore structure**: key directories, entrypoints, how modules connect; read actual files, not only names.
7. **Save incrementally** as you learn (one insight per `add` when possible).
8. **Reflect**: cover commands, architecture, conventions, gotchas? Are memories concise and searchable?
9. **Summarize to the user**: how many insights saved, top themes, offer to refine.

## Quality bar

Good:

- `[project-config] Test entry: node --check dist/index.js && node --check bin/cli.js. Do not run tsc into dist/ until src is aligned.`
- `[architecture] Canonical plugin runtime is dist/index.js; src/ is a TS draft. Host loads cache package-name path.`

Bad:

- Vague vibes with no command/path
- Secrets or personal data
- Copy-pasting entire files into one memory

## Task checklist

1. List existing project memories
2. Detect ecosystem(s)
3. Research (files + git + structure)
4. `add` distinct insights with category prefixes
5. Reflect and report to the user

When finished, tell the user they can re-run `/supermemory-init` / `/supermemory-index` later, check `/supermemory-status`, or search with the `supermemory` tool.
