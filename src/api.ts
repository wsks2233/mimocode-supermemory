import { apiKey, baseUrl } from "./config.js";

export type SmHit = {
  text: string;
  similarity?: number;
  id?: string;
  documentId?: string;
  sm_scope?: string;
};

export async function smRequest(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<Record<string, unknown>> {
  const key = apiKey();
  if (!key) {
    const err = new Error("SUPERMEMORY_API_KEY is not set") as Error & { code?: string };
    err.code = "NO_KEY";
    throw err;
  }
  const res = await fetch(baseUrl() + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(
      `Supermemory ${path} ${res.status}: ${text.slice(0, 300)}`,
    ) as Error & { status?: number; body?: string };
    err.status = res.status;
    err.body = text;
    throw err;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

export function extractHits(payload: unknown): SmHit[] {
  const results =
    (payload && typeof payload === "object" && "results" in payload
      ? ((payload as { results?: unknown[] }).results ?? [])
      : []) as Array<Record<string, unknown>>;
  const out: SmHit[] = [];
  for (const item of results.slice(0, 8)) {
    const memory = item.memory as { text?: string; metadata?: Record<string, unknown> } | undefined;
    const mem = memory && memory.text;
    const chunkRaw = item.chunk;
    const chunk =
      typeof chunkRaw === "string"
        ? chunkRaw
        : ((chunkRaw as { content?: string } | undefined)?.content ?? "");
    const text = mem || chunk || (item.text as string) || "";
    if (text && String(text).trim()) {
      const meta =
        (item.metadata as Record<string, unknown> | undefined) ||
        (memory && memory.metadata) ||
        {};
      const docs = (item.documents as Array<{ id?: string }> | undefined) || [];
      const docId = (docs[0] && docs[0].id) || (item.documentId as string) || (item.id as string);
      out.push({
        text: String(text).trim(),
        similarity: item.similarity as number | undefined,
        id: item.id as string | undefined,
        documentId: docId,
        sm_scope: (meta.sm_scope as string | undefined) || (item.sm_scope as string | undefined),
      });
    }
  }
  return out;
}

/** Official-style multi-section block: Profile + project + personal + query hits. */
export function formatMemoryBlock(tag: string, hintQuery?: string): Promise<string> {
  return (async () => {
    const lines = ["[SUPERMEMORY]", `containerTag: ${tag}`];
    try {
      const prof = await smRequest("/v4/profile", { containerTag: tag });
      const p = (prof && (prof.profile || prof)) as Record<string, unknown> | undefined;
      const parts: string[] = [];
      const staticP = p && typeof p === "object" ? (p as { static?: string }).static : undefined;
      const dynP = p && typeof p === "object" ? (p as { dynamic?: string }).dynamic : undefined;
      if (staticP) parts.push(String(staticP));
      if (dynP) parts.push(String(dynP));
      if (parts.length) {
        lines.push("User Profile:");
        for (const x of parts.slice(0, 3)) lines.push(`- ${x}`);
      }
    } catch {
      /* profile optional */
    }
    const queries = [
      "project decisions architecture commands conventions",
      "user identity personal facts preferences family location work",
      "produce farming sales market products what I make",
    ];
    if (hintQuery && hintQuery.trim()) queries.unshift(hintQuery.trim().slice(0, 200));
    const seen = new Set<string>();
    const bullets: string[] = [];
    for (const q of queries) {
      try {
        const search = await smRequest("/v4/search", {
          q,
          containerTag: tag,
          searchMode: "hybrid",
        });
        for (const h of extractHits(search)) {
          const key = h.text.slice(0, 80);
          if (seen.has(key)) continue;
          seen.add(key);
          bullets.push(`- ${h.text}`);
          if (bullets.length >= 10) break;
        }
      } catch {
        /* continue */
      }
      if (bullets.length >= 10) break;
    }
    if (bullets.length) {
      lines.push("Relevant memories:");
      lines.push(...bullets);
    } else {
      lines.push("No prior memories for this containerTag yet.");
    }
    return lines.join("\n");
  })();
}
