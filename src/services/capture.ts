import { createHash } from "node:crypto";
import { createSupermemoryClient } from "./memory.js";
import { AGENT_ENTITY_CONTEXT } from "../constants.js";
import type { PluginRuntimeConfig, ProjectTags } from "../types.js";

type TrajectoryMessage = {
  role?: string;
  content?: unknown;
  parts?: Array<{ type?: string; text?: string; synthetic?: boolean; tool?: string }>;
  finish?: string;
  [key: string]: unknown;
};

function captureId(sessionID: string, firstTurn: number, lastTurn: number): string {
  const digest = createHash("sha256")
    .update(`${sessionID}:${firstTurn}:${lastTurn}`)
    .digest("hex");
  return `mimocode-supermemory:capture:${digest}`;
}

function extractAssistantText(messages: TrajectoryMessage[]): string {
  const lines: string[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    if (typeof message.finish === "string" && message.finish === "tool-calls") continue;
    const parts = message.parts ?? [];
    for (const part of parts) {
      if (part.synthetic) continue;
      if (part.type && part.type !== "text") continue;
      if (typeof part.text === "string" && part.text.trim()) {
        lines.push(part.text.trim());
      }
    }
  }
  return lines.join("\n\n");
}

/**
 * Batched, idempotent conversation capture.
 * Prefer session.post / event lifecycle over reimplementing host compaction.
 */
export async function captureTrajectory(args: {
  config: PluginRuntimeConfig;
  tags: ProjectTags;
  sessionID: string;
  trajectory: TrajectoryMessage[];
  turnIndex: number;
  seen: Set<string>;
  reason: "cadence" | "session_end" | "compaction";
}): Promise<boolean> {
  const { config, tags, sessionID, trajectory, turnIndex, seen, reason } = args;
  if (!config.apiKey) return false;

  const text = extractAssistantText(trajectory);
  if (!text.trim()) return false;

  const id = captureId(sessionID, Math.max(0, turnIndex - config.captureEveryNTurns), turnIndex);
  if (seen.has(id)) return false;
  seen.add(id);

  const client = createSupermemoryClient(config);
  const result = await client.addMemory(
    `[Session Summary]\n${text.slice(0, 12000)}`,
    tags.canonical,
    {
      type: "conversation",
      sm_scope: "personal",
      sm_capture_mode: reason === "compaction" ? "compaction" : "automatic",
      captureReason: reason,
      entityContext: AGENT_ENTITY_CONTEXT,
      session_id: sessionID,
    },
  );
  return result.success;
}
