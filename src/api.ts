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

/** Official formatContextForPrompt (opencode-supermemory context.ts). */
export function formatContextForPrompt(
  profile: { profile?: { static?: unknown[]; dynamic?: unknown[] } } | null,
  userMemories: { results?: unknown[] },
  projectMemories: { results?: unknown[] },
): string {
  const factText = (fact: unknown): string => {
    if (typeof fact === "string") return fact;
    if (fact != null && typeof fact === "object" && typeof (fact as { content?: string }).content === "string") {
      return (fact as { content: string }).content;
    }
    return fact == null ? "" : String(fact);
  };
  const pick = (list: unknown[] | undefined, n: number) =>
    (list || []).slice(0, n).map(factText).filter(Boolean);

  const parts: string[] = [
    "[SUPERMEMORY]",
    'Every line marked ◪ comes from supermemory. When one shapes your answer, credit it naturally with the ◪ prefix; if you name the source, say "from supermemory".',
  ];

  const staticFacts = pick(profile?.profile?.static, 5);
  const dynamicFacts = pick(profile?.profile?.dynamic, 5);
  if (staticFacts.length) {
    parts.push("\nUser Profile:");
    for (const f of staticFacts) parts.push(`- ◪ ${f}`);
  }
  if (dynamicFacts.length) {
    parts.push("\nRecent Context:");
    for (const f of dynamicFacts) parts.push(`- ◪ ${f}`);
  }

  const score = (sim?: number) =>
    typeof sim === "number" ? ` [${Math.round(sim * 100)}%]` : "";

  const projectHits = extractHits({ results: projectMemories.results || [] });
  if (projectHits.length) {
    parts.push("\nProject Knowledge:");
    for (const h of projectHits) parts.push(`- ◪${score(h.similarity)} ${h.text}`);
  }

  const userHits = extractHits({ results: userMemories.results || [] });
  if (userHits.length) {
    parts.push("\nRelevant Memories:");
    for (const h of userHits) parts.push(`- ◪${score(h.similarity)} ${h.text}`);
  }

  if (parts.length === 2) return "";
  return parts.join("\n");
}

/** Legacy name kept for compacting inject. */
export function formatMemoryBlock(tag: string, hintQuery?: string): Promise<string> {
  return (async () => {
    let profile: { profile?: { static?: unknown[]; dynamic?: unknown[] } } | null = null;
    try {
      const raw = await smRequest("/v4/profile", { containerTag: tag });
      const p = (raw && (raw.profile || raw)) as { profile?: { static?: unknown[]; dynamic?: unknown[] } } | undefined;
      if (p?.profile) profile = p as { profile: { static?: unknown[]; dynamic?: unknown[] } };
      else if (raw && (raw.static || raw.dynamic)) {
        profile = {
          profile: {
            static: (raw.static as unknown[]) || [],
            dynamic: (raw.dynamic as unknown[]) || [],
          },
        };
      }
    } catch {
      /* profile optional */
    }
    const fetchMem = async (q: string) => {
      try {
        const s = await smRequest("/v4/search", {
          q,
          containerTag: tag,
          searchMode: "hybrid",
          limit: 10,
        });
        return { results: ((s && s.results) || []) as unknown[] };
      } catch {
        return { results: [] as unknown[] };
      }
    };
    const project = await fetchMem("project decisions architecture commands conventions");
    const user = await fetchMem(
      hintQuery && hintQuery.trim()
        ? hintQuery.trim().slice(0, 200)
        : "user identity personal facts preferences location work products",
    );
    return formatContextForPrompt(profile, user, project);
  })();
}
