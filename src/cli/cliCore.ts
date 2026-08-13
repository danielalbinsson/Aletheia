// Shared CLI helpers — kept free of process.exit / argv side effects so unit
// tests can cover baseline resolution, consent overlay, and flag parsing.

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  parseCapabilitySnapshot,
  type CapabilitySnapshot,
} from "../parser/capabilityDiff";
import type { ManifestFacts } from "../parser/manifestAdapter";

const execFileAsync = promisify(execFile);

export const SNAPSHOT_REL = "agent/.aletheia/deployed-capabilities.json";
export const MANIFEST_REL = ".eve/compile/compiled-agent-manifest.json";
export const CONSENT_REL = "agent/.aletheia/consent.json";
export const TOOLS_REL = "agent/tools";

export const FAIL_ON_VALUES = ["elevated", "any", "never"] as const;
export const FORMAT_VALUES = ["markdown", "json"] as const;
export type FailOn = (typeof FAIL_ON_VALUES)[number];
export type CliFormat = (typeof FORMAT_VALUES)[number];
export type CliCommand = "diff" | "passport" | "portrait" | "snapshot" | "init";

/** Tooling / usage failure. The CLI maps this to exit 2 — never acknowledgeable. */
export class AletheiaCliError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message.startsWith("aletheia:") ? message : `aletheia: ${message}`);
    this.name = "AletheiaCliError";
  }
}

export interface CliOptions {
  baseline: string;
  format: CliFormat;
  failOn: FailOn;
  failOnExplicit: boolean;
  out?: string;
  build: boolean;
  /** Overwrite existing init sidecars. Other commands ignore this. */
  force: boolean;
  /** When false (`--no-snapshot`), `init` skips the snapshot path. */
  snapshot: boolean;
  agentDir: string;
  /** PR label named in remediation copy. */
  ackLabel: string;
  /** Immutable commit SHA for the generated Action pin. */
  actionRef?: string;
}

const KNOWN_FLAGS = new Set([
  "--baseline",
  "--format",
  "--fail-on",
  "--out",
  "--no-build",
  "--force",
  "--no-snapshot",
  "--agent-dir",
  "--ack-label",
  "--action-ref",
]);

function isFailOn(v: string): v is FailOn {
  return (FAIL_ON_VALUES as readonly string[]).includes(v);
}

function isFormat(v: string): v is CliFormat {
  return (FORMAT_VALUES as readonly string[]).includes(v);
}

function isSha(v: string): boolean {
  return /^[0-9a-f]{40}$/i.test(v);
}

export function parseArgs(argv: string[], cwd = process.cwd(), command?: CliCommand): CliOptions {
  const o: CliOptions = {
    baseline: `file:${SNAPSHOT_REL}`,
    format: "markdown",
    failOn: "elevated",
    failOnExplicit: false,
    build: true,
    force: false,
    snapshot: true,
    agentDir: cwd,
    ackLabel: "capability-change-ack",
  };
  const take = (flag: string, i: number): [string, number] => {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new AletheiaCliError(`missing value for ${flag}`);
    }
    return [value, i + 1];
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      throw new AletheiaCliError(`unexpected argument "${a}"`);
    }
    if (!KNOWN_FLAGS.has(a)) {
      throw new AletheiaCliError(`unknown flag "${a}"`);
    }
    if (a === "--baseline") {
      const [v, ni] = take(a, i);
      o.baseline = v;
      i = ni;
    } else if (a === "--format") {
      const [v, ni] = take(a, i);
      if (!isFormat(v)) {
        throw new AletheiaCliError(`invalid --format "${v}". Use markdown or json.`);
      }
      o.format = v;
      i = ni;
    } else if (a === "--fail-on") {
      const [v, ni] = take(a, i);
      if (!isFailOn(v)) {
        throw new AletheiaCliError(`invalid --fail-on "${v}". Use elevated, any, or never.`);
      }
      o.failOn = v;
      o.failOnExplicit = true;
      i = ni;
    } else if (a === "--out") {
      const [v, ni] = take(a, i);
      o.out = v;
      i = ni;
    } else if (a === "--no-build") {
      o.build = false;
    } else if (a === "--force") {
      o.force = true;
    } else if (a === "--no-snapshot") {
      o.snapshot = false;
    } else if (a === "--agent-dir") {
      const [v, ni] = take(a, i);
      o.agentDir = path.resolve(cwd, v);
      i = ni;
    } else if (a === "--ack-label") {
      const [v, ni] = take(a, i);
      o.ackLabel = v;
      i = ni;
    } else if (a === "--action-ref") {
      const [v, ni] = take(a, i);
      if (!isSha(v)) {
        throw new AletheiaCliError(`invalid --action-ref "${v}". Use a 40-character commit SHA.`);
      }
      o.actionRef = v.toLowerCase();
      i = ni;
    }
  }

  if (!o.build && o.baseline.startsWith("build:")) {
    throw new AletheiaCliError(
      `--no-build cannot be combined with --baseline ${o.baseline}. build:<ref> always runs eve build in an isolated checkout.`
    );
  }

  if (command && command !== "init") {
    if (!o.snapshot) {
      throw new AletheiaCliError(`--no-snapshot is only valid with aletheia init`);
    }
    if (o.force) {
      throw new AletheiaCliError(`--force is only valid with aletheia init`);
    }
    if (o.actionRef) {
      throw new AletheiaCliError(`--action-ref is only valid with aletheia init`);
    }
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
 * Nested `--agent-dir examples/ledger` must resolve to
 * `examples/ledger/agent/.aletheia/deployed-capabilities.json`.
 *
 * Walks up from `agentRoot` for a `.git` directory first so a polluted
 * `GIT_DIR` / outer worktree cannot point `git show` at the wrong repo.
 */
export async function gitSnapshotRelPath(agentRoot: string): Promise<string> {
  const abs = path.join(agentRoot, SNAPSHOT_REL);
  const toplevel = await gitToplevel(agentRoot);
  if (!toplevel) return SNAPSHOT_REL;
  return path.relative(toplevel, abs).split(path.sep).join("/");
}

/** Nearest git root for `start`, preferring a `.git` walk over `GIT_DIR`. */
export async function gitToplevel(start: string): Promise<string | null> {
  return (await findGitToplevel(start)) ?? (await gitRevParseToplevel(start));
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

function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_COMMON_DIR;
  return env;
}

async function gitRevParseToplevel(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      env: gitEnv(),
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function errText(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { stderr?: string; message?: string };
    return `${e.stderr ?? ""} ${e.message ?? ""}`;
  }
  return String(err);
}

export async function readJsonSnapshot(file: string): Promise<CapabilitySnapshot | null> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw new AletheiaCliError(`cannot read baseline ${file}: ${errText(err).trim()}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AletheiaCliError(`malformed baseline JSON at ${file}`);
  }
  try {
    return parseCapabilitySnapshot(parsed, file);
  } catch (err) {
    throw new AletheiaCliError(err instanceof Error ? err.message : String(err));
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
    if (!ref) {
      throw new AletheiaCliError(`invalid --baseline "${spec}". Use git:<ref>.`);
    }
    const snapPath = await gitSnapshotRelPath(root);
    try {
      await execFileAsync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
        cwd: root,
        encoding: "utf8",
        env: gitEnv(),
      });
    } catch {
      throw new AletheiaCliError(`unknown git ref "${ref}" for --baseline git:${ref}`);
    }
    let stdout: string;
    try {
      const shown = await execFileAsync("git", ["show", `${ref}:${snapPath}`], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        env: gitEnv(),
      });
      stdout = shown.stdout;
    } catch (err) {
      const msg = errText(err);
      if (/does not exist|exists on disk, but not in|not in '.+'/i.test(msg)) {
        return null;
      }
      throw new AletheiaCliError(`cannot read ${snapPath} at git:${ref}: ${msg.trim()}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new AletheiaCliError(`malformed baseline JSON at git:${ref}:${snapPath}`);
    }
    try {
      return parseCapabilitySnapshot(parsed, `${ref}:${snapPath}`);
    } catch (err) {
      throw new AletheiaCliError(err instanceof Error ? err.message : String(err));
    }
  }
  if (spec.startsWith("build:")) {
    throw new AletheiaCliError(
      `Cannot resolve "${spec}" as a committed snapshot. build:<ref> needs an isolated checkout and eve build (resolveBuildBaseline).`
    );
  }
  throw new AletheiaCliError(
    `Unsupported --baseline "${spec}". Use file:<path>, git:<ref>, or build:<ref>.`
  );
}
