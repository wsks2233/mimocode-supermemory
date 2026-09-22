# Upstream: MiMoCode / MiMo Desktop host gaps (backlog #7)

> Source: `mimocode-supermemory` (plugin for Supermemory on MiMoCode).  
> Host verified: **MiMoCode 0.1.14**, Windows (VM + desktop).  
> Plugin channel in use: `plugin: ["mimocode-supermemory"]` → `%USERPROFILE%\.cache\mimocode\packages\mimocode-supermemory@latest\node_modules\dist\index.js`.

This file is the **issue-ready** writeup for three host-side gaps. The plugin remains forward-compatible and does **not** depend on these being fixed to load or capture memory.

---

## Issue 1 — Wire `permission.ask` into the runtime permission system

### Title

`permission.ask` plugin hook is declared but not wired — plugins cannot auto-allow their own tools

### Body

**Summary**

`@mimo-ai/plugin` (0.1.14) documents a `permission.ask` hook (“Auto-allow/deny permission requests (not yet wired)”). Implementing the hook has **no effect**: the host never consults it when deciding tool permissions.

**Why it matters**

Memory/recall plugins (e.g. OpenCode’s `opencode-supermemory`) rely on `permission.ask` so that *reasoned recall* — a silent `supermemory mode=search` before answering — is zero-friction. Without wiring:

- every recall search can prompt the user (or be skipped to avoid prompts)
- “native” memory UX cannot match OpenCode / Claude Code Supermemory plugins
- plugin authors cannot implement least-privilege allow rules for *their own* tools

**Expected**

1. When a plugin registers `permission.ask`, the host calls it before prompting for that tool (or merges its decision into the allow/deny path).
2. Payload includes at least `tool` and tool `args` (so plugins can allow `mode=search` but not arbitrary tools).
3. Hook can set `status` to `allow` | `deny` | (leave unset → fall through to user/config).
4. Documented in public plugin/hook docs (today the type exists but is marked not wired).

**Reference implementation (already in the wild)**

```js
"permission.ask": async (permission, output) => {
  // never throw; only allow our own tool
  if (permission?.tool === "supermemory") output.status = "allow";
}
```

See also: OpenCode plugin hook `permission.ask` + `isSupermemoryRecallSearch` in `supermemoryai/opencode-supermemory`.

**Repro (high level)**

1. Load any `plugin[]` module that returns `"permission.ask"` and sets `output.status = "allow"` for its custom tool.
2. Invoke that tool in a session under a permission mode that would normally ask.
3. Observe: host still asks / does not apply the hook (hook never fires in logs).

**Environment**

- MiMoCode `0.1.14`
- Windows (also observed via SSH/headless `mimo run` where session allows)

---

## Issue 2 — Windows file-hook loader fails (`.mimocode/hooks/*.ts`)

### Status

**Already tracked upstream** — do not open a duplicate:

| Issue | Title |
|-------|--------|
| [#1753](https://github.com/XiaomiMiMo/MiMo-Code/issues/1753) | File hooks fail to load on Windows v0.1.6 (Bun.build cannot find compiled .mjs) |
| [#1813](https://github.com/XiaomiMiMo/MiMo-Code/issues/1813) | Windows 下文件 hook 全部加载失败：动态 import 使用了非 file:// 的反斜杠绝对路径 |

**Comment filed (0.1.14 still broken):** [#1813 comment](https://github.com/XiaomiMiMo/MiMo-Code/issues/1813#issuecomment-5769916043)

### Title (if a new tracker is required)

Windows: file hooks fail to load (`Cannot find module '...ts.<ts>.mjs'` / `Bundle failed`)

### Body

**Summary**

On Windows, MiMoCode 0.1.14 cannot load project/global file hooks under `.mimocode/hooks/*.ts` (or bundled `.js`). Logs show:

```text
ERROR service=plugin path=...\hooks\minproof.ts
  error=Cannot find module '...\minproof.ts.<timestamp>.mjs'
  failed to load file hook

ERROR service=plugin path=...\mimocode-supermemory.js
  error=Bundle failed failed to load file hook
```

A **214-byte** minimal hook (no `node:fs`, no imports) fails the same way — so this is the loader/transpile/temp-file path, not application code.

**Expected**

- File hooks under `.mimocode/hooks/` load on Windows the same as other platforms (stable temp/module path, correct extension resolution).
- Errors include the resolved path and stage (transpile / write temp / import) when they fail.

**Workaround used by plugins today**

Ship a **module plugin** via `plugin: ["name"]` + host package cache instead of file hooks. File hooks remain a documented channel and should work.

**Repro**

1. Windows + MiMoCode 0.1.14  
2. Place a minimal `export default { "chat.message": async () => {} }` hook in `.mimocode/hooks/minproof.ts`  
3. Start a session / `mimo run`  
4. Observe `failed to load file hook` with `Cannot find module '...mjs'` or `Bundle failed`

---

## Issue 3 — Desktop UI extension surface for plugins (feature request)

### Title

Desktop: no plugin UI extension surface (status / install / memory panel)

### Body

**Summary**

MiMo Desktop can discover skills (with `locales/`) and slash commands, but there is **no open UI extension surface** for plugins (e.g. memory status widget, install wizard, settings panel). TUI/CLI plugins and Electron Desktop stay product-siloed.

**Why it matters**

Official Supermemory integrations expose install/status/login UX and make memory “visible”. On Desktop-only setups, users cannot see whether memory is connected, which container tag is active, or trigger index/login without leaving the app.

**Expected (any reasonable subset)**

1. Documented way for a `plugin[]` module to contribute **read-only status** to Desktop (e.g. `status` JSON the host renders).  
2. **Or** a documented marketplace/Plugins page that surfaces plugin `description` + `status` command output.  
3. Keep TUI hooks and Desktop presentation consistent (same plugin package, not a second implementation).

**Non-goals for the plugin side**

Third-party packages cannot ship Electron UI today. This is tracked as a **host product** gap; plugin workarounds are limited to slash commands + skills + CLI `status`.

**Related**

- Cross-brand skill path discovery (`.claude/`, `.agents/`) is a related Desktop/host gap (optional separate issue).

---

## Filing status

| # | Topic | Issue URL | Action |
|---|--------|-----------|--------|
| 1 | permission.ask wiring | https://github.com/XiaomiMiMo/MiMo-Code/issues/2472 | **Created** 2026-09-22 |
| 2 | Windows file-hook loader | [#1753](https://github.com/XiaomiMiMo/MiMo-Code/issues/1753) / [#1813](https://github.com/XiaomiMiMo/MiMo-Code/issues/1813) | **Commented** on #1813 ([link](https://github.com/XiaomiMiMo/MiMo-Code/issues/1813#issuecomment-5769916043)); no duplicate |
| 3 | Desktop UI surface | https://github.com/XiaomiMiMo/MiMo-Code/issues/2473 | **Created** 2026-09-22 |

Prefer English for `XiaomiMiMo/MiMo-Code` unless the project requests Chinese.
