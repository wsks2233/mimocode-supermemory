import { DEFAULT_CONFIG } from "./constants.js";
import type { PluginRuntimeConfig } from "./types.js";

type Env = Record<string, string | undefined>;

export function loadRuntimeConfig(
  env: Env = process.env as Env,
  options: Record<string, unknown> = {},
): PluginRuntimeConfig {
  const opt = options as Partial<PluginRuntimeConfig>;
  const bool = (value: unknown, fallback: boolean): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value === "0" || value === "false") return false;
      if (value === "1" || value === "true") return true;
    }
    return fallback;
  };

  return {
    apiKey: env.SUPERMEMORY_API_KEY || (opt.apiKey as string | undefined),
    baseUrl:
      env.SUPERMEMORY_API_URL ||
      env.SUPERMEMORY_BASE_URL ||
      (opt.baseUrl as string | undefined),
    injectOnFirstMessage: bool(
      opt.injectOnFirstMessage,
      DEFAULT_CONFIG.injectOnFirstMessage,
    ),
    maxProfileItems:
      typeof opt.maxProfileItems === "number"
        ? opt.maxProfileItems
        : DEFAULT_CONFIG.maxProfileItems,
    maxProjectMemories:
      typeof opt.maxProjectMemories === "number"
        ? opt.maxProjectMemories
        : DEFAULT_CONFIG.maxProjectMemories,
    maxUserMemories:
      typeof opt.maxUserMemories === "number"
        ? opt.maxUserMemories
        : DEFAULT_CONFIG.maxUserMemories,
    similarityThreshold:
      typeof opt.similarityThreshold === "number"
        ? opt.similarityThreshold
        : DEFAULT_CONFIG.similarityThreshold,
    captureEveryNTurns:
      typeof opt.captureEveryNTurns === "number"
        ? opt.captureEveryNTurns
        : DEFAULT_CONFIG.captureEveryNTurns,
    autoInject: bool(opt.autoInject, DEFAULT_CONFIG.autoInject),
    debug: bool(opt.debug, bool(env.SUPERMEMORY_DEBUG, DEFAULT_CONFIG.debug)),
  };
}

export function isConfigured(config: PluginRuntimeConfig): boolean {
  return Boolean(config.apiKey || config.baseUrl);
}
