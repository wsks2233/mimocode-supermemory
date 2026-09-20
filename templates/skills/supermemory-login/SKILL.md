---
name: supermemory-login
description: Authenticate mimocode-supermemory with Supermemory browser OAuth. Use when the user runs /supermemory-login, asks to log in to Supermemory, connect API key, "登录 Supermemory", or status shows the API key missing.
---

# supermemory-login

Run Supermemory authentication for the MiMoCode plugin.

## Preferred command

```powershell
powershell -ExecutionPolicy Bypass -File "{{PS1}}" -Login
```

Node equivalent: `node "{{CLI}}" login`

## Expect

- Browser → `console.supermemory.ai/auth/connect?...&client=mimocode`
- Save `sm_...` to `~/.supermemory-mimocode/credentials.json`
- Mirror key into `~/.config/mimocode/supermemory.jsonc`
- Restart MiMoCode / new session after success
- Verify with `/supermemory-status`

Never print the full API key. Fallback: set `SUPERMEMORY_API_KEY` from https://console.supermemory.ai/keys
