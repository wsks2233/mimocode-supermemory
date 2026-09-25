export type TagInfo = {
  canonical: string;
  source: string;
  origin: string | null;
  projectName: string;
  personalReads?: string[];
  projectReads?: string[];
  allReads?: string[];
};

export type SupermemoryToolArgs = {
  mode?: string;
  query?: string;
  content?: string;
  id?: string;
  memoryId?: string;
  type?: string;
  scope?: string;
};

export type PluginModule = {
  id: string;
  server: (input: {
    directory?: string;
    client?: unknown;
    project?: unknown;
    $?: unknown;
  }) => Promise<Record<string, unknown>>;
};
