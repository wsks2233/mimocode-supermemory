# T8 Test Report — mimocode-supermemory 0.3.3 (full chain)

## Environment (T0)

| Item | Value |
|------|--------|
| Date | 2026-09-25 |
| OS | Windows NT 10.0.19045 |
| MiMo | **0.1.15** |
| Node | **v24.21.0** |
| Package | **mimocode-supermemory 0.3.3** (asserted; installed via `mimo plugin`) |
| Model | `xiaomi/mimo-v2.6-pro` / `small` `xiaomi/mimo-v2.6-flash` |
| Supermemory key | present (masked in env.txt) |
| Backup | `C:\Users\wsks\sm-full-backup-20260925-123703` |
| Report dir | `C:\Users\wsks\sm-test-report-20260925-123634` |
| Network T0 | github **200**, npm registry **200**, api.supermemory.ai **000** (timeout at T0) |

## Results (T1–T8)

| ID | Result | Evidence |
|----|--------|----------|
| T0 | **PASS** | `env.txt` version freeze |
| T1 | **PASS** | Backup + `MANIFEST.txt` (credentials, supermemory.jsonc, mimocode configs, auth.json) |
| T2 | **PASS** | `install.ps1 -Uninstall`; credentials kept; slash cleaned |
| T3 | **PASS** | `mimo plugin` → **Installed mimocode-supermemory**; `install.ps1` slash write (file: Manifest ENOENT = host quirk, non-fatal) |
| T4 | **PASS** | status: package/dist/plugin/commands/skills OK · **ready YES** |
| T5 | **PASS** | Node api-loop **6/6**: add, search, forget (204+gone), keyword, compaction, profile |
| T6 | **BLOCKED** | `mimo run` → **EUNKNOWN** (host, 0.1.15); model config itself valid (`mimo models` listed 2.6) |
| T7 | **PASS** | uninstall: cache **gone**, commands **0**, **credentials + supermemory.jsonc retained** |
| T8 | **PASS** | This report |

## Security

- No full `sm_` / model API keys in report (masks only).
- After T7: `credentials.json` = present; Supermemory config key retained.

## Notes / defects observed

1. **T6 blocked by host `mimo run` EUNKNOWN** (PRE-EXISTING on this VM; not caused by plugin).
2. **`api.supermemory.ai` flaky from VM** (T0 timeout, T5 succeeded later) → treat as network unless persistent.
3. **`mimo plugin file:<nested cache>`** still prints Manifest ENOENT (host); stable path remains package-name + cache + plugin[].
4. **User-confirmed package version 0.3.3**; after T7 cache is intentionally removed so version is not re-readable from disk.

## Overall conclusion

**PASS with host-scoped block**

- Plugin install / slash / status / Supermemory API / uninstall: **all PASS** under frozen environment.
- **Not a plugin functional FAIL**: `mimo run` EUNKNOWN is host-side.
- Recommended follow-up: fix or track host `mimo run`; re-test T6 when host works; optional TUI `/supermemory-status` (out of scope this run).
