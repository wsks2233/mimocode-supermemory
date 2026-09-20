import { baseUrl, apiKey } from "./config.js";
import { extractHits, smRequest } from "./api.js";
import { PLUGIN_ID } from "./constants.js";
import type { SupermemoryToolArgs, TagInfo } from "./types.js";

export async function executeSupermemory(
  args: SupermemoryToolArgs,
  tagInfo: TagInfo,
): Promise<string> {
  const tag = tagInfo.canonical;
  const mode = args.mode || "help";
  const scope = args.scope === "user" ? "personal" : "project";
  const ok = (payload: Record<string, unknown>) =>
    JSON.stringify({
      plugin: PLUGIN_ID,
      containerTag: tag,
      tagSource: tagInfo.source,
      origin: tagInfo.origin || undefined,
      ...payload,
    });
  try {
    if (mode === "search") {
      const q = args.query;
      if (!q) return ok({ success: false, error: "query required" });
      const data = await smRequest("/v4/search", {
        q,
        containerTag: tag,
        searchMode: "hybrid",
      });
      const results = extractHits(data);
      let filtered = results;
      if (args.scope === "user" || args.scope === "project") {
        const want = args.scope === "user" ? "personal" : "project";
        const scoped = results.filter((r) => !r.sm_scope || r.sm_scope === want);
        filtered = scoped.length ? scoped : results;
      }
      return ok({
        success: true,
        results: filtered,
        sm_scope: args.scope ? scope : undefined,
      });
    }
    if (mode === "profile") {
      const data = await smRequest("/v4/profile", { containerTag: tag });
      return ok({ success: true, profile: data });
    }
    if (mode === "add") {
      const content = args.content;
      if (!content) return ok({ success: false, error: "content required" });
      const data = await smRequest("/v3/documents", {
        content,
        containerTag: tag,
        taskType: "memory",
        sm_scope: scope,
        sm_capture_mode: "tool",
        project: tagInfo.projectName,
      });
      return ok({ success: true, document: data, sm_scope: scope });
    }
    if (mode === "list") {
      const data = await smRequest("/v3/documents/list", { containerTag: tag, limit: 20 });
      return ok({
        success: true,
        documents: data,
        sm_scope_filter: args.scope || undefined,
      });
    }
    if (mode === "forget") {
      const id = args.id;
      const content = args.content;
      const q = args.query;
      if (!id && !content && !q) {
        return ok({ success: false, error: "forget requires id, content, or query" });
      }
      const deleted: Array<Record<string, unknown>> = [];
      const errors: string[] = [];
      const tryMemory = async (body: Record<string, unknown>) => {
        try {
          const data = await smRequest("/v4/memories", body, "DELETE");
          deleted.push({ path: "/v4/memories", data });
          return true;
        } catch (e) {
          errors.push(`/v4/memories: ${e && (e as Error).message ? (e as Error).message : String(e)}`);
          return false;
        }
      };
      const tryDoc = async (docId?: string) => {
        if (!docId) return false;
        try {
          const data = await smRequest(`/v3/documents/${docId}`, undefined, "DELETE");
          deleted.push({ path: `/v3/documents/${docId}`, data });
          return true;
        } catch (e) {
          errors.push(
            `/v3/documents/${docId}: ${e && (e as Error).message ? (e as Error).message : String(e)}`,
          );
          return false;
        }
      };
      if (id) {
        await tryMemory({ containerTag: tag, id });
        await tryDoc(id);
      }
      const searchText = content || q;
      if (searchText) {
        const search = await smRequest("/v4/search", {
          q: searchText,
          containerTag: tag,
          searchMode: "hybrid",
        });
        const hits = extractHits(search).filter((h) =>
          content ? h.text.includes(content) || h.text === content : true,
        );
        for (const hit of hits.slice(0, 8)) {
          await tryDoc(hit.documentId || hit.id);
        }
        try {
          const data = await smRequest("/v4/memories/forget-matching", {
            containerTag: tag,
            query: searchText,
            dryRun: false,
          });
          deleted.push({ path: "/v4/memories/forget-matching", data });
        } catch (e) {
          errors.push(
            `/v4/memories/forget-matching: ${e && (e as Error).message ? (e as Error).message : String(e)}`,
          );
        }
      }
      return ok({
        success: deleted.length > 0,
        deleted,
        errors,
        sm_scope: scope,
      });
    }
    return ok({
      success: true,
      help: "modes: search | profile | add | list | forget | help; scope=user|project; forget uses id or content/query (deletes matching documents + memory APIs)",
      baseUrl: baseUrl(),
    });
  } catch (e) {
    return ok({ success: false, error: e && (e as Error).message ? (e as Error).message : String(e) });
  }
}

export function createSupermemoryTool(tagInfo: TagInfo, directory: string) {
  return {
    description:
      "Supermemory long-term memory. Modes: search | profile | add | list | forget | help.",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["search", "profile", "add", "list", "forget", "help"],
          description: "Operation",
        },
        query: { type: "string", description: "Search query or forget-matching query" },
        content: {
          type: "string",
          description: "Content for add, or exact content to forget",
        },
        id: { type: "string", description: "Memory/document id for mode=forget" },
        scope: {
          type: "string",
          enum: ["user", "project"],
          description: "sm_scope metadata (default project)",
        },
      },
    },
    async execute(args: SupermemoryToolArgs) {
      void directory;
      return executeSupermemory(args || {}, tagInfo);
    },
  };
}

export { apiKey };
