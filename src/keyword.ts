import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { DEFAULT_KEYWORD_PATTERNS, PLUGIN_ID } from "./constants.js";
import { apiKey, autoInjectEnabled, keywordPatternStrings } from "./config.js";
import { smRequest } from "./api.js";
import { sha12 } from "./tags.js";
import type { TagInfo } from "./types.js";

const keywordSeen = new Set<string>();

export function keywordRegexes(): RegExp[] {
  const list = [...DEFAULT_KEYWORD_PATTERNS, ...keywordPatternStrings()];
  const out: RegExp[] = [];
  for (const p of list) {
    try {
      out.push(new RegExp(p, "i"));
    } catch {
      /* ignore invalid */
    }
  }
  return out;
}

export function matchKeyword(text: string): RegExp | null {
  const t = String(text || "");
  if (!t.trim()) return null;
  for (const re of keywordRegexes()) {
    if (re.test(t)) return re;
  }
  return null;
}

export function extractRememberContent(text: string): string {
  const t = String(text || "").trim();
  if (!t) return "";
  const m =
    t.match(
      /(?:remember|memorize|记住|记一下|别忘了|不要忘记)\s*(?:that|:|：|\s)\s*([\s\S]+)/i,
    ) ||
    t.match(/(?:don'?t forget|do not forget|never forget)\s*(?:that|:|：)?\s*([\s\S]+)/i) ||
    t.match(/(?:save|store|record|learn|note)\s+this\s*(?::|：)?\s*([\s\S]+)/i);
  if (m && m[1] && m[1].trim()) return m[1].trim();
  return t;
}

export async function keywordCapture(userText: string, tagInfo: TagInfo): Promise<void> {
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
      project: tagInfo.projectName,
    });
    try {
      const home = process.env.USERPROFILE || process.env.HOME || "";
      const pdir = `${home}\\sm-hook-proof`;
      if (!existsSync(pdir)) mkdirSync(pdir, { recursive: true });
      appendFileSync(
        `${pdir}\\keyword.log`,
        `${new Date().toISOString()} tag=${tagInfo.canonical} content=${content.slice(0, 200)}\n`,
      );
    } catch {
      /* ignore proof log */
    }
  } catch {
    /* never block */
  }
}

export function userTextFromParts(parts: unknown): string {
  const texts: string[] = [];
  for (const p of (parts as Array<Record<string, unknown>>) || []) {
    if (!p || p.synthetic) continue;
    if (typeof p.text === "string" && p.text.trim()) texts.push(p.text.trim());
  }
  return texts.join("\n");
}
