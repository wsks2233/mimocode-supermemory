---
name: supermemory-logout
description: Clear local Supermemory credentials for mimocode-supermemory. Use when the user runs /supermemory-logout, wants to disconnect Supermemory, remove API key, or "退出 Supermemory 登录".
---

# supermemory-logout

Remove local Supermemory credentials only (keep plugin install).

1. Delete `~/.supermemory-mimocode/credentials.json` if present
2. Clear `apiKey` from `~/.config/mimocode/supermemory.jsonc`
3. Node path: `node "{{CLI}}" logout`
4. **Never** run bare `{{PS1}}` for logout (no `-Logout` switch; that reinstalls)
5. Mention env `SUPERMEMORY_API_KEY` may still be set
6. Never print key material; suggest `/supermemory-login` to reconnect
