import type { Plugin, PluginInput } from "@mimo-ai/plugin";
import { isConfigured, loadRuntimeConfig } from "./config.js";
import { DEFAULT_RECALL_DIRECTIVE } from "./constants.js";
import { injectChatMessage } from "./services/inject.js";
import { captureTrajectory } from "./services/capture.js";
import { createSupermemoryTool } from "./tool.js";
import { getProjectTags } from "./tags.js";

export const PLUGIN_ID = "mimocode-supermemory";

export const SupermemoryPlugin: Plugin = async (input: PluginInput, options = {}) => {
  const config = loadRuntimeConfig(
    process.env as Record<string, string | undefined>,
    options,
  );
  const tags = await getProjectTags(input.directory, input.$);
  const injectedSessions = new Set<string>();
  const captureSeen = new Set<string>();
  const turnCounters = new Map<string, number>();
  const configured = isConfigured(config);

  if (config.debug) {
    console.error(
      `[${"mimocode-supermemory"}] configured=${configured} baseUrl=${config.baseUrl ?? "cloud"} container=${tags.canonical}`,
    );
  }

  return {
    tool: configured
      ? { supermemory: createSupermemoryTool(input, tags) }
      : {},

    "chat.message": async (_input, output) => {
      if (!configured || !config.autoInject) return;
      const parts = (output.parts ?? []) as Array<Record<string, unknown>>;
      await injectChatMessage({
        config,
        tags,
        sessionID: _input.sessionID,
        parts,
        injectedSessions,
      });
      output.parts = parts as typeof output.parts;
    },

    /**
     * Forward-compatible: MiMoCode defines this hook but the permission
     * system is not wired yet. Safe no-op until host integrates it.
     */
    "permission.ask": async (permission, output) => {
      if (!configured) return;
      const name = (permission as { permission?: string; tool?: string })?.permission ?? "";
      const toolName = (permission as { tool?: string })?.tool ?? "";
      if (name.includes("supermemory") || toolName === "supermemory") {
        output.status = "allow";
      }
    },

    /**
     * Observe host compaction instead of owning summarize.
     * Append project context; never replace the host prompt unless necessary.
     */
    "experimental.session.compacting": async (sessionInput, output) => {
      if (!configured || !config.autoInject) return;
      try {
        const { createSupermemoryClient, formatContextBlock } = await import(
          "./services/memory.js"
        );
        const { COMPACTION_CONTEXT_HEADER } = await import("./constants.js");
        const client = createSupermemoryClient(config);
        const hits = await client.search("project decisions for compaction", tags.canonical, {
          limit: config.maxProjectMemories,
          threshold: config.similarityThreshold,
        });
        const block = formatContextBlock(
          { profileItems: [], projectHits: hits, userHits: [] },
          COMPACTION_CONTEXT_HEADER,
        );
        if (block) output.context.push(block);
        void sessionInput;
      } catch (error) {
        if (config.debug) {
          console.error("[mimocode-supermemory] compaction inject failed", error);
        }
      }
    },

    "session.post": async (sessionInput) => {
      if (!configured || !config.autoInject) return;
      const sessionID = sessionInput.sessionID;
      const turn = (turnCounters.get(sessionID) ?? 0) + 1;
      turnCounters.set(sessionID, turn);
      const trajectory = (sessionInput.trajectory ?? []) as Array<Record<string, unknown>>;
      const reason =
        sessionInput.outcome === "completed" && turn % config.captureEveryNTurns === 0
          ? ("cadence" as const)
          : ("session_end" as const);
      await captureTrajectory({
        config,
        tags,
        sessionID,
        trajectory,
        turnIndex: turn,
        seen: captureSeen,
        reason,
      });
      if (sessionInput.outcome !== "completed") {
        turnCounters.delete(sessionID);
        injectedSessions.delete(sessionID);
      }
    },

    event: async ({ event }) => {
      if (!configured || !config.debug) return;
      const type = (event as { type?: string })?.type;
      if (type) console.error(`[mimocode-supermemory] event ${type}`);
    },
  };
};

export { DEFAULT_RECALL_DIRECTIVE };
/** Canonical shipping artifact is dist/index.js (PluginModule). Align src before any rebuild. */
export default {
  id: PLUGIN_ID,
  server: SupermemoryPlugin,
};
