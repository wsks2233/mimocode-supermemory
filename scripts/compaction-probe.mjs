import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";

const home = process.env.USERPROFILE || process.env.HOME || homedir();
const sessionId = "ses_compaction_probe_local";
const sessDir = join(home, ".local", "share", "mimocode", "sessions", sessionId);
mkdirSync(sessDir, { recursive: true });
const cp = join(sessDir, "checkpoint.md");
writeFileSync(
  cp,
  "# Checkpoint\n\nProject mimocode-supermemory uses passive compaction writeback probe COMPACT_PROBE_9F3A.\nDecisions: host owns summarize; plugin only injects context and stores checkpoint.\n",
  "utf8",
);

const distPath = join(
  process.cwd().includes("mimocode-supermemory")
    ? process.cwd()
    : "F:\\代码\\mimocode-supermemory",
  "dist",
  "index.js",
);
// resolve repo dist relative to this script location if needed
let modPath = distPath;
if (!existsSync(modPath)) {
  const alt = join(homedir(), "..", "..", "f", "代码", "mimocode-supermemory", "dist", "index.js");
  if (existsSync(alt)) modPath = alt;
}
const { SupermemoryPlugin } = await import(pathToFileURL(modPath).href);
const hooks = await SupermemoryPlugin({ directory: process.cwd() });
const out = { context: [] };
await hooks["experimental.session.compacting"]({ sessionID: sessionId }, out);
console.log("context_len", out.context?.length ?? 0);
console.log("context_sample", String(out.context?.[0] || "").slice(0, 200));
console.log("prompt_set", Object.prototype.hasOwnProperty.call(out, "prompt") && out.prompt != null);
const proof = join(home, "sm-hook-proof", "compaction.log");
if (existsSync(proof)) {
  const t = readFileSync(proof, "utf8");
  console.log("proof_has_probe", t.includes(sessionId));
  console.log("proof_tail", t.trim().split("\n").slice(-3).join(" | "));
} else {
  console.log("proof_missing", proof);
}
console.log("checkpoint_exists", existsSync(cp));
console.log("PROBE_DONE");
