# Compose Spec

| Feature | Doc |
|---------|-----|
| plugin-module | [plugin-module.md](./plugin-module.md) |
| elegant-install | [elegant-install.md](./elegant-install.md) |
| oauth-login | [oauth-login.md](./oauth-login.md) |
| native-memory-verify | [native-memory-verify.md](./native-memory-verify.md) |
| git-hash-tag | [git-hash-tag.md](./git-hash-tag.md) |
| keyword-auto-capture | [keyword-auto-capture.md](./keyword-auto-capture.md) |
| tool-forget-scope | [tool-forget-scope.md](./tool-forget-scope.md) |
| slash-commands | [slash-commands.md](./slash-commands.md) |
| npm-publish | [npm-publish.md](./npm-publish.md) |

**Runtime artifact**: `dist/index.js` (PluginModule `{ id, server }`) — built from `src/` via `npm run build` (esbuild).  
**Source of truth**: `src/` (TypeScript). `tsconfig.json` is `noEmit`; do not hand-edit `dist/`.  
**Publish gate**: `npm run prepublishOnly` = `check-src-contract` + `node --check` + `check-dist-parity`.  
**Installer**: `install.ps1` (Windows) + `bin/cli.js`. Write MiMo JSON configs **without UTF-8 BOM**.  
**npm**: https://www.npmjs.com/package/mimocode-supermemory — `mimo plugin mimocode-supermemory`
