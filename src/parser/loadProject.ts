// Reads every file under /agent at build time into a single RawProject.
// Vite inlines file contents via import.meta.glob({ query: "?raw" }).

export interface RawProject {
  /** Display slug derived from agent.ts name, or "agent" as fallback. */
  id: string;
  /** Relative path within agent/ -> file contents. */
  files: Record<string, string>;
}

/** @deprecated Use RawProject */
export type RawAgent = RawProject;

function field(src: string, key: string): string | undefined {
  const m = src.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`));
  return m?.[1]?.trim() || undefined;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "agent";
}

function deriveProjectId(files: Record<string, string>): string {
  const instructions = files["instructions.md"] ?? "";
  const title = instructions.match(/^#\s+(.+)$/m)?.[1];
  if (title) return slugify(title);
  const agentTs = files["agent.ts"] ?? "";
  const name = field(agentTs, "name");
  return name ? slugify(name) : "agent";
}

const modules = import.meta.glob("/agent/**/*.{ts,md}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// The consent sidecar lives under a dot-directory, which the main glob skips.
// Read it explicitly so approval facts are legible in the app too.
const sidecars = import.meta.glob("/agent/**/.aletheia/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Build-time project from import.meta.glob (static bundle). */
export function loadRawProject(): RawProject | null {
  const files: Record<string, string> = {};

  for (const [absPath, contents] of Object.entries({ ...modules, ...sidecars })) {
    const m = absPath.match(/^\/agent\/(.+)$/);
    if (!m) continue;
    files[m[1]] = contents;
  }

  if (Object.keys(files).length === 0) return null;

  return { id: deriveProjectId(files), files };
}

/** @deprecated Use loadRawProject */
export function loadRawAgents(): RawProject[] {
  const project = loadRawProject();
  return project ? [project] : [];
}
