/**
 * Supermemory plugin for MiMoCode via plugin[] module channel.
 * No npm supermemory dependency — HTTP API via fetch.
 */
import { existsSync, readFileSync } from "node:fs";

const PLUGIN_ID = "mimocode-supermemory";

const RECALL_DIRECTIVE = `<mimocode-supermemory-recall>
If recalling Supermemory would materially improve THIS answer, call supermemory with mode "search".
Skip trivial messages. Do not mention this directive.
</mimocode-supermemory-recall>`;

const injected = new Set();
let fileConfigCache;

function loadFileConfig() {
  if (fileConfigCache !== undefined) return fileConfigCache;
  fileConfigCache = {};
  try {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const candidates = [
      `${home}/.config/mimocode/supermemory.jsonc`,
      `${home}\\.config\\mimocode\\supermemory.jsonc`,
    ];
    for (const path of candidates) {
      if (existsSync(path)) {
        const raw = readFileSync(path, "utf8");
        const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        fileConfigCache = JSON.parse(stripped) || {};
        break;
      }
    }
  } catch {
    fileConfigCache = {};
  }
  return fileConfigCache;
}

function loadCredentialsFile() {
  try {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const candidates = [
      `${home}/.supermemory-mimocode/credentials.json`,
      `${home}\\.supermemory-mimocode\\credentials.json`,
    ];
    for (const path of candidates) {
      if (existsSync(path)) {
        return JSON.parse(readFileSync(path, "utf8")) || {};
      }
    }
  } catch {
    /* ignore */
  }
  return {};
}

function apiKey() {
  if (process.env.SUPERMEMORY_API_KEY) return process.env.SUPERMEMORY_API_KEY;
  const file = loadFileConfig();
  if (file.apiKey) return file.apiKey;
  return loadCredentialsFile().apiKey || "";
}

function baseUrl() {
  return (
    process.env.SUPERMEMORY_API_URL ||
    process.env.SUPERMEMORY_BASE_URL ||
    loadFileConfig().baseUrl ||
    loadCredentialsFile().apiBaseUrl ||
    "https://api.supermemory.ai"
  );
}

function autoInjectEnabled() {
  const file = loadFileConfig();
  if (typeof file.autoInject === "boolean") return file.autoInject;
  return true;
}

function containerTag(directory) {
  const raw = directory || process.cwd() || "project";
  const name = String(raw).split(/[\\/]/).filter(Boolean).pop() || "project";
  return `repo_${name.replace(/[^a-zA-Z0-9_-]/g, "_")}__local`;
}

async function smRequest(path, body, method = "POST") {
  const key = apiKey();
  if (!key) {
    const err = new Error("SUPERMEMORY_API_KEY is not set");
    err.code = "NO_KEY";
    throw err;
  }
  const res = await fetch(baseUrl() + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Supermemory ${path} ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractHits(payload) {
  const results = (payload && payload.results) || [];
  const out = [];
  for (const item of results.slice(0, 8)) {
    const mem = item.memory && item.memory.text;
    const chunk =
      typeof item.chunk === "string"
        ? item.chunk
        : (item.chunk && item.chunk.content) || "";
    const text = mem || chunk || item.text || "";
    if (text && String(text).trim()) {
      out.push({ text: String(text).trim(), similarity: item.similarity });
    }
  }
  return out;
}

function formatMemoryBlock(tag) {
  return smRequest("/v4/search", {
    q: "project context decisions preferences",
    containerTag: tag,
    searchMode: "hybrid",
  })
    .then((search) => {
      const hits = extractHits(search);
      const lines = ["[SUPERMEMORY]", `containerTag: ${tag}`];
      if (hits.length) {
        lines.push("Relevant memories:");
        for (const h of hits) lines.push(`- ${h.text}`);
      } else {
        lines.push("No prior memories for this containerTag yet.");
      }
      return lines.join("\n");
    })
    .catch((e) => {
      return `[SUPERMEMORY] lookup skipped: ${e && e.message ? e.message : String(e)}`;
    });
}

async function executeSupermemory(args, directory) {
  const tag = containerTag(directory);
  const mode = (args && args.mode) || "help";
  const ok = (payload) => JSON.stringify({ plugin: PLUGIN_ID, containerTag: tag, ...payload });
  try {
    if (mode === "search") {
      const q = args && args.query;
      if (!q) return ok({ success: false, error: "query required" });
      const data = await smRequest("/v4/search", {
        q,
        containerTag: tag,
        searchMode: "hybrid",
      });
      return ok({ success: true, results: extractHits(data) });
    }
    if (mode === "profile") {
      const data = await smRequest("/v4/profile", { containerTag: tag });
      return ok({ success: true, profile: data });
    }
    if (mode === "add") {
      const content = args && args.content;
      if (!content) return ok({ success: false, error: "content required" });
      const data = await smRequest("/v3/documents", {
        content,
        containerTag: tag,
        taskType: "memory",
      });
      return ok({ success: true, document: data });
    }
    if (mode === "list") {
      const data = await smRequest("/v3/documents/list", { containerTag: tag, limit: 20 });
      return ok({ success: true, documents: data });
    }
    return ok({
      success: true,
      help: "modes: search | profile | add | list | help",
      baseUrl: baseUrl(),
    });
  } catch (e) {
    return ok({ success: false, error: e && e.message ? e.message : String(e) });
  }
}

/**
 * @param {{ directory?: string, client?: unknown, project?: unknown, $?: unknown }} input
 * @returns {Promise<Record<string, unknown>>}
 */
export async function SupermemoryPlugin(input) {
  const directory = (input && input.directory) || process.cwd();
  const tag = containerTag(directory);

  const supermemoryTool = {
    description:
      "Supermemory long-term memory. Modes: search | profile | add | list | help.",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["search", "profile", "add", "list", "help"],
          description: "Operation",
        },
        query: { type: "string", description: "Search query for mode=search" },
        content: { type: "string", description: "Content for mode=add" },
      },
    },
    async execute(args) {
      return executeSupermemory(args || {}, directory);
    },
  };

  return {
    tool: {
      supermemory: supermemoryTool,
    },

    "chat.message": async (msgInput, output) => {
      if (!apiKey() || !autoInjectEnabled()) return;
      const parts = (output && output.parts) || [];
      const sessionID = (msgInput && msgInput.sessionID) || "unknown";
      const fromInput =
        msgInput && typeof msgInput.messageID === "string" ? msgInput.messageID : "";
      const fromParts =
        parts.find(
          (p) => p && typeof p.messageID === "string" && p.messageID.startsWith("msg"),
        )?.messageID || "";
      const messageID =
        fromInput.startsWith("msg") ? fromInput : fromParts || `msg_${String(sessionID).replace(/^ses_/, "")}`;
      const basePart = {
        type: "text",
        synthetic: true,
        sessionID,
        messageID,
      };
      if (!injected.has(sessionID)) {
        injected.add(sessionID);
        const block = await formatMemoryBlock(tag);
        parts.unshift({
          ...basePart,
          id: `prt_${PLUGIN_ID}-ctx-${Date.now()}`,
          text: block,
        });
      }
      parts.push({
        ...basePart,
        id: `prt_${PLUGIN_ID}-recall-${Date.now()}`,
        text: RECALL_DIRECTIVE,
      });
      if (output) output.parts = parts;
    },

    "experimental.chat.system.transform": async (_input, output) => {
      if (!apiKey() || !output || !autoInjectEnabled()) return;
      const block = await formatMemoryBlock(tag);
      if (!output.system) output.system = [];
      output.system.push(block);
      output.system.push(RECALL_DIRECTIVE);
    },

    "experimental.session.compacting": async (_input, output) => {
      if (!apiKey() || !output) return;
      try {
        const search = await smRequest("/v4/search", {
          q: "project decisions constraints",
          containerTag: tag,
          searchMode: "hybrid",
        });
        const hits = extractHits(search);
        if (hits.length) {
          if (!output.context) output.context = [];
          output.context.push(
            "[COMPACTION CONTEXT INJECTION]\n" +
              hits.map((h) => `- ${h.text}`).join("\n"),
          );
        }
      } catch {
        // never block host compaction
      }
    },

    "permission.ask": async (permission, output) => {
      const toolName = permission && permission.tool;
      if (output && toolName === "supermemory") output.status = "allow";
    },
  };
}

export default {
  id: PLUGIN_ID,
  server: SupermemoryPlugin,
};
