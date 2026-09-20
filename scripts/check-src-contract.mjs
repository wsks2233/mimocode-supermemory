/**
 * Static src contract checks (pre-build).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const srcDir = join(root, "src");
const errors = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

const files = walk(srcDir);
let all = "";
for (const f of files) {
  all += readFileSync(f, "utf8") + "\n";
  const text = readFileSync(f, "utf8");
  if (/from\s+["']supermemory["']/.test(text)) {
    errors.push(`${f} imports supermemory SDK`);
  }
}

for (const needle of [
  "setDefaultResultOrder",
  "ipv4first",
  "projectContainerTag",
  "git-origin",
  "basename-or-path",
  "config:projectContainerTag",
  "sm_capture_mode",
  "session.post",
  "experimental.chat.system.transform",
  "keywordPatterns",
  "forget-matching",
  "/v3/documents",
  "/v4/search",
]) {
  if (!all.includes(needle)) errors.push(`src missing contract token: ${needle}`);
}

const index = readFileSync(join(srcDir, "index.ts"), "utf8");
if (!index.includes("default")) errors.push("src/index.ts must re-export default PluginModule");

if (errors.length) {
  console.error("SRC_CONTRACT_FAIL");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("SRC_CONTRACT_OK", files.length, "ts files");
