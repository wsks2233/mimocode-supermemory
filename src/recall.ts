/**
 * Ported from opencode-supermemory src/services/recall.ts + recall-results.ts
 * (MiMo: fetch client instead of Supermemory SDK).
 */
import { createHash } from "node:crypto";
import { extractHits, smRequest, type SmHit } from "./api.js";
import { RECALL_DIRECTIVE } from "./constants.js";

export const DIRECT_RECALL_TIMEOUT_MS = 3000;
export const MAX_RECALL_QUERY_CHARS = 500;
export const MIN_RECALL_SIMILARITY = 0.55;
export const MAX_RECALL_RESULTS = 5;
export const MAX_RECALL_HIT_CHARS = 300;
const MAX_SESSION_RECALL_HASHES = 500;

export function buildRecallDirective(): string {
  return RECALL_DIRECTIVE;
}

export function prepareRecallQuery(prompt: string): string | null {
  const trimmed = prompt.trim();
  if (trimmed.length < 12 || /^[\/#\!]/.test(trimmed)) return null;
  return trimmed.slice(0, MAX_RECALL_QUERY_CHARS);
}

function recallTextHash(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

export function formatRecallHit(hit: SmHit): string {
  const text = hit.text.slice(0, MAX_RECALL_HIT_CHARS);
  return text;
}

export class RecallSessionCache {
  private readonly sessions = new Map<string, { seen: Set<string>; order: string[] }>();

  constructor(private readonly maxHashes = MAX_SESSION_RECALL_HASHES) {}

  private getState(sessionID: string) {
    let state = this.sessions.get(sessionID);
    if (!state) {
      state = { seen: new Set<string>(), order: [] as string[] };
      this.sessions.set(sessionID, state);
    }
    return state;
  }

  private rememberHash(state: { seen: Set<string>; order: string[] }, hash: string): boolean {
    if (state.seen.has(hash)) return false;
    state.seen.add(hash);
    state.order.push(hash);
    while (state.order.length > Math.max(1, this.maxHashes)) {
      const oldest = state.order.shift();
      if (oldest) state.seen.delete(oldest);
    }
    return true;
  }

  rememberTexts(sessionID: string, texts: Iterable<string>): void {
    const state = this.getState(sessionID);
    for (const text of texts) {
      const t = String(text || "").trim();
      if (t) this.rememberHash(state, recallTextHash(t));
    }
  }

  takeFresh(sessionID: string, hits: SmHit[]): SmHit[] {
    const state = this.getState(sessionID);
    return hits.filter((hit) => this.rememberHash(state, recallTextHash(hit.text)));
  }

  delete(sessionID: string): void {
    this.sessions.delete(sessionID);
  }
}

function formatDirectRecallContext(hits: SmHit[]): string {
  return [
    "<supermemory-context>",
    "Relevant memories automatically recalled for this prompt. Every line marked ◪ comes from supermemory:",
    ...hits.map((hit) => `- ◪ ${formatRecallHit(hit)}`),
    'When one shapes your answer, credit it naturally with the ◪ prefix; if you name the source, say "from supermemory".',
    "Use these memories only when relevant. Search Supermemory for deeper context if needed.",
    "</supermemory-context>",
  ].join("\n");
}

export interface DirectRecallResult {
  context: string;
  status: "skipped" | "empty" | "recalled" | "unavailable";
  count: number;
}

/** searchMemoriesForRecall equivalent: hybrid search on canonical container (personal+project). */
async function searchRecall(query: string, containerTag: string): Promise<SmHit[]> {
  const data = await smRequest("/v4/search", {
    q: query,
    containerTag,
    searchMode: "hybrid",
    threshold: MIN_RECALL_SIMILARITY,
    limit: MAX_RECALL_RESULTS * 2,
  });
  return extractHits(data)
    .filter((h) => h.similarity === undefined || h.similarity >= MIN_RECALL_SIMILARITY)
    .slice(0, MAX_RECALL_RESULTS);
}

export async function buildDirectRecallResult(options: {
  prompt: string;
  sessionID: string;
  containerTag: string;
  cache: RecallSessionCache;
}): Promise<DirectRecallResult> {
  try {
    const query = prepareRecallQuery(options.prompt);
    if (!query) {
      return { context: "", status: "skipped", count: 0 };
    }
    const hits = await searchRecall(query, options.containerTag);
    const fresh = options.cache.takeFresh(options.sessionID, hits);
    if (fresh.length === 0) {
      return { context: "", status: "empty", count: 0 };
    }
    const context = formatDirectRecallContext(fresh);
    return { context, status: "recalled", count: fresh.length };
  } catch {
    return { context: "", status: "unavailable", count: 0 };
  }
}
