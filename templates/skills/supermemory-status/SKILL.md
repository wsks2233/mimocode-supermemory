---
name: supermemory-status
description: Check mimocode-supermemory install readiness and connection. Use when the user runs /supermemory-status, asks whether Supermemory is installed/connected/ready, or "检查 Supermemory 状态".
---

# supermemory-status

Report plugin readiness without leaking secrets.

```powershell
powershell -ExecutionPolicy Bypass -File "{{PS1}}" -Status
```

Node: `node "{{CLI}}" status`

Report: cache package, `plugin[]`, masked API key source, commands/skills presence, `ready YES/NO`, optional connected check.

**Never print a full API key.**

If not ready: install via `{{PS1}}`, then `/supermemory-login`, restart MiMo, open the real project directory.
