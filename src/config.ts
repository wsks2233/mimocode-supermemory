import { existsSync, readFileSync } from "node:fs";

export type FileConfig = {
  apiKey?: string;
  baseUrl?: string;
  autoInject?: boolean;
  projectContainerTag?: string;
  keywordPatterns?: string[];
  [key: string]: unknown;
};

let fileConfigCache: FileConfig | undefined;

export function loadFileConfig(): FileConfig {
  if (fileConfigCache !== undefined) return fileConfigCache;
  let next: FileConfig = {};
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
        const parsed = JSON.parse(stripped) as FileConfig | null;
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

export function loadCredentialsFile(): Record<string, string> {
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

export function apiKey(): string {
  if (process.env.SUPERMEMORY_API_KEY) return process.env.SUPERMEMORY_API_KEY;
  const file = loadFileConfig();
  if (file.apiKey) return file.apiKey;
  return loadCredentialsFile().apiKey || "";
}

export function baseUrl(): string {
  return (
    process.env.SUPERMEMORY_API_URL ||
    process.env.SUPERMEMORY_BASE_URL ||
    loadFileConfig().baseUrl ||
    loadCredentialsFile().apiBaseUrl ||
    "https://api.supermemory.ai"
  );
}

export function autoInjectEnabled(): boolean {
  const file = loadFileConfig();
  if (typeof file.autoInject === "boolean") return file.autoInject;
  return true;
}

export function keywordPatternStrings(): string[] {
  const file = loadFileConfig();
  const extra = Array.isArray(file.keywordPatterns) ? file.keywordPatterns : [];
  return extra.filter((p): p is string => typeof p === "string");
}
