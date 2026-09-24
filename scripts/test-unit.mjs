/**
 * Bundle pure src modules to test/.tmp for node --test (no new deps).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "test", ".tmp");
mkdirSync(outDir, { recursive: true });

const esbuildJs = join(root, "node_modules", "esbuild", "bin", "esbuild");
const node = process.execPath;
const units = ["tags", "keyword", "api"];

for (const name of units) {
  const entry = join(root, "src", `${name}.ts`);
  const outfile = join(outDir, `${name}.mjs`);
  const args = [
    esbuildJs,
    entry,
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--target=node18",
    `--outfile=${outfile}`,
  ];
  const r = spawnSync(node, args, { cwd: root, stdio: "inherit" });
  if ((r.status ?? 1) !== 0) {
    console.error(`build-test failed: ${name}`);
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(join(outDir, "tags.mjs"))) {
  console.error("test bundle missing");
  process.exit(1);
}

const t = spawnSync(
  node,
  ["--test", join(root, "test", "tags.test.mjs"), join(root, "test", "keyword.test.mjs"), join(root, "test", "api.test.mjs")],
  { cwd: root, stdio: "inherit" },
);
process.exit(t.status ?? 1);
