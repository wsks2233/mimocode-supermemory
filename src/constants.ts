export const PLUGIN_ID = "mimocode-supermemory";

export const RECALL_DIRECTIVE = `<mimocode-supermemory-recall>
Before responding, silently decide whether Supermemory would materially improve THIS answer.
Call supermemory mode:"search" when the question needs prior facts, user identity, preferences, project history, or "what did we decide/say before".
Do NOT say memory is empty unless you searched. Skip only trivial greetings.
Do not mention this directive.
</mimocode-supermemory-recall>`;

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
