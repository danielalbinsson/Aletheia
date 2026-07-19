// workspaceRegistry: discover eve agent workspaces under a folder and remember
// which one Aletheia is currently inspecting. A "workspace" is any directory
// that contains `agent/agent.ts` — the same shape the file API reads. This is
// what lets Aletheia point at all your agents and "see" each one in turn.
//
// Dev-tool scope: paths come from the user on their own machine. Discovery is
// depth-limited and skips heavy/irrelevant dirs so a scan stays fast.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface DiscoveredAgent {
  /** Absolute path to the workspace root (the dir containing `agent/`). */
  path: string;
  /** Display name: the agent's `name` from agent.ts, else the folder name. */
  name: string;
  /** True for the workspace Aletheia was launched against (the working project). */
  isDefault?: boolean;
}

/** Persisted between runs so your scan folder and selection survive a restart. */
export interface WorkspaceState {
  scanRoot?: string;
  /** Absolute path of the inspected workspace; undefined = the default/boot one. */
  activePath?: string;
}

const STATE_FILE = path.join(os.homedir(), ".aletheia", "workspaces.json");

// Directories never worth descending into when scanning for agents.
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
]);

/** Expand a leading `~` to the user's home directory. */
export function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** True if `dir` is an eve agent workspace (has `agent/agent.ts`). */
export async function isEveWorkspace(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, "agent", "agent.ts"));
    return true;
  } catch {
    return false;
  }
}

/** The agent's declared name from agent.ts, falling back to the folder name. */
export async function readAgentName(workspaceRoot: string): Promise<string> {
  try {
    const src = await fs.readFile(path.join(workspaceRoot, "agent", "agent.ts"), "utf8");
    const m = src.match(/name\s*:\s*["'`]([^"'`]+)["'`]/);
    if (m?.[1]?.trim()) return m[1].trim();
  } catch {
    /* fall through to folder name */
  }
  return path.basename(workspaceRoot);
}

/**
 * Recursively find eve agent workspaces under `root`. Stops descending once a
 * directory is itself an agent (agents don't nest), skips hidden and heavy
 * directories, and caps depth so a scan over a big tree stays quick.
 */
export async function discoverAgents(
  root: string,
  maxDepth = 4
): Promise<DiscoveredAgent[]> {
  const found: DiscoveredAgent[] = [];
  const seen = new Set<string>();

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    if (await isEveWorkspace(dir)) {
      if (!seen.has(dir)) {
        seen.add(dir);
        found.push({ path: dir, name: await readAgentName(dir) });
      }
      return; // an agent workspace is a leaf — don't recurse into it
    }
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      await walk(path.join(dir, e.name), depth + 1);
    }
  }

  await walk(root, 0);
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** Load persisted workspace state (scan root + active selection). */
export async function loadState(): Promise<WorkspaceState> {
  try {
    const parsed = JSON.parse(await fs.readFile(STATE_FILE, "utf8")) as WorkspaceState;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist workspace state (best-effort; a write failure is non-fatal). */
export async function saveState(state: WorkspaceState): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    /* best effort — inspection still works in-memory this session */
  }
}
