---
description: Show Supermemory plugin install and connection status
agent: build
---

# Supermemory status

Check whether `{{PKG}}` is installed and connected.

## Run installer status

```powershell
powershell -ExecutionPolicy Bypass -File "{{PS1}}" -Status
```

If Node is available:

```bash
node "{{CLI}}" status
```

## What to report

Summarize for the user (do not dump secrets):

| Field | Meaning |
|-------|---------|
| package.json / dist/index.js | Cache package present |
| plugin[] | `mimocode-supermemory` listed in mimocode config |
| API key | Masked source (env / supermemory.jsonc / credentials.json) |
| commands / skills | Slash assets installed under `~/.config/mimocode/` |
| ready | YES only when package + plugin[] + key are OK |
| connected | Optional API check when key exists |

**Never print a full API key.**

## If not ready

1. Missing package/config → run `powershell -ExecutionPolicy Bypass -File "{{PS1}}"` (install)
2. Missing key → `/supermemory-login` or set `SUPERMEMORY_API_KEY`
3. Plugin loaded but no recall → restart MiMoCode after config changes; open the **project** directory (not an unrelated folder)

## Optional live check

You may also call `supermemory` tool `mode=profile` or `mode=help` when the plugin is loaded — JSON should mention `plugin: mimocode-supermemory`.
