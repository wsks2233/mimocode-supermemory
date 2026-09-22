---
feature: host-limits
status: delivered
updated: 2026-09-22
branch: main
commits: 16dc4de5634ca3ad1cf162620bd16400ed6ca79b..1d71cee2fa4763026ccfc81d55c6cca82b3a1a4d
---

# Host Limits & Upstream (backlog #7)

## Report

**What was built** — Plugin-side host-limits work for backlog #7: `permission.ask` is hardened as **forward-compatible** (try/catch never throws; auto-allow **all modes** of tool name `supermemory` only). The same policy is in `src/plugin.ts`, rebuilt `dist/index.js`, and Channel B `templates/hooks/mimocode-supermemory.ts`. `package.json` declares a `mimo.hooks` integration surface (module plugin; Channel B templates omit `session.post` by design). Desktop UI is **not** implemented in the plugin — only tracked upstream. `docs/UPSTREAM.md` carries three issue-ready writeups and the filing table.

**Upstream filing** — On `XiaomiMiMo/MiMo-Code`: [**#2472**](https://github.com/XiaomiMiMo/MiMo-Code/issues/2472) wire `permission.ask`; [**#2473**](https://github.com/XiaomiMiMo/MiMo-Code/issues/2473) Desktop plugin UI surface. File-hook loader already tracked ([#1753](https://github.com/XiaomiMiMo/MiMo-Code/issues/1753), [#1813](https://github.com/XiaomiMiMo/MiMo-Code/issues/1813)); added [0.1.14 still-repro comment](https://github.com/XiaomiMiMo/MiMo-Code/issues/1813#issuecomment-5769916043) instead of a duplicate.

**Verification** — `npm run typecheck` PASS · `npm run test:contract` PASS (`SRC_CONTRACT_OK` 10 ts files; `PARITY_OK` dist) · `npm run verify-syntax` PASS. Contract tokens pin `permission.ask` + `toolName === "supermemory"` and reject missing try/catch. Independent review: **PASS**, A1–A4 met, no critical/major (minors: doc wording cleaned in this finalize; contract token added; residual risk = host may nest tool name — unverifiable until `permission.ask` is wired).

**Journey log**

1. File-hook issues already existed (#1753/#1813) — searched before filing; commented instead of duplicating.
2. Binding `permission.ask` policy is **all supermemory modes**, not official search-only (user decision); do not narrow later without new Grill.
3. Desktop UI intentionally **out of plugin scope** (user decision) — only UPSTREAM + #2473.
4. `npm install` was required in this checkout before `build:dist` (missing `node_modules`); Windows Node at `E:\Program Files\nodejs`.
5. Reviewer could not run `git diff` (subagent `bash` blocked) — current-tree review + parent verification still sufficient for PASS.

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

Hosts that ignore unknown fields are unaffected. Channel B `templates/hooks` omit `session.post` (module plugin is the real load path).

### 2.3 Documentation

| Artifact | Role |
|----------|------|
| `docs/compose/spec/host-limits.md` | This spec (implementation + verification record) |
| `docs/UPSTREAM.md` | Issue-ready writeups for MiMoCode: permission.ask / file-hook / Desktop UI |
| `docs/compose/BACKLOG.md` #7 | Mark delivered with verification summary |
| `AGENTS.md` host limits section | Point to UPSTREAM + keep one-line facts |

Desktop UI appears **only** in `docs/UPSTREAM.md` and host non-goals text (user decision: plugin side does not touch Desktop).

### 2.4 Upstream issues (external)

Open **three** issues on `XiaomiMiMo/MiMo-Code` (or note inability if no write access), bodies copied from `docs/UPSTREAM.md`:

1. Wire `permission.ask` plugin hook into the permission system → **#2472**
2. Fix Windows file-hook loader (`.ts` → temp `.mjs`) → **link #1753/#1813 + comment**
3. Feature: Desktop UI extension surface for plugins (memory status / install) → **#2473**

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

- [x] T1: Harden `permission.ask` in `src/plugin.ts` + `templates/hooks/mimocode-supermemory.ts` (tool-name based, crash-safe) — acceptance: source allows all modes of tool `supermemory`; try/catch never throws (covers: S2.1)
- [x] T2: Rebuild `dist` via `npm run build:dist` and confirm parity — acceptance: `npm run test:contract` + `npm run verify-syntax` PASS; dist contains hardened `permission.ask` (covers: S2.1; depends: T1)
- [x] T3: Add `package.json` `mimo` hooks metadata — acceptance: JSON valid; hooks list matches plugin surface (covers: S2.2)
- [x] T4: Write `docs/UPSTREAM.md` (3 issue bodies) — acceptance: sections for permission.ask / file-hook / Desktop UI with repro and ask (covers: S2.3, S2.4)
- [x] T5: Update `docs/compose/BACKLOG.md` #7 + `AGENTS.md` cross-links — acceptance: #7 status filled; AGENTS points to UPSTREAM (covers: S2.3; depends: T4)
- [x] T6: File three issues on `XiaomiMiMo/MiMo-Code` or record failure — acceptance: URLs in UPSTREAM/Report **or** explicit blocked note (covers: S2.4; depends: T4)
- [x] T7: Verify — acceptance: typecheck/build/contract/parity/verify-syntax PASS with fresh output (covers: S2.5)
- [x] T8: Review — acceptance: independent review of A1–A4 with criticals fixed (covers: S2.5; depends: T7)
