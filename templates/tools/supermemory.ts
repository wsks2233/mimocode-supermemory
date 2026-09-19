/**
 * Channel B — drop-in custom tool for MiMoCode evolve / .mimocode/tools.
 * Filename becomes tool id: supermemory
 *
 * Copy to: .mimocode/tools/supermemory.ts
 */
import { tool } from "@mimo-ai/plugin";

const BASE_URL =
  process.env.SUPERMEMORY_API_URL ||
  process.env.SUPERMEMORY_BASE_URL ||
  "https://api.supermemory.ai";
const API_KEY = process.env.SUPERMEMORY_API_KEY || "";

async function smFetch(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supermemory ${path} ${response.status}: ${text}`);
  }
  return response.json();
}

function containerTag(directory: string): string {
  // Lightweight fallback; prefer git origin hash when available.
  const name = directory.split(/[\\/]/).filter(Boolean).pop() || "project";
  return `repo_${name.replace(/[^a-zA-Z0-9_-]/g, "_")}__local`;
}

export default tool({
  description:
    "Query Supermemory memory for this project. Modes: search, profile, add.",
  args: {
    mode: tool.schema
      .enum(["search", "profile", "add", "help"])
      .optional()
      .describe("Operation"),
    query: tool.schema.string().optional().describe("Search query"),
    content: tool.schema.string().optional().describe("Content to remember"),
  },
  async execute(args, context) {
    if (!API_KEY) {
      return JSON.stringify({
        success: false,
        error: "SUPERMEMORY_API_KEY is not set",
      });
    }
    const tag = containerTag(context.directory);
    const mode = args.mode ?? "help";

    if (mode === "search") {
      if (!args.query) return JSON.stringify({ error: "query required" });
      const data = (await smFetch("/v4/search", {
        method: "POST",
        body: JSON.stringify({
          query: args.query,
          containerTag: tag,
          searchMode: "hybrid",
        }),
      })) as { results?: unknown };
      return JSON.stringify({ success: true, results: data.results ?? [] });
    }

    if (mode === "profile") {
      const data = await smFetch("/v4/profile", {
        method: "POST",
        body: JSON.stringify({ containerTag: tag }),
      });
      return JSON.stringify({ success: true, profile: data });
    }

    if (mode === "add") {
      if (!args.content) return JSON.stringify({ error: "content required" });
      const data = await smFetch("/v3/documents", {
        method: "POST",
        body: JSON.stringify({
          content: args.content,
          containerTag: tag,
        }),
      });
      return JSON.stringify({ success: true, document: data });
    }

    return JSON.stringify({
      help: "modes: search | profile | add",
      baseUrl: BASE_URL,
      containerTag: tag,
    });
  },
});
