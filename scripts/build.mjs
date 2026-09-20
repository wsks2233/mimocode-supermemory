import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const writeDist = process.argv.includes("--write-dist");
const outfile = writeDist
  ? join(root, "dist", "index.js")
  : join(root, "dist", "index.built.js");

mkdirSync(join(root, "dist"), { recursive: true });

const entry = join(root, "src", "index.ts");
const args = [
  entry,
  "--bundle",
  "--platform=node",
  "--format=esm",
  "--target=node18",
  `--outfile=${outfile}`,
];

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  return r.status ?? 1;
}

const esbuildJs = join(root, "node_modules", "esbuild", "bin", "esbuild");
const esbuildLib = join(root, "node_modules", "esbuild", "lib", "main.js");
const binCmd = join(root, "node_modules", ".bin", "esbuild.cmd");
const node = process.execPath;

let status;
if (existsSync(esbuildJs)) {
  status = run(node, [esbuildJs, ...args]);
} else if (existsSync(binCmd)) {
  status = run(binCmd, args);
} else if (existsSync(esbuildLib)) {
  status = run(node, [esbuildLib, ...args]);
} else {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  status = run(npx, ["--yes", "esbuild", ...args]);
}

if (status !== 0) {
  console.error("build failed");
  process.exit(status);
}

console.log(writeDist ? `built dist/index.js from src/` : `built ${outfile} (canonical dist untouched)`);
