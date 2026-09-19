export type SupermemoryScope = "user" | "project";

export type SupermemoryToolMode =
  | "add"
  | "search"
  | "profile"
  | "list"
  | "forget"
  | "help";

export type ProjectTags = {
  /** Canonical Supermemory container tag, e.g. repo_myapp__abc123 */
  canonical: string;
  projectName: string;
  projectId: string;
};

export type PluginRuntimeConfig = {
  apiKey?: string;
  /** Override Supermemory HTTP origin (cloud or self-host). */
  baseUrl?: string;
  injectOnFirstMessage: boolean;
  maxProfileItems: number;
  maxProjectMemories: number;
  maxUserMemories: number;
  similarityThreshold: number;
  captureEveryNTurns: number;
  /** When false, skip all automatic injection (tool still available). */
  autoInject: boolean;
  debug: boolean;
};

export type MemoryHit = {
  text: string;
  similarity?: number;
  source: "memory" | "chunk" | "profile";
};

export type ContextBlockInput = {
  profileItems: string[];
  projectHits: MemoryHit[];
  userHits: MemoryHit[];
};
