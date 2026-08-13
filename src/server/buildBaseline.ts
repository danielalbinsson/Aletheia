// Isolated `build:<ref>` baseline: checkout that ref, install its frozen
// dependency graph, run eve build, snapshot.
// Kept next to runEveBuild (not in cliCore) so cliCore unit tests never spawn eve.

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  applyConsent,
  CONSENT_REL,
  gitToplevel,
} from "../cli/cliCore";
import { snapshotFromFacts, type CapabilitySnapshot } from "../parser/capabilityDiff";
import { runEveBuild, type EveBuildResult } from "./eveBuild";
import { eveBinPath } from "./eveCli";
import { runEveManifest } from "./eveObservability";

const execFileAsync = promisify(execFile);

export interface ResolveBuildBaselineDeps {
  /** Injected in tests so a fixture repo does not need a real eve install. */
  runBuild?: (workspaceRoot: string, ctx: { eveBin: string }) => Promise<EveBuildResult>;
  /** Injected in tests so a fixture repo does not need network/pnpm. */
  install?: (worktreeDir: string) => Promise<void>;
}

function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_COMMON_DIR;
  return env;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    env: gitEnv(),
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

async function loadConsent(root: string): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(root, CONSENT_REL), "utf8");
    const parsed = JSON.parse(raw) as { gated?: Record<string, string> };
    return parsed.gated && typeof parsed.gated === "object" ? parsed.gated : {};
  } catch {
    return {};
  }
}

async function snapshotFromWorkspace(workspaceRoot: string): Promise<CapabilitySnapshot> {
  const manifest = await runEveManifest(workspaceRoot);
  if (!manifest.built || !manifest.facts) {
    throw new Error("produced no compiled manifest");
  }
  return snapshotFromFacts(applyConsent(manifest.facts, await loadConsent(workspaceRoot)));
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveWorktreeEveBin(agentInWorktree: string, worktreeDir: string): Promise<string> {
  const candidates = [eveBinPath(agentInWorktree), eveBinPath(worktreeDir)];
  for (const p of candidates) {
    if (await pathExists(p)) return p;
  }
  return candidates[0];
}

function buildFailureMessage(ref: string, build: EveBuildResult): string {
  const fromDiag = build.diagnostics
    .filter((d) => d.severity === "error")
    .map((d) => `${d.sourcePath ?? "project"}: ${d.message}`)
    .join("; ");
  const detail = fromDiag || build.stderr.trim() || "eve build failed";
  return `aletheia: --baseline build:${ref} failed — ${detail}`;
}

async function defaultInstall(worktreeDir: string): Promise<void> {
  const lock = path.join(worktreeDir, "pnpm-lock.yaml");
  if (!(await pathExists(lock))) {
    throw new Error(
      `no pnpm-lock.yaml at this ref; install the ref's frozen dependency graph before claiming an isolated baseline`
    );
  }
  await execFileAsync("pnpm", ["install", "--frozen-lockfile"], {
    cwd: worktreeDir,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
}

/**
 * Resolve `build:<ref>` to a snapshot. Never returns null — failure throws
 * (CLI maps that to exit 2). Null would look like a first snapshot.
 */
export async function resolveBuildBaseline(
  spec: string,
  root: string,
  deps: ResolveBuildBaselineDeps = {}
): Promise<CapabilitySnapshot> {
  if (!spec.startsWith("build:")) {
    throw new Error(`aletheia: expected build:<ref>, got "${spec}"`);
  }
  const ref = spec.slice("build:".length).trim();
  if (!ref) {
    throw new Error(`aletheia: invalid --baseline "${spec}". Use build:<ref>.`);
  }

  const agentRoot = path.resolve(root);
  const gitRoot = await gitToplevel(agentRoot);
  if (!gitRoot) {
    throw new Error(`aletheia: --baseline build:${ref} requires a git repository.`);
  }

  const rel = path.relative(gitRoot, agentRoot);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`aletheia: --agent-dir is not inside the git repository for build:${ref}.`);
  }

  try {
    await git(gitRoot, ["rev-parse", "--verify", `${ref}^{commit}`]);
  } catch {
    throw new Error(`aletheia: unknown git ref "${ref}" for --baseline build:${ref}`);
  }

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-build-ref-"));
  const worktreeDir = path.join(tmpRoot, "wt");
  let added = false;
  try {
    try {
      await git(gitRoot, ["worktree", "add", "--detach", worktreeDir, ref]);
      added = true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`aletheia: could not check out "${ref}" for build:${ref} — ${detail.trim()}`);
    }

    const agentInWorktree = rel === "" ? worktreeDir : path.join(worktreeDir, rel);
    const install = deps.install ?? defaultInstall;
    try {
      await install(worktreeDir);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`aletheia: --baseline build:${ref} install failed — ${detail.trim()}`);
    }

    const eveBin = await resolveWorktreeEveBin(agentInWorktree, worktreeDir);
    const runBuild =
      deps.runBuild ??
      (async (workspaceRoot: string, ctx: { eveBin: string }) => {
        if (!(await pathExists(ctx.eveBin))) {
          throw new Error(
            `aletheia: eve CLI not found (${ctx.eveBin}); the ref's install did not provide eve`
          );
        }
        return runEveBuild(workspaceRoot, { eveBin: ctx.eveBin });
      });

    const build = await runBuild(agentInWorktree, { eveBin });
    if (!build.ok) {
      throw new Error(buildFailureMessage(ref, build));
    }

    try {
      return await snapshotFromWorkspace(agentInWorktree);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`aletheia: --baseline build:${ref} ${detail}`);
    }
  } finally {
    if (added) {
      try {
        await git(gitRoot, ["worktree", "remove", "--force", worktreeDir]);
      } catch {
        await fs.rm(worktreeDir, { recursive: true, force: true });
        try {
          await git(gitRoot, ["worktree", "prune"]);
        } catch {
          /* repo may already be gone */
        }
      }
    }
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}
