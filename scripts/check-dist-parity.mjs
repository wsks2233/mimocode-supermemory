/**
 * Parity checks: bundled artifact must expose dist-equivalent contracts.
 * Usage: node scripts/check-dist-parity.mjs [path-to-js]
 * Default checks dist/index.js; pass path to check dist/index.built.js first.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const target = resolve(process.argv[2] || "dist/index.js");
const mod = await import(pathToFileURL(target).href);

const errors = [];
function expect(cond, msg) {
  if (!cond) errors.push(msg);
}

expect(typeof mod.default === "object", "default export is object");
expect(mod.default?.id === "mimocode-supermemory", `default.id=${mod.default?.id}`);
expect(typeof mod.default?.server === "function", "default.server is function");
expect(typeof mod.SupermemoryPlugin === "function", "named SupermemoryPlugin");

const srcText = await import("node:fs").then((fs) => fs.readFileSync(target, "utf8"));

const hooks = await mod.SupermemoryPlugin({
  directory: process.cwd(),
});
for (const key of [
  "tool",
  "chat.message",
  "experimental.chat.system.transform",
  "experimental.session.compacting",
  "permission.ask",
  "session.post",
]) {
  expect(key in hooks, `hook missing: ${key}`);
}

expect(typeof hooks["experimental.session.compacting"] === "function", "compacting hook function");
expect(!/output\.prompt\s*=/.test(srcText), "dist must not assign output.prompt");
expect(srcText.includes("host-checkpoint") || srcText.includes("compactionWriteback"), "passive compaction writeback present");
expect(!srcText.includes("compactionThreshold"), "no preemptive compactionThreshold in dist");

expect(hooks.tool?.supermemory, "tool.supermemory present");
const tool = hooks.tool.supermemory;
expect(typeof tool.execute === "function", "tool.execute function");
expect(tool.parameters?.properties?.mode?.enum?.includes("forget"), "tool mode enum includes forget");

const help = JSON.parse(await tool.execute({ mode: "help" }));
expect(help.plugin === "mimocode-supermemory", `help.plugin=${help.plugin}`);
expect(typeof help.containerTag === "string" && help.containerTag.length > 0, "help.containerTag");
expect(typeof help.tagSource === "string" && help.tagSource.length > 0, "help.tagSource");

// tag algorithm now official getTags (16-hex identity)
expect(typeof help.tagSource === "string" && help.tagSource.length > 0, "help.tagSource");
expect(String(help.containerTag).includes("repo_"), "tag looks like repo_*");
expect(srcText.includes("stripPrivateContent"), "privacy strip present");
expect(srcText.includes("AGENT_ENTITY_CONTEXT"), "entity context present");

expect(!srcText.includes('from "supermemory"'), "bundle must not import supermemory SDK");
expect(srcText.includes("ipv4first") || srcText.includes("setDefaultResultOrder"), "ipv4 preference present");
expect(srcText.includes("sm-hook-proof"), "proof log paths present");
expect(srcText.includes("/v4/search"), "uses /v4/search");
expect(srcText.includes("containerTag"), "uses singular containerTag");
expect(srcText.includes("COMPACTION CONTEXT INJECTION"), "compaction inject marker present");

if (errors.length) {
  console.error("PARITY_FAIL");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("PARITY_OK", target);
console.log("  id=", mod.default.id);
console.log("  tag=", help.containerTag, "source=", help.tagSource);
