---
description: Clear local Supermemory credentials for this machine
agent: build
---

# Supermemory logout

Clear locally stored Supermemory credentials for `{{PKG}}`.

## Preferred (Windows, no Node required)

**Do not run `install.ps1` for logout** — there is no `-Logout` switch; bare `install.ps1` would reinstall.

Clear local credentials carefully:

1. Delete credential file if present:
   - `%USERPROFILE%\.supermemory-mimocode\credentials.json`
2. Clear `apiKey` (and optionally `baseUrl`) from:
   - `%USERPROFILE%\.config\mimocode\supermemory.jsonc`
3. Do **not** delete the plugin package, `plugin[]` entry, or command/skill files.

If Node is available (preferred automated path):

```bash
node "{{CLI}}" logout
```

Package install path for reference only (not for logout):

```text
{{PS1}}
```

## Report

- Say whether a credentials file was found and removed.
- Note if `SUPERMEMORY_API_KEY` is still set in the environment (plugin may stay connected until unset / restart).
- Never print key material.

## Re-login

Suggest `/supermemory-login` afterward.
