import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractHits, smRequest } from "./api.js";
import { loadFileConfig } from "./config.js";
import { PLUGIN_ID } from "./constants.js";
import { sha12 } from "./tags.js";
import type { TagInfo } from "./types.js";

const compactionSeen = new Set<string>();

export function compactionInjectEnabled(): boolean {
  const file = loadFileConfig();
  if (typeof file.compactionInject === "boolean") return file.compactionInject;
  return true;
}

export function compactionWritebackEnabled(): boolean {
  const file = loadFileConfig();
  if (typeof file.compactionWriteback === "boolean") return file.compactionWriteback;
  return true;
}

/** Host data dirs that may hold sessions/<id>/checkpoint.md (passive host-summarize source). */
export function checkpointCandidates(sessionID: string): string[] {
  const homes = [process.env.USERPROFILE, process.env.HOME, process.env.MIMOCODE_HOME].filter(
    (h): h is string => Boolean(h && String(h).trim()),
  );
  const out: string[] = [];
  for (const home of homes) {
    const base = process.env.MIMOCODE_HOME
      ? home
      : join(home, ".local", "share", "mimocode");
    out.push(join(base, "sessions", sessionID, "checkpoint.md"));
    out.push(join(home, ".local", "share", "mimocode", "sessions", sessionID, "checkpoint.md"));
    out.push(join(home, ".local", "share", "mimocode", "sessions", sessionID, "notes.md"));
  }
  return out;
}

export function readHostCheckpoint(sessionID: string): string {
  for (const path of checkpointCandidates(sessionID)) {
    try {
      if (!existsSync(path)) continue;
      const text = readFileSync(path, "utf8").trim();
      if (text) return text;
    } catch {
      /* ignore unreadable checkpoint */
    }
  }
  return "";
}

export async function injectCompactionContext(
  tag: string,
  output: { context?: string[] },
): Promise<void> {
  if (!output) return;
  try {
    const search = await smRequest("/v4/search", {
      q: "project decisions constraints architecture",
      containerTag: tag,
      searchMode: "hybrid",
    });
    const hits = extractHits(search);
    const lines = ["[COMPACTION CONTEXT INJECTION]", `containerTag: ${tag}`];
    if (hits.length) {
      for (const h of hits.slice(0, 8)) lines.push(`- ${h.text}`);
    } else {
      lines.push("No stored project memories for this containerTag.");
    }
    if (!output.context) output.context = [];
    output.context.push(lines.join("\n"));
  } catch {
    /* never block host compaction */
  }
}

/**
 * Passive write-back: store host-produced checkpoint/notes into Supermemory.
 * Does not run summarize; does not trigger host compaction.
 */
export async function writebackHostCheckpoint(
  sessionID: string,
  tagInfo: TagInfo,
): Promise<boolean> {
  const checkpoint = readHostCheckpoint(sessionID);
  if (!checkpoint.trim()) return false;
  const body = `[host-checkpoint]\nsession=${sessionID}\n${checkpoint}`.slice(0, 12000);
  const id = `${PLUGIN_ID}:compaction:${sessionID}:${sha12(body)}`;
  if (compactionSeen.has(id)) return true;
  compactionSeen.add(id);
  try {
    await smRequest("/v3/documents", {
      content: body,
      containerTag: tagInfo.canonical,
      taskType: "memory",
      sm_scope: "project",
      sm_capture_mode: "compaction",
      project: tagInfo.projectName,
    });
    try {
      const home = process.env.USERPROFILE || process.env.HOME || "";
      const pdir = `${home}\\sm-hook-proof`;
      const { appendFileSync, existsSync, mkdirSync } = await import("node:fs");
      if (!existsSync(pdir)) mkdirSync(pdir, { recursive: true });
      appendFileSync(
        `${pdir}\\compaction.log`,
        `${new Date().toISOString()} session=${sessionID} tag=${tagInfo.canonical} wrote=host-checkpoint bytes=${body.length}\n`,
      );
    } catch {
      /* ignore proof log */
    }
    return true;
  } catch {
    return false;
  }
}
