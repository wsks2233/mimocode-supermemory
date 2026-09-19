import { tool } from "@mimo-ai/plugin";
import { executeSupermemoryTool, createSupermemoryClient } from "./services/memory.js";
import { loadRuntimeConfig } from "./config.js";
import { getProjectTags } from "./tags.js";
import type { PluginInput } from "@mimo-ai/plugin";
import type { ProjectTags } from "./types.js";

export function createSupermemoryTool(input: PluginInput, tags?: ProjectTags) {
  return tool({
    description:
      "Manage and query Supermemory persistent memory for this coding agent. " +
      "Modes: add, search, profile, list, forget, help.",
    args: {
      mode: tool.schema
        .enum(["add", "search", "profile", "list", "forget", "help"])
        .optional()
        .describe("Operation to perform"),
      content: tool.schema.string().optional().describe("Memory text for mode=add"),
      query: tool.schema.string().optional().describe("Search query for mode=search"),
      scope: tool.schema
        .enum(["user", "project"])
        .optional()
        .describe("Memory scope; default project"),
      id: tool.schema.string().optional().describe("Document/memory id for mode=forget"),
    },
    async execute(args) {
      const config = loadRuntimeConfig(process.env as Record<string, string | undefined>, {});
      const projectTags = tags ?? (await getProjectTags(input.directory, input.$));
      const client = createSupermemoryClient(config);
      return executeSupermemoryTool(
        {
          mode: args.mode,
          content: args.content,
          query: args.query,
          scope: args.scope,
          id: args.id,
        },
        client,
        projectTags,
      );
    },
  });
}
