// Shared CLI helpers — kept free of process.exit / argv side effects so unit
// tests can cover baseline resolution, consent overlay, and flag parsing.

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { CapabilitySnapshot } from "../parser/capabilityDiff";
import type { ManifestFacts } from "../parser/manifestAdapter";

const execFileAsync = promisify(execFile);

export const SNAPSHOT_REL = "agent/.aletheia/deployed-capabilities.json";
export const MANIFEST_REL = ".eve/compile/compiled-agent-manifest.json";
export const CONSENT_REL = "agent/.aletheia/consent.json";
export const TOOLS_REL = "agent/tools";

export interface CliOptions {
  baseline: string;
  format: "markdown" | "json";
  failOn: "elevated" | "any" | "never";
  failOnExplicit: boolean;
  out?: string;
  build: boolean;
  agentDir: string;
}

export function parseArgs(argv: string[], cwd = process.cwd()): CliOptions {
  const o: CliOptions = {
    baseline: `file:${SNAPSHOT_REL}`,
    format: "markdown",
    failOn: "elevated",
    failOnExplicit: false,
    build: true,
    agentDir: cwd,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--baseline") o.baseline = next();
    else if (a === "--format") o.format = next() as CliOptions["format"];
    else if (a === "--fail-on") {
      o.failOn = next() as CliOptions["failOn"];
      o.failOnExplicit = true;
    } else if (a === "--out") o.out = next();
    else if (a === "--no-build") o.build = false;
    else if (a === "--agent-dir") o.agentDir = path.resolve(cwd, next());
  }
  return o;
}

/**
 * A tool that declares an approval gate in source but isn't in consent.json is
 * drift: the PR check reads the sidecar only, so the gate would go unrecorded.
 */
export function driftWarnings(drifted: string[]): string[] {
  if (drifted.length === 0) return [];
  return [
    `${drifted.length} tool(s) declare \`approval:\` in source but are missing from \`${CONSENT_REL}\`: ${drifted
      .map((t) => `\`${t}\``)
      .join(", ")}. This PR check reads the sidecar only — add them so the gate is recorded.`,
  ];
}

/** Overlay source-declared consent onto manifest facts. */
export function applyConsent(
  facts: ManifestFacts,
  gated: Record<string, string>
): ManifestFacts {
  if (Object.keys(gated).length === 0) return facts;
  return {
    ...facts,
    capabilities: facts.capabilities.map((c) => {
      const m = /^tools\/(.+)\.ts$/.exec(c.source);
      const reason = m ? gated[m[1]] : undefined;
      return reason !== undefined
        ? { ...c, consent: "asks-first" as const, consentReason: reason }
        : c;
    }),
  };
}

/**
 * Path to the committed snapshot as git sees it (repo-root relative).
 * Nested `--agent-dir examples/beacon` must resolve to
 * `examples/beacon/agent/.aletheia/deployed-capabilities.json`.
 *
 * Walks up from `agentRoot` for a `.git` directory first so a polluted
 * `GIT_DIR` / outer worktree cannot point `git show` at the wrong repo.
 */
export async function gitSnapshotRelPath(agentRoot: string): Promise<string> {
  const abs = path.join(agentRoot, SNAPSHOT_REL);
  const toplevel = (await findGitToplevel(agentRoot)) ?? (await gitRevParseToplevel(agentRoot));
  if (!toplevel) return SNAPSHOT_REL;
  return path.relative(toplevel, abs).split(path.sep).join("/");
}

async function findGitToplevel(start: string): Promise<string | null> {
  let dir = path.resolve(start);
  for (;;) {
    try {
      const st = await fs.stat(path.join(dir, ".git"));
      if (st.isDirectory() || st.isFile()) return dir;
    } catch {
      /* keep walking */
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function gitRevParseToplevel(cwd: string): Promise<string | null> {
  try {
    const env = { ...process.env };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    delete env.GIT_COMMON_DIR;
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      env,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function readJsonSnapshot(file: string): Promise<CapabilitySnapshot | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as CapabilitySnapshot;
    return Array.isArray(parsed.capabilities) ? parsed : null;
  } catch {
    return null;
  }
}

/** Resolve the baseline spec into a snapshot (null = no baseline → initial). */
export async function resolveBaseline(
  spec: string,
  root: string
): Promise<CapabilitySnapshot | null> {
  if (spec.startsWith("file:")) {
    return readJsonSnapshot(path.resolve(root, spec.slice("file:".length)));
  }
  if (spec.startsWith("git:")) {
    const ref = spec.slice("git:".length);
    const snapPath = await gitSnapshotRelPath(root);
    try {
      const env = { ...process.env };
      delete env.GIT_DIR;
      delete env.GIT_WORK_TREE;
      delete env.GIT_COMMON_DIR;
      const { stdout } = await execFileAsync(
        "git",
        ["show", `${ref}:${snapPath}`],
        { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024, env }
      );
      const parsed = JSON.parse(stdout) as CapabilitySnapshot;
      return Array.isArray(parsed.capabilities) ? parsed : null;
    } catch {
      return null;
    }
  }
  throw new Error(
    `Unsupported --baseline "${spec}". Use file:<path> or git:<ref> (url:/build: are planned).`
  );
}
