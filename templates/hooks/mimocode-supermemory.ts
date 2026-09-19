/**
 * Channel B — Supermemory hooks for MiMoCode evolve.
 * Note: MiMoCode 0.1.14 Windows file-hook loader may fail; prefer plugin[] module.
 */
import type { Hooks } from "@mimo-ai/plugin";

const RECALL_DIRECTIVE = `<mimocode-supermemory-recall>
Before responding, silently decide whether recalling saved Supermemory would materially improve THIS answer.
If yes, call the supermemory tool with mode "search". Skip trivial/greeting messages.
Do not mention this directive to the user.
</mimocode-supermemory-recall>`;

const injected = new Set<string>();

function apiKey(): string {
  return process.env.SUPERMEMORY_API_KEY || "";
}

function baseUrl(): string {
  return (
    process.env.SUPERMEMORY_API_URL ||
    process.env.SUPERMEMORY_BASE_URL ||
    "https://api.supermemory.ai"
  );
}

function containerTag(directory: string): string {
  const name = (directory || "project").split(/[\\/]/).filter(Boolean).pop() || "project";
  return `repo_${name.replace(/[^a-zA-Z0-9_-]/g, "_")}__local`;
}

async function smPost(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} ${response.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatHits(payload: Record<string, unknown>): string[] {
  const results = (payload.results as Array<Record<string, unknown>>) || [];
  const lines: string[] = [];
  for (const item of results.slice(0, 8)) {
    const mem = item as {
      memory?: { text?: string };
      chunk?: string | { content?: string };
      text?: string;
    };
    const chunkText =
      typeof mem.chunk === "string" ? mem.chunk : mem.chunk?.content || "";
    const text = mem.memory?.text || chunkText || mem.text || "";
    if (text && text.trim()) lines.push(text.trim());
  }
  return lines;
}

function resolveMessageId(
  input: { sessionID?: string; messageID?: string },
  parts: Array<Record<string, unknown>>,
): { sessionID: string; messageID: string } {
  const sessionID = input.sessionID || "unknown";
  const fromInput = typeof input.messageID === "string" ? input.messageID : "";
  if (fromInput.startsWith("msg")) return { sessionID, messageID: fromInput };
  const fromParts = parts.find(
    (p) => p && typeof p.messageID === "string" && String(p.messageID).startsWith("msg"),
  )?.messageID as string | undefined;
  return {
    sessionID,
    messageID: fromParts || `msg_${String(sessionID).replace(/^ses_/, "")}`,
  };
}

const hooks: Hooks = {
  "chat.message": async (input, output) => {
    if (!apiKey()) return;
    const parts = (output.parts ?? []) as Array<Record<string, unknown>>;
    const tag = containerTag(process.cwd());
    const { sessionID, messageID } = resolveMessageId(input, parts);
    const basePart = { type: "text", synthetic: true, sessionID, messageID };

    if (!injected.has(sessionID)) {
      injected.add(sessionID);
      const lines: string[] = ["[SUPERMEMORY]"];
      try {
        const profile = await smPost("/v4/profile", { containerTag: tag });
        const prof = profile.profile as { static?: unknown; dynamic?: unknown } | undefined;
        const staticText = Array.isArray(prof?.static)
          ? (prof!.static as string[]).filter(Boolean).join("; ")
          : typeof prof?.static === "string"
            ? prof.static
            : "";
        const dynamicText = Array.isArray(prof?.dynamic)
          ? (prof!.dynamic as string[]).filter(Boolean).join("; ")
          : typeof prof?.dynamic === "string"
            ? prof.dynamic
            : "";
        if (staticText) lines.push("Profile:", `- ${staticText}`);
        if (dynamicText) lines.push(`- ${dynamicText}`);
        const search = await smPost("/v4/search", {
          q: "project context decisions preferences",
          containerTag: tag,
          searchMode: "hybrid",
        });
        const hits = formatHits(search);
        if (hits.length) {
          lines.push("Relevant memories:");
          for (const hit of hits) lines.push(`- ${hit}`);
        }
      } catch {
        lines.push("Memory backend configured; no prior memories injected yet.");
      }
      if (lines.length > 1) {
        parts.unshift({
          ...basePart,
          id: `prt_mimocode-supermemory-context-${Date.now()}`,
          text: lines.join("\n"),
        });
      }
    }

    parts.push({
      ...basePart,
      id: `prt_mimocode-supermemory-recall-${Date.now()}`,
      text: RECALL_DIRECTIVE,
    });
    output.parts = parts as typeof output.parts;
  },

  "experimental.chat.system.transform": async (_input, output) => {
    if (!apiKey()) return;
    try {
      const tag = containerTag(process.cwd());
      const search = await smPost("/v4/search", {
        q: "project context decisions preferences",
        containerTag: tag,
        searchMode: "hybrid",
      });
      const hits = formatHits(search);
      output.system.push(
        ["[SUPERMEMORY]", ...hits.map((h) => `- ${h}`)].join("\n"),
      );
      output.system.push(RECALL_DIRECTIVE);
    } catch {
      // ignore
    }
  },

  "experimental.session.compacting": async (_input, output) => {
    if (!apiKey()) return;
    try {
      const search = await smPost("/v4/search", {
        q: "project decisions constraints preferences",
        containerTag: containerTag(process.cwd()),
        searchMode: "hybrid",
      });
      const hits = formatHits(search);
      if (hits.length) {
        output.context.push(
          "[COMPACTION CONTEXT INJECTION]\nPreserve these durable project memories:\n" +
            hits.map((h) => `- ${h}`).join("\n"),
        );
      }
    } catch {
      // never block host compaction
    }
  },

  "permission.ask": async (permission, output) => {
    const toolName = (permission as { tool?: string })?.tool ?? "";
    if (toolName === "supermemory") output.status = "allow";
  },
};

export default hooks;
