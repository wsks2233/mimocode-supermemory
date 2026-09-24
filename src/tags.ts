import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { loadFileConfig, type FileConfig } from "./config.js";
import type { TagInfo } from "./types.js";

export function safeName(raw: string): string {
  const name = String(raw || "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop();
  const cleaned = (name || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!cleaned || /^_+$/.test(cleaned)) return "";
  return cleaned;
}

export function containerTagSync(directory?: string, fileConfig?: FileConfig): string {
  const file = fileConfig ?? loadFileConfig();
  if (file.projectContainerTag && String(file.projectContainerTag).trim()) {
    return String(file.projectContainerTag).trim();
  }
  const raw = directory || process.cwd() || "";
  const name = safeName(raw);
  if (name) return `repo_${name}__local`;
  const path = String(raw || "project");
  let h = 0;
  for (let i = 0; i < path.length; i++) {
    h = (Math.imul(31, h) + path.charCodeAt(i)) | 0;
  }
  return `repo_path_${Math.abs(h).toString(16)}__local`;
}

export function normalizeOrigin(url: string): string {
  if (!url) return "";
  let u = String(url).trim().toLowerCase();
  u = u.replace(/\.git$/, "").replace(/\/$/, "");
  u = u.replace(/^git@([^:]+):/, "$1/");
  u = u.replace(/^ssh:\/\//, "").replace(/^https?:\/\//, "");
  return u;
}

export function sha12(input: string): string {
  return createHash("sha256").update(String(input)).digest("hex").slice(0, 12);
}

export function gitExec(directory: string | undefined, args: string[]): string {
  try {
    return String(
      execFileSync("git", ["-C", String(directory || process.cwd()), ...args], {
        encoding: "utf8",
        timeout: 4000,
        stdio: ["ignore", "pipe", "ignore"],
      }) || "",
    ).trim();
  } catch {
    return "";
  }
}

export async function resolveContainerTag(
  directory?: string,
  fileConfig?: FileConfig,
): Promise<TagInfo> {
  const file = fileConfig ?? loadFileConfig();
  const dir = directory || process.cwd();
  const pinned = file.projectContainerTag && String(file.projectContainerTag).trim();
  if (pinned) {
    return {
      canonical: pinned,
      source: "config:projectContainerTag",
      origin: null,
      projectName: safeName(dir) || "project",
    };
  }
  const root = gitExec(dir, ["rev-parse", "--show-toplevel"]) || dir;
  const originRaw = gitExec(dir, ["remote", "get-url", "origin"]);
  const name = safeName(root) || safeName(dir) || "project";
  if (originRaw) {
    const origin = normalizeOrigin(originRaw);
    return {
      canonical: `repo_${name}__${sha12(origin)}`,
      source: "git-origin",
      origin,
      projectName: name,
    };
  }
  return {
    canonical: containerTagSync(dir),
    source: "basename-or-path",
    origin: null,
    projectName: name,
  };
}

export function containerTag(directory?: string): string {
  return containerTagSync(directory);
}

export function hashOrigin(origin: string): string {
  return sha12(normalizeOrigin(origin) || origin);
}
