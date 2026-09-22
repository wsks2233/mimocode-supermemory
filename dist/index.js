// src/plugin.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync4, mkdirSync as mkdirSync2 } from "node:fs";

// src/config.ts
import { existsSync, readFileSync } from "node:fs";
var fileConfigCache;
function loadFileConfig() {
  if (fileConfigCache !== void 0) return fileConfigCache;
  let next = {};
  try {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const candidates = [
      `${home}/.config/mimocode/supermemory.jsonc`,
      `${home}\\.config\\mimocode\\supermemory.jsonc`
    ];
    for (const path of candidates) {
      if (existsSync(path)) {
        const raw = readFileSync(path, "utf8");
        const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        const parsed = JSON.parse(stripped);
        next = parsed || {};
        break;
      }
    }
  } catch {
    next = {};
  }
  fileConfigCache = next;
  return next;
}
function loadCredentialsFile() {
  try {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const candidates = [
      `${home}/.supermemory-mimocode/credentials.json`,
      `${home}\\.supermemory-mimocode\\credentials.json`
    ];
    for (const path of candidates) {
      if (existsSync(path)) {
        return JSON.parse(readFileSync(path, "utf8")) || {};
      }
    }
  } catch {
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
  return process.env.SUPERMEMORY_API_URL || process.env.SUPERMEMORY_BASE_URL || loadFileConfig().baseUrl || loadCredentialsFile().apiBaseUrl || "https://api.supermemory.ai";
}
function autoInjectEnabled() {
  const file = loadFileConfig();
  if (typeof file.autoInject === "boolean") return file.autoInject;
  return true;
}
function keywordPatternStrings() {
  const file = loadFileConfig();
  const extra = Array.isArray(file.keywordPatterns) ? file.keywordPatterns : [];
  return extra.filter((p) => typeof p === "string");
}

// src/api.ts
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
      "Content-Type": "application/json"
    },
    body: body === void 0 ? void 0 : JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(
      `Supermemory ${path} ${res.status}: ${text.slice(0, 300)}`
    );
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
  const results = payload && typeof payload === "object" && "results" in payload ? payload.results ?? [] : [];
  const out = [];
  for (const item of results.slice(0, 8)) {
    const memory = item.memory;
    const mem = memory && memory.text;
    const chunkRaw = item.chunk;
    const chunk = typeof chunkRaw === "string" ? chunkRaw : chunkRaw?.content ?? "";
    const text = mem || chunk || item.text || "";
    if (text && String(text).trim()) {
      const meta = item.metadata || memory && memory.metadata || {};
      const docs = item.documents || [];
      const docId = docs[0] && docs[0].id || item.documentId || item.id;
      out.push({
        text: String(text).trim(),
        similarity: item.similarity,
        id: item.id,
        documentId: docId,
        sm_scope: meta.sm_scope || item.sm_scope
      });
    }
  }
  return out;
}
function formatMemoryBlock(tag) {
  return smRequest("/v4/search", {
    q: "project context decisions preferences",
    containerTag: tag,
    searchMode: "hybrid"
  }).then((search) => {
    const hits = extractHits(search);
    const lines = ["[SUPERMEMORY]", `containerTag: ${tag}`];
    if (hits.length) {
      lines.push("Relevant memories:");
      for (const h of hits) lines.push(`- ${h.text}`);
    } else {
      lines.push("No prior memories for this containerTag yet.");
    }
    return lines.join("\n");
  }).catch((e) => {
    return `[SUPERMEMORY] lookup skipped: ${e && e.message ? e.message : String(e)}`;
  });
}

// src/compaction.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { join } from "node:path";

// src/constants.ts
var PLUGIN_ID = "mimocode-supermemory";
var RECALL_DIRECTIVE = `<mimocode-supermemory-recall>
If recalling Supermemory would materially improve THIS answer, call supermemory with mode "search".
Skip trivial messages. Do not mention this directive.
</mimocode-supermemory-recall>`;
var DEFAULT_KEYWORD_PATTERNS = [
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
  "\u8BB0\u4F4F",
  "\u8BB0\u4E00\u4E0B",
  "\u522B\u5FD8\u4E86",
  "\u4E0D\u8981\u5FD8\u8BB0"
];

// src/tags.ts
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
function safeName(raw) {
  const name = String(raw || "").split(/[\\/]/).filter(Boolean).pop();
  const cleaned = (name || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!cleaned || /^_+$/.test(cleaned)) return "";
  return cleaned;
}
function containerTagSync(directory) {
  const file = loadFileConfig();
  if (file.projectContainerTag && String(file.projectContainerTag).trim()) {
    return String(file.projectContainerTag).trim();
  }
  const raw = directory || process.cwd() || "";
  const name = safeName(raw);
  if (name) return `repo_${name}__local`;
  const path = String(raw || "project");
  let h = 0;
  for (let i = 0; i < path.length; i++) {
    h = Math.imul(31, h) + path.charCodeAt(i) | 0;
  }
  return `repo_path_${Math.abs(h).toString(16)}__local`;
}
function normalizeOrigin(url) {
  if (!url) return "";
  let u = String(url).trim().toLowerCase();
  u = u.replace(/\.git$/, "").replace(/\/$/, "");
  u = u.replace(/^git@([^:]+):/, "$1/");
  u = u.replace(/^ssh:\/\//, "").replace(/^https?:\/\//, "");
  return u;
}
function sha12(input) {
  return createHash("sha256").update(String(input)).digest("hex").slice(0, 12);
}
function gitExec(directory, args) {
  try {
    return String(
      execFileSync("git", ["-C", String(directory || process.cwd()), ...args], {
        encoding: "utf8",
        timeout: 4e3,
        stdio: ["ignore", "pipe", "ignore"]
      }) || ""
    ).trim();
  } catch {
    return "";
  }
}
async function resolveContainerTag(directory) {
  const file = loadFileConfig();
  const dir = directory || process.cwd();
  const pinned = file.projectContainerTag && String(file.projectContainerTag).trim();
  if (pinned) {
    return {
      canonical: pinned,
      source: "config:projectContainerTag",
      origin: null,
      projectName: safeName(dir) || "project"
    };
  }
  const root = gitExec(dir, ["rev-parse", "--show-toplevel"]) || dir;
  const originRaw = gitExec(dir, ["remote", "get-url", "origin"]);
  const name = safeName(root) || safeName(dir) || "project";
  if (originRaw) {
    const origin = normalizeOrigin(originRaw);
    return {
      canonical: `repo_${name}__${sha12(origin)}`,
      source: "git-origin",
      origin,
      projectName: name
    };
  }
  return {
    canonical: containerTagSync(dir),
    source: "basename-or-path",
    origin: null,
    projectName: name
  };
}

// src/compaction.ts
var compactionSeen = /* @__PURE__ */ new Set();
function compactionInjectEnabled() {
  const file = loadFileConfig();
  if (typeof file.compactionInject === "boolean") return file.compactionInject;
  return true;
}
function compactionWritebackEnabled() {
  const file = loadFileConfig();
  if (typeof file.compactionWriteback === "boolean") return file.compactionWriteback;
  return true;
}
function checkpointCandidates(sessionID) {
  const homes = [process.env.USERPROFILE, process.env.HOME, process.env.MIMOCODE_HOME].filter(
    (h) => Boolean(h && String(h).trim())
  );
  const out = [];
  for (const home of homes) {
    const base = process.env.MIMOCODE_HOME ? home : join(home, ".local", "share", "mimocode");
    out.push(join(base, "sessions", sessionID, "checkpoint.md"));
    out.push(join(home, ".local", "share", "mimocode", "sessions", sessionID, "checkpoint.md"));
    out.push(join(home, ".local", "share", "mimocode", "sessions", sessionID, "notes.md"));
  }
  return out;
}
function readHostCheckpoint(sessionID) {
  for (const path of checkpointCandidates(sessionID)) {
    try {
      if (!existsSync2(path)) continue;
      const text = readFileSync2(path, "utf8").trim();
      if (text) return text;
    } catch {
    }
  }
  return "";
}
async function injectCompactionContext(tag, output) {
  if (!output) return;
  try {
    const search = await smRequest("/v4/search", {
      q: "project decisions constraints architecture",
      containerTag: tag,
      searchMode: "hybrid"
    });
    const hits = extractHits(search);
    const lines = ["[COMPACTION CONTEXT INJECTION]", `containerTag: ${tag}`];
    if (hits.length) {
      for (const h of hits.slice(0, 8)) lines.push(`- ${h.text}`);
    } else {
      lines.push("No stored project memories for this containerTag.");
    }
    if (!output.context) output.context = [];
    output.context.push(lines.join("\n"));
  } catch {
  }
}
async function writebackHostCheckpoint(sessionID, tagInfo) {
  const checkpoint = readHostCheckpoint(sessionID);
  if (!checkpoint.trim()) return false;
  const body = `[host-checkpoint]
session=${sessionID}
${checkpoint}`.slice(0, 12e3);
  const id = `${PLUGIN_ID}:compaction:${sessionID}:${sha12(body)}`;
  if (compactionSeen.has(id)) return true;
  compactionSeen.add(id);
  try {
    await smRequest("/v3/documents", {
      content: body,
      containerTag: tagInfo.canonical,
      taskType: "memory",
      sm_scope: "project",
      sm_capture_mode: "compaction",
      project: tagInfo.projectName
    });
    try {
      const home = process.env.USERPROFILE || process.env.HOME || "";
      const pdir = `${home}\\sm-hook-proof`;
      const { appendFileSync: appendFileSync3, existsSync: existsSync5, mkdirSync: mkdirSync3 } = await import("node:fs");
      if (!existsSync5(pdir)) mkdirSync3(pdir, { recursive: true });
      appendFileSync3(
        `${pdir}\\compaction.log`,
        `${(/* @__PURE__ */ new Date()).toISOString()} session=${sessionID} tag=${tagInfo.canonical} wrote=host-checkpoint bytes=${body.length}
`
      );
    } catch {
    }
    return true;
  } catch {
    return false;
  }
}

// src/keyword.ts
import { appendFileSync, existsSync as existsSync3, mkdirSync } from "node:fs";
var keywordSeen = /* @__PURE__ */ new Set();
function keywordRegexes() {
  const list = [...DEFAULT_KEYWORD_PATTERNS, ...keywordPatternStrings()];
  const out = [];
  for (const p of list) {
    try {
      out.push(new RegExp(p, "i"));
    } catch {
    }
  }
  return out;
}
function matchKeyword(text) {
  const t = String(text || "");
  if (!t.trim()) return null;
  for (const re of keywordRegexes()) {
    if (re.test(t)) return re;
  }
  return null;
}
function extractRememberContent(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const m = t.match(
    /(?:remember|memorize|记住|记一下|别忘了|不要忘记)\s*(?:that|:|：|\s)\s*([\s\S]+)/i
  ) || t.match(/(?:don'?t forget|do not forget|never forget)\s*(?:that|:|：)?\s*([\s\S]+)/i) || t.match(/(?:save|store|record|learn|note)\s+this\s*(?::|：)?\s*([\s\S]+)/i);
  if (m && m[1] && m[1].trim()) return m[1].trim();
  return t;
}
async function keywordCapture(userText, tagInfo) {
  if (!apiKey() || !autoInjectEnabled()) return;
  if (!matchKeyword(userText)) return;
  const content = extractRememberContent(userText);
  if (!content) return;
  const sid = `${PLUGIN_ID}:kw:${tagInfo.canonical}:${sha12(content)}`;
  if (keywordSeen.has(sid)) return;
  keywordSeen.add(sid);
  try {
    await smRequest("/v3/documents", {
      content,
      containerTag: tagInfo.canonical,
      taskType: "memory",
      sm_capture_mode: "keyword",
      sm_scope: "project",
      project: tagInfo.projectName
    });
    try {
      const home = process.env.USERPROFILE || process.env.HOME || "";
      const pdir = `${home}\\sm-hook-proof`;
      if (!existsSync3(pdir)) mkdirSync(pdir, { recursive: true });
      appendFileSync(
        `${pdir}\\keyword.log`,
        `${(/* @__PURE__ */ new Date()).toISOString()} tag=${tagInfo.canonical} content=${content.slice(0, 200)}
`
      );
    } catch {
    }
  } catch {
  }
}
function userTextFromParts(parts) {
  const texts = [];
  for (const p of parts || []) {
    if (!p || p.synthetic) continue;
    if (typeof p.text === "string" && p.text.trim()) texts.push(p.text.trim());
  }
  return texts.join("\n");
}

// src/tool.ts
async function executeSupermemory(args, tagInfo) {
  const tag = tagInfo.canonical;
  const mode = args.mode || "help";
  const scope = args.scope === "user" ? "personal" : "project";
  const ok = (payload) => JSON.stringify({
    plugin: PLUGIN_ID,
    containerTag: tag,
    tagSource: tagInfo.source,
    origin: tagInfo.origin || void 0,
    ...payload
  });
  try {
    if (mode === "search") {
      const q = args.query;
      if (!q) return ok({ success: false, error: "query required" });
      const data = await smRequest("/v4/search", {
        q,
        containerTag: tag,
        searchMode: "hybrid"
      });
      const results = extractHits(data);
      let filtered = results;
      if (args.scope === "user" || args.scope === "project") {
        const want = args.scope === "user" ? "personal" : "project";
        const scoped = results.filter((r) => !r.sm_scope || r.sm_scope === want);
        filtered = scoped.length ? scoped : results;
      }
      return ok({
        success: true,
        results: filtered,
        sm_scope: args.scope ? scope : void 0
      });
    }
    if (mode === "profile") {
      const data = await smRequest("/v4/profile", { containerTag: tag });
      return ok({ success: true, profile: data });
    }
    if (mode === "add") {
      const content = args.content;
      if (!content) return ok({ success: false, error: "content required" });
      const data = await smRequest("/v3/documents", {
        content,
        containerTag: tag,
        taskType: "memory",
        sm_scope: scope,
        sm_capture_mode: "tool",
        project: tagInfo.projectName
      });
      return ok({ success: true, document: data, sm_scope: scope });
    }
    if (mode === "list") {
      const data = await smRequest("/v3/documents/list", { containerTag: tag, limit: 20 });
      return ok({
        success: true,
        documents: data,
        sm_scope_filter: args.scope || void 0
      });
    }
    if (mode === "forget") {
      const id = args.id;
      const content = args.content;
      const q = args.query;
      if (!id && !content && !q) {
        return ok({ success: false, error: "forget requires id, content, or query" });
      }
      const deleted = [];
      const errors = [];
      const tryMemory = async (body) => {
        try {
          const data = await smRequest("/v4/memories", body, "DELETE");
          deleted.push({ path: "/v4/memories", data });
          return true;
        } catch (e) {
          errors.push(`/v4/memories: ${e && e.message ? e.message : String(e)}`);
          return false;
        }
      };
      const tryDoc = async (docId) => {
        if (!docId) return false;
        try {
          const data = await smRequest(`/v3/documents/${docId}`, void 0, "DELETE");
          deleted.push({ path: `/v3/documents/${docId}`, data });
          return true;
        } catch (e) {
          errors.push(
            `/v3/documents/${docId}: ${e && e.message ? e.message : String(e)}`
          );
          return false;
        }
      };
      if (id) {
        await tryMemory({ containerTag: tag, id });
        await tryDoc(id);
      }
      const searchText = content || q;
      if (searchText) {
        const search = await smRequest("/v4/search", {
          q: searchText,
          containerTag: tag,
          searchMode: "hybrid"
        });
        const hits = extractHits(search).filter(
          (h) => content ? h.text.includes(content) || h.text === content : true
        );
        for (const hit of hits.slice(0, 8)) {
          await tryDoc(hit.documentId || hit.id);
        }
        try {
          const data = await smRequest("/v4/memories/forget-matching", {
            containerTag: tag,
            query: searchText,
            dryRun: false
          });
          deleted.push({ path: "/v4/memories/forget-matching", data });
        } catch (e) {
          errors.push(
            `/v4/memories/forget-matching: ${e && e.message ? e.message : String(e)}`
          );
        }
      }
      return ok({
        success: deleted.length > 0,
        deleted,
        errors,
        sm_scope: scope
      });
    }
    return ok({
      success: true,
      help: "modes: search | profile | add | list | forget | help; scope=user|project; forget uses id or content/query (deletes matching documents + memory APIs)",
      baseUrl: baseUrl()
    });
  } catch (e) {
    return ok({ success: false, error: e && e.message ? e.message : String(e) });
  }
}
function createSupermemoryTool(tagInfo, directory) {
  return {
    description: "Supermemory long-term memory. Modes: search | profile | add | list | forget | help.",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["search", "profile", "add", "list", "forget", "help"],
          description: "Operation"
        },
        query: { type: "string", description: "Search query or forget-matching query" },
        content: {
          type: "string",
          description: "Content for add, or exact content to forget"
        },
        id: { type: "string", description: "Memory/document id for mode=forget" },
        scope: {
          type: "string",
          enum: ["user", "project"],
          description: "sm_scope metadata (default project)"
        }
      }
    },
    async execute(args) {
      void directory;
      return executeSupermemory(args || {}, tagInfo);
    }
  };
}

// src/plugin.ts
var injected = /* @__PURE__ */ new Set();
var captureSeen = /* @__PURE__ */ new Set();
var turnCounters = /* @__PURE__ */ new Map();
async function ensureIpv4() {
  try {
    const dns = await import("node:dns");
    if (typeof dns.setDefaultResultOrder === "function") {
      dns.setDefaultResultOrder("ipv4first");
    }
  } catch {
  }
}
function writeProofTag(tagInfo, directory) {
  try {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const dir = `${home}\\sm-hook-proof`;
    if (!existsSync4(dir)) mkdirSync2(dir, { recursive: true });
    appendFileSync2(
      `${dir}\\tag.log`,
      `${(/* @__PURE__ */ new Date()).toISOString()} dir=${directory} tag=${tagInfo.canonical} source=${tagInfo.source} origin=${tagInfo.origin || "-"}
`
    );
  } catch {
  }
}
async function SupermemoryPlugin(input) {
  await ensureIpv4();
  const directory = input && input.directory || process.cwd();
  const tagInfo = await resolveContainerTag(directory);
  const tag = tagInfo.canonical;
  writeProofTag(tagInfo, directory);
  const supermemoryTool = createSupermemoryTool(tagInfo, directory);
  return {
    tool: {
      supermemory: supermemoryTool
    },
    "chat.message": async (msgInput, output) => {
      if (!apiKey() || !autoInjectEnabled()) return;
      const parts = output && output.parts || [];
      const sessionID = msgInput && msgInput.sessionID || "unknown";
      try {
        const userText = userTextFromParts(parts);
        if (userText) await keywordCapture(userText, tagInfo);
      } catch {
      }
      const fromInput = msgInput && typeof msgInput.messageID === "string" ? msgInput.messageID : "";
      const fromParts = parts.find(
        (p) => p && typeof p.messageID === "string" && String(p.messageID).startsWith("msg")
      )?.messageID || "";
      const messageID = fromInput.startsWith("msg") ? fromInput : fromParts || `msg_${String(sessionID).replace(/^ses_/, "")}`;
      const basePart = {
        type: "text",
        synthetic: true,
        sessionID,
        messageID
      };
      if (!injected.has(sessionID)) {
        injected.add(sessionID);
        const block = await formatMemoryBlock(tag);
        parts.unshift({
          ...basePart,
          id: `prt_${PLUGIN_ID}-ctx-${Date.now()}`,
          text: block
        });
      }
      parts.push({
        ...basePart,
        id: `prt_${PLUGIN_ID}-recall-${Date.now()}`,
        text: RECALL_DIRECTIVE
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
    /**
     * Passive compaction (backlog #6): host owns summarize timing.
     * - output.context = extra context for the host compaction prompt
     * - never set output.prompt (that would replace host summarize prompt)
     * - write back host checkpoint.md when present; never trigger compaction
     */
    "experimental.session.compacting": async (input2, output) => {
      if (!apiKey()) return;
      try {
        const sessionID = input2 && input2.sessionID || "unknown";
        if (compactionInjectEnabled()) {
          await injectCompactionContext(tag, output);
        }
        if (compactionWritebackEnabled()) {
          await writebackHostCheckpoint(sessionID, tagInfo);
        }
      } catch {
      }
    },
    /**
     * Forward-compatible (host-limits #7): MiMoCode may not wire this yet.
     * When wired, auto-allow our own `supermemory` tool (all modes) so recall
     * search and init/forget do not re-prompt. Never throw.
     */
    "permission.ask": async (permission, output) => {
      try {
        const toolName = permission && permission.tool;
        if (output && toolName === "supermemory") output.status = "allow";
      } catch {
      }
    },
    "session.post": async (sessionInput) => {
      if (!apiKey() || !autoInjectEnabled()) return;
      try {
        const sessionID = sessionInput && sessionInput.sessionID || "unknown";
        const turn = (turnCounters.get(sessionID) || 0) + 1;
        turnCounters.set(sessionID, turn);
        const trajectory = sessionInput && sessionInput.trajectory || [];
        const lines = [];
        for (const msg of trajectory) {
          if (!msg) continue;
          const role = msg.role;
          if (role !== "user" && role !== "assistant") continue;
          const parts = Array.isArray(msg.parts) ? msg.parts : [];
          for (const part of parts) {
            if (!part || part.synthetic) continue;
            const text = typeof part.text === "string" ? part.text : "";
            if (!text.trim()) continue;
            if (role === "user") {
              lines.push("User: " + text.trim());
            } else {
              lines.push("Assistant: " + text.trim());
            }
          }
          if (!parts.length && typeof msg.content === "string" && msg.content.trim()) {
            lines.push(role + ": " + msg.content.trim());
          }
        }
        const body = lines.join("\n\n").slice(0, 12e3);
        if (!body.trim()) return;
        const capId = `${PLUGIN_ID}:capture:${sessionID}:${turn}`;
        if (captureSeen.has(capId)) return;
        captureSeen.add(capId);
        await smRequest("/v3/documents", {
          content: body,
          containerTag: tag,
          taskType: "memory",
          sm_scope: "project",
          sm_capture_mode: "automatic",
          project: tagInfo.projectName
        });
      } catch {
      }
    }
  };
}
var plugin_default = {
  id: PLUGIN_ID,
  server: SupermemoryPlugin
};
export {
  PLUGIN_ID,
  SupermemoryPlugin,
  plugin_default as default,
  resolveContainerTag
};
