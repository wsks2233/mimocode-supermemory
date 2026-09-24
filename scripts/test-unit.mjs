/**
 * Bundle pure src modules to test/.tmp via esbuild JS API, then node --test.
 */
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "test", ".tmp");
mkdirSync(outDir, { recursive: true });

const units = ["tags", "keyword", "api"];
for (const name of units) {
  const entry = join(root, "src", `${name}.ts`);
  const outfile = join(outDir, `${name}.mjs`);
  esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
    outfile,
    logLevel: "silent",
  });
  if (!existsSync(outfile)) {
    console.error(`build-test missing: ${outfile}`);
    process.exit(1);
  }
}

const testDir = join(root, "test");
const testFiles = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort()
  .map((f) => join(testDir, f));
if (testFiles.length === 0) {
  console.error("no test files");
  process.exit(1);
}

const t = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: root,
  stdio: "inherit",
});
process.exit(t.status ?? 1);
