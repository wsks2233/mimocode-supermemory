---
feature: host-limits
status: in-progress
updated: 2026-09-22
branch: main
commits: <base-sha>..<head-sha>
---

# Host Limits & Upstream (backlog #7)

## Report

## [S1] Problem

MiMoCode 0.1.14 / Desktop has three host-side gaps that block “native plugin” parity with `opencode-supermemory` and cannot be closed from this plugin alone:

1. **`permission.ask` is declared in `@mimo-ai/plugin` Hooks but not wired** into the runtime permission system. Even a correct auto-allow hook is a no-op, so reasoned-recall `supermemory mode=search` still prompts (or is not auto-allowed).
2. **File-hook loader on Windows is broken** (`.mimocode/hooks/*.ts` → `Cannot find module ...ts.<ts>.mjs` / `Bundle failed`). Channel B templates cannot be the primary load path.
3. **Desktop has no open UI extension surface** for memory status / install beyond Plugins-page locales. Official hosts expose richer product surfaces.

Without explicit documentation and upstream tracking, future agents (and users) re-discover these limits, assume the plugin is broken, or “fix” by breaking design red lines (e.g. rewriting host compaction). The plugin must **not crash** when these features are missing, and when the host later wires `permission.ask`, search auto-allow must work **without changing business code**.

## [S2] Design

### 2.1 Plugin-side contract (forward-compatible only)

**`permission.ask`**

- Keep hook key `permission.ask` in `src/plugin.ts` / `dist/index.js` / `templates/hooks/mimocode-supermemory.ts`.
- **Decision (binding, user-approved):** auto-allow **all modes** of tool name `supermemory` only. Never auto-allow other tool names. Do **not** inspect `args.mode` (policy is tool-name based).
- **Never throw**: wrap body in try/catch; ignore missing `permission`/`output`; never mutate unrelated fields.
- No dependency on host actually calling the hook (presence is optional).

**Crash safety**

- All hooks already fail-soft (try/catch, early return without key). Keep that invariant; do not add host-only APIs that throw when unwired.

**Do not**

- Do not implement Desktop UI.
- Do not implement or depend on file-hook loading as primary path.
- Do not assume `permission.ask` is effective; docs must say “forward-compatible, may be no-op on current host”.

### 2.2 package.json host metadata (optional forward-compat)

Declare integration surface for hosts that read package metadata (mirrors `"opencode": { "type": "plugin", "hooks": [...] }`):

```json
"mimo": {
  "type": "plugin",
  "hooks": ["chat.message", "permission.ask", "experimental.chat.system.transform", "experimental.session.compacting", "session.post"]
}
```

Hosts that ignore unknown fields are unaffected.

### 2.3 Documentation

| Artifact | Role |
|----------|------|
| `docs/compose/spec/host-limits.md` | This spec (implementation + verification record) |
| `docs/UPSTREAM.md` | Issue-ready writeups for MiMoCode: permission.ask / file-hook / Desktop UI |
| `docs/compose/BACKLOG.md` #7 | Mark delivered with verification summary |
| `AGENTS.md` host limits section | Point to UPSTREAM + keep one-line facts |

Desktop UI appears **only** in `docs/UPSTREAM.md` (user decision: plugin side does not touch Desktop).

### 2.4 Upstream issues (external)

Open **three** issues on `XiaomiMiMo/MiMo-Code` (or note inability if no write access), bodies copied from `docs/UPSTREAM.md`:

1. Wire `permission.ask` plugin hook into the permission system  
2. Fix Windows file-hook loader (`.ts` → temp `.mjs`)  
3. Feature: Desktop UI extension surface for plugins (memory status / install)

Acceptance for the issue step: each issue is created with a stable URL **or** failure is recorded and drafts remain in `docs/UPSTREAM.md` for manual filing.

### 2.5 Acceptance criteria (from BACKLOG #7)

- **A1** Plugin loads and runs without crash when `permission.ask` / file-hooks / Desktop UI are absent (existing fail-soft paths; contract/parity/`node --check` PASS).
- **A2** `permission.ask` implements supermemory auto-allow in a host-agnostic way; **no business-code change** is required when host later wires the hook.
- **A3** Host limits and Desktop non-goals are documented; UPSTREAM has three issue-ready sections.
- **A4** Issues are filed on MiMoCode **or** filing failure is recorded with drafts retained.

## [S3] Out of Scope

- Implementing Desktop UI, memory dashboard, or any Electron/Desktop extension.
- Fixing MiMoCode’s file-hook loader or `permission.ask` wiring in the host.
- Changing compaction ownership, capture semantics, containerTag, or tool modes.
- npm version bump / publish (optional follow-up; not required for #7).
- Actually depending on host calling `permission.ask` in tests on current MiMoCode.

## Tasks

- [ ] T1: Harden `permission.ask` in `src/plugin.ts` + `templates/hooks/mimocode-supermemory.ts` (tool-name based, crash-safe) — acceptance: source allows all modes of tool `supermemory`; try/catch never throws (covers: S2.1)
- [ ] T2: Rebuild `dist` via `npm run build:dist` and confirm parity — acceptance: `npm run test:contract` + `npm run verify-syntax` PASS; dist contains hardened `permission.ask` (covers: S2.1; depends: T1)
- [ ] T3: Add `package.json` `mimo` hooks metadata — acceptance: JSON valid; hooks list matches plugin surface (covers: S2.2)
- [ ] T4: Write `docs/UPSTREAM.md` (3 issue bodies) — acceptance: sections for permission.ask / file-hook / Desktop UI with repro and ask (covers: S2.3, S2.4)
- [ ] T5: Write this spec’s design through Report skeleton is already present; update `docs/compose/BACKLOG.md` #7 + `AGENTS.md` cross-links — acceptance: #7 status filled; AGENTS points to UPSTREAM (covers: S2.3; depends: T4)
- [ ] T6: File three issues on `XiaomiMiMo/MiMo-Code` or record failure — acceptance: URLs in UPSTREAM/Report **or** explicit blocked note (covers: S2.4; depends: T4)
- [ ] T7: Verify — acceptance: typecheck/build/contract/parity/verify-syntax PASS with fresh output (covers: S2.5)
- [ ] T8: Review — acceptance: independent review of A1–A4 with criticals fixed (covers: S2.5; depends: T7)
