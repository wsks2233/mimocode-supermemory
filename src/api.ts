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

export function formatMemoryBlock(tag: string): Promise<string> {
  return smRequest("/v4/search", {
    q: "project context decisions preferences",
    containerTag: tag,
    searchMode: "hybrid",
  })
    .then((search) => {
      const hits = extractHits(search);
      const lines = ["[SUPERMEMORY]", `containerTag: ${tag}`];
      if (hits.length) {
        lines.push("Relevant memories:");
        for (const h of hits) lines.push(`- ${h.text}`);
      } else {
        lines.push("No prior memories for this containerTag yet.");
      }
      return lines.join("\n");
    })
    .catch((e: unknown) => {
      return `[SUPERMEMORY] lookup skipped: ${e && (e as Error).message ? (e as Error).message : String(e)}`;
    });
}
