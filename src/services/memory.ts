import Supermemory from "supermemory";
import { AGENT_ENTITY_CONTEXT } from "./constants.js";
import type {
  ContextBlockInput,
  MemoryHit,
  PluginRuntimeConfig,
  ProjectTags,
  SupermemoryScope,
  SupermemoryToolMode,
} from "./types.js";

export type SupermemoryClient = {
  addMemory: (
    content: string,
    containerTag: string,
    metadata?: Record<string, unknown>,
  ) => Promise<{ success: boolean; id?: string; error?: string }>;
  search: (
    query: string,
    containerTag: string,
    opts?: { limit?: number; threshold?: number },
  ) => Promise<MemoryHit[]>;
  profile: (containerTag: string) => Promise<{ items: string[] }>;
  list: (containerTag: string) => Promise<Array<{ id: string; title?: string }>>;
  forget: (id: string) => Promise<{ success: boolean }>;
};

type SupermemoryCtorOptions = {
  apiKey?: string;
  baseURL?: string;
};

/**
 * Thin wrapper around the official Supermemory SDK.
 * Keep the surface small so self-host / cloud stay switchable via baseURL.
 */
export function createSupermemoryClient(config: PluginRuntimeConfig): SupermemoryClient {
  const options: SupermemoryCtorOptions = {};
  if (config.apiKey) options.apiKey = config.apiKey;
  if (config.baseUrl) options.baseURL = config.baseUrl;

  // Official SDK client; methods map to /v3/documents, /v4/search, /v4/profile.
  const client = new Supermemory(options as ConstructorParameters<typeof Supermemory>[0]);

  const api = client as unknown as {
    add?: (input: Record<string, unknown>) => Promise<{ id?: string; success?: boolean }>;
    addMemory?: (input: Record<string, unknown>) => Promise<{ id?: string }>;
    search?: (
      query: string,
      opts?: Record<string, unknown>,
    ) => Promise<{ results?: Array<Record<string, unknown>> }>;
    documents?: {
      list?: (opts?: Record<string, unknown>) => Promise<{ documents?: Array<Record<string, unknown>> }>;
      delete?: (id: string) => Promise<unknown>;
    };
  };

  return {
    async addMemory(content, containerTag, metadata = {}) {
      try {
        const input = {
          content,
          containerTag,
          entityContext: AGENT_ENTITY_CONTEXT,
          ...metadata,
        };
        const result = api.add
          ? await api.add(input)
          : api.addMemory
            ? await api.addMemory(input)
            : null;
        return { success: Boolean(result), id: (result as { id?: string } | null)?.id };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },

    async search(query, containerTag, opts = {}) {
      if (!api.search) return [];
      const response = await api.search(query, {
        containerTag,
        searchMode: "hybrid",
        limit: opts.limit ?? 8,
      });
      const results = response?.results ?? [];
      return results
        .map((item) => {
          const memory = item as { memory?: { text?: string }; chunk?: { content?: string }; text?: string; score?: number; similarity?: number };
          const text = memory.memory?.text || memory.chunk?.content || memory.text || "";
          const similarity = memory.similarity ?? memory.score;
          const source: MemoryHit["source"] = memory.memory
            ? "memory"
            : memory.chunk
              ? "chunk"
              : "memory";
          return {
            text,
            similarity: typeof similarity === "number" ? similarity : undefined,
            source,
          } satisfies MemoryHit;
        })
        .filter((hit) => hit.text.trim().length > 0)
        .filter((hit) =>
          typeof hit.similarity === "number"
            ? hit.similarity >= (opts.threshold ?? 0)
            : true,
        );
    },

    async profile(containerTag) {
      const profileApi = (client as unknown as {
        profile?: (tag: string) => Promise<{ profile?: { static?: string; dynamic?: string; buckets?: Record<string, string> } }>;
      }).profile;
      if (!profileApi) return { items: [] };
      const response = await profileApi(containerTag);
      const profile = response?.profile;
      const items: string[] = [];
      if (profile?.static) items.push(profile.static);
      if (profile?.dynamic) items.push(profile.dynamic);
      if (profile?.buckets) {
        for (const value of Object.values(profile.buckets)) {
          if (value) items.push(value);
        }
      }
      return { items };
    },

    async list(containerTag) {
      if (!api.documents?.list) return [];
      const response = await api.documents.list({ containerTag });
      return (response?.documents ?? []).map((doc) => ({
        id: String((doc as { id?: string }).id ?? ""),
        title: (doc as { title?: string }).title,
      }));
    },

    async forget(id) {
      try {
        if (api.documents?.delete) {
          await api.documents.delete(id);
          return { success: true };
        }
        return { success: false };
      } catch {
        return { success: false };
      }
    },
  };
}

export function formatContextBlock(
  input: ContextBlockInput,
  header: string,
): string {
  const parts: string[] = [header];
  if (input.profileItems.length > 0) {
    parts.push("\nUser Profile:");
    for (const item of input.profileItems) parts.push(`- ${item}`);
  }
  if (input.projectHits.length > 0) {
    parts.push("\nProject Knowledge:");
    for (const hit of input.projectHits) {
      const pct =
        typeof hit.similarity === "number" ? ` [${Math.round(hit.similarity * 100)}%]` : "";
      parts.push(`- ${pct} ${hit.text}`.replace(" - ", "- "));
    }
  }
  if (input.userHits.length > 0) {
    parts.push("\nRelevant Memories:");
    for (const hit of input.userHits) parts.push(`- ${hit.text}`);
  }
  if (parts.length === 1) return "";
  return parts.join("\n");
}

export async function executeSupermemoryTool(args: {
  mode?: SupermemoryToolMode;
  content?: string;
  query?: string;
  scope?: SupermemoryScope;
  id?: string;
}, client: SupermemoryClient, tags: ProjectTags): Promise<string> {
  const mode = args.mode ?? "help";
  const scope = args.scope ?? "project";

  switch (mode) {
    case "add": {
      if (!args.content?.trim()) {
        return JSON.stringify({ success: false, error: "content is required for mode=add" });
      }
      const result = await client.addMemory(args.content.trim(), tags.canonical, {
        sm_scope: scope,
        sm_capture_mode: "tool",
        project: tags.projectName,
        sm_project_id: tags.projectId,
      });
      return JSON.stringify(result);
    }
    case "search": {
      if (!args.query?.trim()) {
        return JSON.stringify({ success: false, error: "query is required for mode=search" });
      }
      const hits = await client.search(args.query.trim(), tags.canonical, { limit: 8 });
      return JSON.stringify({ success: true, results: hits });
    }
    case "profile": {
      const profile = await client.profile(tags.canonical);
      return JSON.stringify({ success: true, profile: profile.items });
    }
    case "list": {
      const docs = await client.list(tags.canonical);
      return JSON.stringify({ success: true, documents: docs });
    }
    case "forget": {
      if (!args.id) {
        return JSON.stringify({ success: false, error: "id is required for mode=forget" });
      }
      const result = await client.forget(args.id);
      return JSON.stringify(result);
    }
    default:
      return JSON.stringify({
        success: true,
        help: "modes: add | search | profile | list | forget; scope: user | project",
      });
  }
}
