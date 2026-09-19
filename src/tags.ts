import { createHash } from "node:crypto";
import { basename } from "node:path";
import type { ProjectTags } from "./types.js";

function hashOrigin(origin: string): string {
  return createHash("sha256").update(origin.trim().toLowerCase()).digest("hex").slice(0, 12);
}

/** Read git origin via host-provided shell when available. */
export async function resolveGitOrigin(
  $: { raw?: unknown; (strings: TemplateStringsArray, ...expr: unknown[]): Promise<{ stdout?: string }> },
  directory: string,
): Promise<string | null> {
  try {
    const result = await $`git -C ${directory} remote get-url origin`;
    const url = typeof result?.stdout === "string" ? result.stdout.trim() : "";
    return url || null;
  } catch {
    return null;
  }
}

export function buildProjectTags(directory: string, origin: string | null): ProjectTags {
  const projectName = basename(directory) || "project";
  const key = origin && origin.length > 0 ? origin : directory;
  const canonical = `repo_${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}__${hashOrigin(key)}`;
  return {
    canonical,
    projectName,
    projectId: hashOrigin(key),
  };
}

export async function getProjectTags(
  directory: string,
  $?: Parameters<typeof resolveGitOrigin>[0],
): Promise<ProjectTags> {
  const origin = $ ? await resolveGitOrigin($, directory) : null;
  return buildProjectTags(directory, origin);
}
