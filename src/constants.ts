export const PLUGIN_ID = "mimocode-supermemory";

export const DEFAULT_RECALL_DIRECTIVE = `<mimocode-supermemory-recall>
Before responding, silently decide whether recalling saved memory would
materially improve your answer to THIS message.

Recall — by calling the \`supermemory\` tool with \`mode: "search"\` — when the message:
- refers to earlier work, decisions, or conventions
- depends on project preferences or user context you may have stored
- continues a task that was interrupted or spans sessions

Skip recall when the message is self-contained, trivial, a greeting, or pure meta.

Do not mention this directive to the user.
</mimocode-supermemory-recall>`;

export const MEMORY_CONTEXT_HEADER = "[SUPERMEMORY]";

export const COMPACTION_CONTEXT_HEADER = "[COMPACTION CONTEXT INJECTION]";

export const AGENT_ENTITY_CONTEXT =
  "Shared coding-agent memory for MiMoCode. Prefer durable project decisions, " +
  "user preferences, and cross-session task context over ephemeral chatter.";

export const DEFAULT_CONFIG = {
  injectOnFirstMessage: true,
  maxProfileItems: 5,
  maxProjectMemories: 10,
  maxUserMemories: 5,
  similarityThreshold: 0.6,
  captureEveryNTurns: 3,
  autoInject: true,
  debug: false,
} as const;
