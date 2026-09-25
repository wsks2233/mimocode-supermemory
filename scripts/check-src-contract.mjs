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
  "normalizeGitRemote",
  "getGeneratedProjectTag",
  "official-getTags",
  "sm_capture_mode",
  "session.post",
  "experimental.chat.system.transform",
  "keywordPatterns",
  "forget-matching",
  "/v3/documents",
  "/v4/search",
  "experimental.session.compacting",
  "compactionInject",
  "compactionWriteback",
  "host-checkpoint",
  "COMPACTION CONTEXT INJECTION",
  "permission.ask",
  'toolName === "supermemory"',
  "stripPrivateContent",
  "AGENT_ENTITY_CONTEXT",
  "getPersonalReadTags",
]) {
  if (!all.includes(needle)) errors.push(`src missing contract token: ${needle}`);
}

// permission.ask must fail soft and only auto-allow our tool (host-limits #7)
if (!/permission\.ask"[\s\S]*?try\s*\{[\s\S]*?toolName === "supermemory"[\s\S]*?\}\s*catch/.test(all)) {
  errors.push("permission.ask must be try/catch and allow tool supermemory only");
}

// Passive compaction red lines: no host-prompt takeover, no 80% preempt trigger
if (/output\.prompt\s*=/.test(all)) {
  errors.push("src must not assign output.prompt (host summarize ownership)");
}
if (all.includes("compactionThreshold")) {
  errors.push("src must not implement official preemptive compactionThreshold");
}

const index = readFileSync(join(srcDir, "index.ts"), "utf8");
if (!index.includes("default")) errors.push("src/index.ts must re-export default PluginModule");

if (errors.length) {
  console.error("SRC_CONTRACT_FAIL");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("SRC_CONTRACT_OK", files.length, "ts files");
