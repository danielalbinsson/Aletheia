// Reads every file under /agents at build time and groups them by agent
// directory. Vite inlines the file contents via import.meta.glob({ as: "raw" }),
// so the finished app is fully static — no filesystem access at runtime.
//
// This is the only place that knows files live on disk. Everything else works
// from the RawAgent bags below, and the eveAdapter turns those into AgentModels.

export interface RawAgent {
  /** Directory name, e.g. "margaux". */
  id: string;
  /** Relative path within the agent dir -> file contents. */
  files: Record<string, string>;
}

// Eagerly pull in every agent file as a raw string.
const modules = import.meta.glob("/agents/**/*.{ts,md}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function loadRawAgents(): RawAgent[] {
  const byId = new Map<string, RawAgent>();

  for (const [absPath, contents] of Object.entries(modules)) {
    // absPath looks like "/agents/margaux/tools/read-inbox.ts"
    const m = absPath.match(/^\/agents\/([^/]+)\/(.+)$/);
    if (!m) continue;
    const [, id, rel] = m;
    if (!byId.has(id)) byId.set(id, { id, files: {} });
    byId.get(id)!.files[rel] = contents;
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
