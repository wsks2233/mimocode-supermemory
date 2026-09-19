import { DEFAULT_RECALL_DIRECTIVE, MEMORY_CONTEXT_HEADER } from "../constants.js";
import { createSupermemoryClient, formatContextBlock } from "./memory.js";
import type { PluginRuntimeConfig, ProjectTags } from "../types.js";

type PartLike = {
  id?: string;
  type?: string;
  text?: string;
  synthetic?: boolean;
  [key: string]: unknown;
};

const PLUGIN_PREFIX = "mimocode-supermemory";

/**
 * First-turn memory block + every-turn recall directive.
 * All injected parts are marked synthetic so capture can exclude them.
 */
export async function injectChatMessage(args: {
  config: PluginRuntimeConfig;
  tags: ProjectTags;
  sessionID: string;
  parts: PartLike[];
  injectedSessions: Set<string>;
}): Promise<void> {
  const { config, tags, sessionID, parts, injectedSessions } = args;
  if (!config.autoInject || !config.apiKey) return;

  const client = createSupermemoryClient(config);
  const isFirst = !injectedSessions.has(sessionID);

  if (isFirst && config.injectOnFirstMessage) {
    injectedSessions.add(sessionID);
    const profile = await client.profile(tags.canonical);
    const projectHits = await client.search("project context and decisions", tags.canonical, {
      limit: config.maxProjectMemories,
      threshold: config.similarityThreshold,
    });
    const userHits = await client.search("user preferences and conventions", tags.canonical, {
      limit: config.maxUserMemories,
      threshold: config.similarityThreshold,
    });
    const block = formatContextBlock(
      {
        profileItems: profile.items.slice(0, config.maxProfileItems),
        projectHits,
        userHits,
      },
      MEMORY_CONTEXT_HEADER,
    );
    if (block) {
      parts.unshift({
        id: `prt_${PLUGIN_PREFIX}-context-${Date.now()}`,
        type: "text",
        text: block,
        synthetic: true,
      });
    }
  } else if (isFirst) {
    injectedSessions.add(sessionID);
  }

  parts.push({
    id: `prt_${PLUGIN_PREFIX}-recall-${Date.now()}`,
    type: "text",
    text: DEFAULT_RECALL_DIRECTIVE,
    synthetic: true,
  });
}
