---
description: Authenticate with Supermemory via browser OAuth
agent: build
---

# Supermemory login

Help the user authenticate the `{{PKG}}` plugin with Supermemory.

## Run the installer login

Prefer the PowerShell installer (works on Windows hosts without Node):

```powershell
powershell -ExecutionPolicy Bypass -File "{{PS1}}" -Login
```

If Node is available, this is equivalent:

```bash
node "{{CLI}}" login
```

What success looks like:

1. Local callback listens on `http://127.0.0.1:<port>/callback`
2. Browser opens `https://console.supermemory.ai/auth/connect?...&client=mimocode`
3. Credentials saved to `%USERPROFILE%\.supermemory-mimocode\credentials.json` (or `~/.supermemory-mimocode/credentials.json`)
4. API key also mirrored into `~/.config/mimocode/supermemory.jsonc` (`apiKey`)
5. Key must start with `sm_`

## After the command

- Tell the user whether login succeeded or failed.
- Remind them to **restart MiMoCode / start a new Desktop session** so the plugin reloads credentials.
- Suggest `/supermemory-status` to verify.
- **Never print the full API key.** Masking like `sm_abcd...wxyz` only.

## Fallback

If browser OAuth cannot run, point the user to https://console.supermemory.ai/keys and set:

```powershell
[System.Environment]::SetEnvironmentVariable("SUPERMEMORY_API_KEY", "sm_...", "User")
```

or place the key in `~/.config/mimocode/supermemory.jsonc`.

## Logout

If the user wants to log out instead, run `/supermemory-logout`.
