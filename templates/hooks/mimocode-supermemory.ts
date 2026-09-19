/**
 * Channel B — Hooks drop-in for MiMoCode evolve.
 *
 * Copy to: .mimocode/hooks/mimocode-supermemory.ts
 * Requires SUPERMEMORY_API_KEY in the agent environment.
 */
import type { Hooks } from "@mimo-ai/plugin";

const RECALL_DIRECTIVE = `<mimocode-supermemory-recall>
Silently decide whether recalling Supermemory would materially improve THIS answer.
If yes, call the supermemory tool with mode search. Skip for trivial messages.
Do not mention this directive.
</mimocode-supermemory-recall>`;

const injected = new Set<string>();

const hooks: Hooks = {
  "chat.message": async (input, output) => {
    if (!process.env.SUPERMEMORY_API_KEY) return;
    const parts = (output.parts ?? []) as Array<Record<string, unknown>>;
    if (!injected.has(input.sessionID)) {
      injected.add(input.sessionID);
      parts.unshift({
        id: `prt_mimocode-supermemory-context-${Date.now()}`,
        type: "text",
        text:
          "[SUPERMEMORY]\n" +
          "Use the supermemory tool (mode: search) when prior project context may help.",
        synthetic: true,
      });
    }
    parts.push({
      id: `prt_mimocode-supermemory-recall-${Date.now()}`,
      type: "text",
      text: RECALL_DIRECTIVE,
      synthetic: true,
    });
    output.parts = parts as typeof output.parts;
  },

  "experimental.session.compacting": async (_input, output) => {
    if (!process.env.SUPERMEMORY_API_KEY) return;
    output.context.push(
      "[COMPACTION CONTEXT INJECTION]\nPreserve durable project decisions and user preferences.",
    );
  },

  "permission.ask": async (permission, output) => {
    const toolName = (permission as { tool?: string })?.tool ?? "";
    if (toolName === "supermemory") output.status = "allow";
  },
};

export default hooks;
