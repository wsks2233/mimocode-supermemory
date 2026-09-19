# Compose Spec

| Feature | Doc |
|---------|-----|
| plugin-module | [plugin-module.md](./plugin-module.md) |
| elegant-install | [elegant-install.md](./elegant-install.md) |

**Canonical runtime artifact**: `dist/index.js` (PluginModule `{ id, server }`).
**Canonical installer**: `install.ps1` (Windows) + `bin/cli.js` (npx/Node).

Do not overwrite `dist/` from `src/` until src is fully aligned.
