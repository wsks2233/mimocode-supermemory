/**
 * Channel B — Supermemory tool for MiMoCode (.mimocode/tools or global tools).
 * Filename becomes tool id: supermemory
 */
import { tool } from "@mimo-ai/plugin";

const BASE_URL =
  process.env.SUPERMEMORY_API_URL ||
  process.env.SUPERMEMORY_BASE_URL ||
  "https://api.supermemory.ai";

function getApiKey(): string {
  return process.env.SUPERMEMORY_API_KEY || "";
}

async function smFetch(path: string, init?: RequestInit): Promise<unknown> {
  const apiKey = getApiKey();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supermemory ${path} ${response.status}: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function containerTag(directory: string): string {
  const name = (directory || "project").split(/[\\/]/).filter(Boolean).pop() || "project";
  return `repo_${name.replace(/[^a-zA-Z0-9_-]/g, "_")}__local`;
}

export default tool({
  description:
    "Supermemory long-term memory for this MiMoCode project. Modes: search | profile | add | list | help.",
  args: {
    mode: tool.schema
      .enum(["search", "profile", "add", "list", "help"])
      .optional()
      .describe("Operation to run"),
    query: tool.schema.string().optional().describe("Search query for mode=search"),
    content: tool.schema.string().optional().describe("Durable fact to store for mode=add"),
  },
  async execute(args, context) {
    if (!getApiKey()) {
      return JSON.stringify({
        success: false,
        error: "SUPERMEMORY_API_KEY is not set in the agent process environment",
      });
    }
    const tag = containerTag(context?.directory || process.cwd());
    const mode = args.mode ?? "help";

    try {
      if (mode === "search") {
        if (!args.query) return JSON.stringify({ success: false, error: "query required" });
        // Supermemory /v4/search expects field name `q` (not `query`).
        const data = (await smFetch("/v4/search", {
          method: "POST",
          body: JSON.stringify({
            q: args.query,
            containerTag: tag,
            searchMode: "hybrid",
          }),
        })) as { results?: unknown };
        return JSON.stringify({ success: true, containerTag: tag, results: data.results ?? data });
      }

      if (mode === "profile") {
        const data = await smFetch("/v4/profile", {
          method: "POST",
          body: JSON.stringify({ containerTag: tag }),
        });
        return JSON.stringify({ success: true, containerTag: tag, profile: data });
      }

      if (mode === "add") {
        if (!args.content) return JSON.stringify({ success: false, error: "content required" });
        const data = await smFetch("/v3/documents", {
          method: "POST",
          body: JSON.stringify({
            content: args.content,
            containerTag: tag,
            taskType: "memory",
          }),
        });
        return JSON.stringify({ success: true, containerTag: tag, document: data });
      }

      if (mode === "list") {
        const data = await smFetch("/v3/documents/list", {
          method: "POST",
          body: JSON.stringify({ containerTag: tag, limit: 20 }),
        });
        return JSON.stringify({ success: true, containerTag: tag, documents: data });
      }

      return JSON.stringify({
        success: true,
        help: "modes: search | profile | add | list | help",
        baseUrl: BASE_URL,
        containerTag: tag,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
