import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { apiKey, autoInjectEnabled } from "./config.js";
import { formatMemoryBlock, smRequest } from "./api.js";
import {
  compactionInjectEnabled,
  compactionWritebackEnabled,
  injectCompactionContext,
  writebackHostCheckpoint,
} from "./compaction.js";
import { PLUGIN_ID, RECALL_DIRECTIVE } from "./constants.js";
import { keywordCapture, userTextFromParts } from "./keyword.js";
import { createSupermemoryTool } from "./tool.js";
import { resolveContainerTag } from "./tags.js";
import type { TagInfo } from "./types.js";

const injected = new Set<string>();
const captureSeen = new Set<string>();
const turnCounters = new Map<string, number>();

async function ensureIpv4(): Promise<void> {
  try {
    const dns = await import("node:dns");
    if (typeof dns.setDefaultResultOrder === "function") {
      dns.setDefaultResultOrder("ipv4first");
    }
  } catch {
    /* ignore */
  }
}

function writeProofTag(tagInfo: TagInfo, directory: string): void {
  try {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const dir = `${home}\\sm-hook-proof`;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(
      `${dir}\\tag.log`,
      `${new Date().toISOString()} dir=${directory} tag=${tagInfo.canonical} source=${tagInfo.source} origin=${tagInfo.origin || "-"}\n`,
    );
  } catch {
    /* ignore */
  }
}

export async function SupermemoryPlugin(input?: {
  directory?: string;
  client?: unknown;
  project?: unknown;
  $?: unknown;
}): Promise<Record<string, unknown>> {
  await ensureIpv4();
  const directory = (input && input.directory) || process.cwd();
  const tagInfo = await resolveContainerTag(directory);
  const tag = tagInfo.canonical;
  writeProofTag(tagInfo, directory);

  const supermemoryTool = createSupermemoryTool(tagInfo, directory);

  return {
    tool: {
      supermemory: supermemoryTool,
    },

    "chat.message": async (
      msgInput: { sessionID?: string; messageID?: string },
      output: { parts?: unknown[] },
    ) => {
      if (!apiKey() || !autoInjectEnabled()) return;
      const parts = ((output && output.parts) || []) as Array<Record<string, unknown>>;
      const sessionID = (msgInput && msgInput.sessionID) || "unknown";
      try {
        const userText = userTextFromParts(parts);
        if (userText) await keywordCapture(userText, tagInfo);
      } catch {
        /* ignore */
      }
      const fromInput =
        msgInput && typeof msgInput.messageID === "string" ? msgInput.messageID : "";
      const fromParts =
        parts.find(
          (p) => p && typeof p.messageID === "string" && String(p.messageID).startsWith("msg"),
        )?.messageID || "";
      const messageID =
        fromInput.startsWith("msg")
          ? fromInput
          : fromParts || `msg_${String(sessionID).replace(/^ses_/, "")}`;
      const basePart = {
        type: "text",
        synthetic: true,
        sessionID,
        messageID,
      };
      if (!injected.has(sessionID)) {
        injected.add(sessionID);
        const hint = userTextFromParts(parts);
        const block = await formatMemoryBlock(tag, hint || undefined);
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

    "experimental.chat.system.transform": async (
      _input: unknown,
      output: { system?: string[] },
    ) => {
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
    "experimental.session.compacting": async (
      input: { sessionID?: string },
      output: { context?: string[]; prompt?: string },
    ) => {
      if (!apiKey()) return;
      try {
        const sessionID = (input && input.sessionID) || "unknown";
        if (compactionInjectEnabled()) {
          await injectCompactionContext(tag, output);
        }
        if (compactionWritebackEnabled()) {
          await writebackHostCheckpoint(sessionID, tagInfo);
        }
        // Intentionally do not set output.prompt
      } catch {
        /* never block host compaction */
      }
    },

    /**
     * Forward-compatible (host-limits #7): MiMoCode may not wire this yet.
     * When wired, auto-allow our own `supermemory` tool (all modes) so recall
     * search and init/forget do not re-prompt. Never throw.
     */
    "permission.ask": async (
      permission: { tool?: string },
      output: { status?: string },
    ) => {
      try {
        const toolName = permission && permission.tool;
        if (output && toolName === "supermemory") output.status = "allow";
      } catch {
        /* never break host permission flow */
      }
    },

    "session.post": async (sessionInput: {
      sessionID?: string;
      trajectory?: Array<{
        role?: string;
        content?: string;
        parts?: Array<{ synthetic?: boolean; text?: string }>;
      }>;
    }) => {
      if (!apiKey() || !autoInjectEnabled()) return;
      try {
        const sessionID = (sessionInput && sessionInput.sessionID) || "unknown";
        const turn = (turnCounters.get(sessionID) || 0) + 1;
        turnCounters.set(sessionID, turn);
        const trajectory = (sessionInput && sessionInput.trajectory) || [];
        const lines: string[] = [];
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
        const body = lines.join("\n\n").slice(0, 12000);
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
          project: tagInfo.projectName,
        });
      } catch {
        /* never block host session */
      }
    },
  };
}

export { PLUGIN_ID, RECALL_DIRECTIVE } from "./constants.js";
export { resolveContainerTag, containerTag } from "./tags.js";

export default {
  id: PLUGIN_ID,
  server: SupermemoryPlugin,
};
