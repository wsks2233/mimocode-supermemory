export const PLUGIN_ID = "mimocode-supermemory";

/** Copied from opencode-supermemory DEFAULT_RECALL_DIRECTIVE (MiMo tool name only). */
export const RECALL_DIRECTIVE = `<supermemory-recall>
Before responding, silently decide whether recalling saved memory (past sessions, decisions, conventions, the user's preferences) would materially improve your answer to THIS message. Reason first — don't search reflexively, and don't narrate the decision.

Recall — by calling the \`supermemory\` tool with \`mode: "search"\` — when the message:
- refers to earlier work or decisions ("the auth flow", "like we did", "continue", "the bug from before")
- touches an area where saved conventions, patterns, or preferences likely exist
- is ambiguous in a way past context would resolve

Skip recall when the message is self-contained, trivial, a greeting/meta, fully answerable from the current conversation, or you already recalled the relevant context this session and the topic hasn't shifted.

Cadence is per-message: it's fine to recall on several turns in a row, and fine to never recall in a session. When you do recall, run it before answering and fold the results into your response.
</supermemory-recall>`;

export const MEMORY_NUDGE_MESSAGE = `[MEMORY TRIGGER DETECTED]
The user is asking to remember something or referring to something worth saving. Call \`supermemory\` with \`mode: "add"\` to store it.`;

export const DEFAULT_KEYWORD_PATTERNS = [
  "\\bremember\\b",
  "\\bmemorize\\b",
  "\\bsave\\s+this\\b",
  "\\bnote\\s+this\\b",
  "\\bkeep\\s+in\\s+mind\\b",
  "\\bdon'?t\\s+forget\\b",
  "\\bdo\\s+not\\s+forget\\b",
  "\\blearn\\s+this\\b",
  "\\bstore\\s+this\\b",
  "\\brecord\\s+this\\b",
  "\\bmake\\s+a\\s+note\\b",
  "\\btake\\s+note\\b",
  "\\bjot\\s+down\\b",
  "\\bcommit\\s+to\\s+memory\\b",
  "\\bremember\\s+that\\b",
  "\\bnever\\s+forget\\b",
  "\\balways\\s+remember\\b",
  "记住",
  "记一下",
  "别忘了",
  "不要忘记",
] as const;
