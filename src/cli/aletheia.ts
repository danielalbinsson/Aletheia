#!/usr/bin/env node
// aletheia — headless CLI. `aletheia diff` builds the agent, reads eve's
// compiled manifest, diffs it against a baseline, and prints a PR-ready report.
// Exit: 0 = ok, 1 = fail-on threshold hit, 2 = error (no manifest / build fail).
//
// Thin wrapper over the shipped engine: manifestAdapter + capabilityDiff.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { runEveBuild } from "../server/eveBuild";
import { runEveManifest } from "../server/eveObservability";
import {
  diffSnapshots,
  snapshotFromFacts,
  type CapabilitySnapshot,
} from "../parser/capabilityDiff";
import { parsePolicy, type Policy } from "../parser/policy";
import type { ManifestFacts } from "../parser/manifestAdapter";
import { deriveSignals } from "../portrait/signals";
import { renderPortrait } from "../portrait/portrait";
import {
  renderJson,
  renderMarkdown,
  verdict,
  type DiffMeta,
  type PortraitView,
} from "./renderDiff";
import type { AgentModel } from "../model";

const execFileAsync = promisify(execFile);
const SNAPSHOT_REL = "agent/.aletheia/deployed-capabilities.json";
const MANIFEST_REL = ".eve/compile/compiled-agent-manifest.json";

interface Options {
  baseline: string;
  format: "markdown" | "json";
  failOn: "elevated" | "any" | "never";
  failOnExplicit: boolean;
  out?: string;
  build: boolean;
  agentDir: string;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    baseline: `file:${SNAPSHOT_REL}`,
    format: "markdown",
    failOn: "elevated",
    failOnExplicit: false,
    build: true,
    agentDir: process.cwd(),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--baseline") o.baseline = next();
    else if (a === "--format") o.format = next() as Options["format"];
    else if (a === "--fail-on") {
      o.failOn = next() as Options["failOn"];
      o.failOnExplicit = true;
    } else if (a === "--out") o.out = next();
    else if (a === "--no-build") o.build = false;
    else if (a === "--agent-dir") o.agentDir = path.resolve(next());
  }
  return o;
}

async function loadPolicy(root: string): Promise<Policy> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(root, ".aletheia/policy.json"), "utf8"));
    return parsePolicy(raw);
  } catch {
    return { rules: [] };
  }
}

async function readJsonSnapshot(file: string): Promise<CapabilitySnapshot | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as CapabilitySnapshot;
    return Array.isArray(parsed.capabilities) ? parsed : null;
  } catch {
    return null;
  }
}

/** Resolve the baseline spec into a snapshot (null = no baseline → initial). */
async function resolveBaseline(spec: string, root: string): Promise<CapabilitySnapshot | null> {
  if (spec.startsWith("file:")) {
    return readJsonSnapshot(path.resolve(root, spec.slice("file:".length)));
  }
  if (spec.startsWith("git:")) {
    const ref = spec.slice("git:".length);
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["show", `${ref}:${SNAPSHOT_REL}`],
        { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
      );
      const parsed = JSON.parse(stdout) as CapabilitySnapshot;
      return Array.isArray(parsed.capabilities) ? parsed : null;
    } catch {
      // No committed snapshot at that ref → treat as first deploy.
      return null;
    }
  }
  throw new Error(
    `Unsupported --baseline "${spec}". Use file:<path> or git:<ref> (url:/build: are planned).`
  );
}

async function gitShortSha(root: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function manifestSha(root: string): Promise<string | undefined> {
  try {
    const buf = await fs.readFile(path.join(root, MANIFEST_REL));
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return undefined;
  }
}

/** Render the deterministic portrait from manifest facts, for the PR comment. */
function portraitView(facts: ManifestFacts): PortraitView {
  const name = facts.name ?? "Agent";
  const model: AgentModel = {
    id: name.toLowerCase(),
    name,
    essence: facts.essence ?? "",
    motif: facts.motif ?? "form",
    intro: "",
    domain: [],
    theme: {} as AgentModel["theme"],
    runsOn: facts.runsOn,
    capabilities: facts.capabilities,
    reach: facts.reach,
    autonomy: facts.autonomy,
    restrictions: facts.restrictions,
    subagents: facts.subagents,
  };
  return { name, rows: renderPortrait(deriveSignals(model)) };
}

async function emit(text: string, out?: string): Promise<void> {
  if (out) await fs.writeFile(out, text.endsWith("\n") ? text : `${text}\n`, "utf8");
  else process.stdout.write(`${text}\n`);
}

async function runDiff(opts: Options): Promise<number> {
  const root = opts.agentDir;

  if (opts.build) {
    const build = await runEveBuild(root);
    if (!build.ok) {
      const msg =
        build.diagnostics
          .filter((d) => d.severity === "error")
          .map((d) => `${d.sourcePath ?? "project"}: ${d.message}`)
          .join("; ") || build.stderr || "eve build failed";
      process.stderr.write(`aletheia: build failed — ${msg}\n`);
      return 2;
    }
  }

  const manifest = await runEveManifest(root);
  if (!manifest.built || !manifest.facts) {
    process.stderr.write(
      `aletheia: no compiled manifest. Build the agent first (omit --no-build).\n`
    );
    return 2;
  }

  const policy = await loadPolicy(root);
  const failOn = opts.failOnExplicit ? opts.failOn : policy.failOn ?? opts.failOn;

  const current = snapshotFromFacts(manifest.facts);
  const baseline = await resolveBaseline(opts.baseline, root);
  const diff = diffSnapshots(baseline, current, { rules: policy.rules });

  const meta: DiffMeta = {
    headSha: await gitShortSha(root),
    manifestSha: await manifestSha(root),
    baseline: opts.baseline,
    failOn,
  };

  const text =
    opts.format === "json"
      ? renderJson(diff, current, meta)
      : renderMarkdown(diff, current, meta, portraitView(manifest.facts));
  await emit(text, opts.out);

  return verdict(diff, failOn).failing ? 1 : 0;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "diff") {
    process.stderr.write("usage: aletheia diff [--baseline file:<p>|git:<ref>] [--format markdown|json] [--fail-on elevated|any|never] [--out <file>] [--no-build] [--agent-dir <path>]\n");
    process.exit(command ? 2 : 0);
  }
  process.exit(await runDiff(parseArgs(rest)));
}

void main();
