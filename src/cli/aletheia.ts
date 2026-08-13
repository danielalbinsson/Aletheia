#!/usr/bin/env node
// aletheia — headless CLI. Commands: diff, passport, portrait, snapshot, init.
// `aletheia diff` builds the agent, reads eve's compiled manifest, diffs it
// against a baseline, and prints a PR-ready report.
// Exit: 0 = ok, 1 = fail-on threshold hit (diff/passport), 2 = error
// (no manifest / build fail). snapshot never fails on elevation.
// init writes inspection sidecars and a PR workflow; it does not operate
// the agent.
//
// Thin wrapper over the shipped engine: manifestAdapter + capabilityDiff.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { resolveBuildBaseline } from "../server/buildBaseline";
import { runEveBuild } from "../server/eveBuild";
import { runEveManifest } from "../server/eveObservability";
import { writeDeployedSnapshot } from "../server/capabilitySnapshot";
import {
  diffSnapshots,
  snapshotFromFacts,
  type CapabilitySnapshot,
} from "../parser/capabilityDiff";
import { parsePolicy, type Policy } from "../parser/policy";
import { consentDrift } from "../parser/sourceScan";
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
import { evaluatePassport } from "../parser/passport";
import {
  renderPassportJson,
  renderPassportMarkdown,
  type PassportMeta,
} from "./renderPassport";
import {
  buildPortraitCard,
  renderPortraitJson,
  renderPortraitText,
} from "./renderPortraitCard";
import type { AgentModel } from "../model";
import {
  applyConsent,
  CONSENT_REL,
  driftWarnings,
  MANIFEST_REL,
  parseArgs,
  readJsonSnapshot,
  resolveBaseline,
  SNAPSHOT_REL,
  TOOLS_REL,
  type CliCommand,
  type CliOptions,
} from "./cliCore";
import { assertEveWorkspace, writeInitFiles } from "./initWorkspace";

const execFileAsync = promisify(execFile);

/** Read `agent/tools/*.ts` as { toolName: source }, for source-declared signals. */
async function loadToolSources(root: string): Promise<Record<string, string>> {
  const dir = path.join(root, TOOLS_REL);
  const sources: Record<string, string> = {};
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return sources;
  }
  await Promise.all(
    names
      .filter((n) => n.endsWith(".ts"))
      .map(async (n) => {
        try {
          sources[n.slice(0, -".ts".length)] = await fs.readFile(path.join(dir, n), "utf8");
        } catch {
          /* skip unreadable file */
        }
      })
  );
  return sources;
}

/** Read the consent sidecar's `gated` map (tool name → reason), or {} if absent. */
async function loadConsent(root: string): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(root, CONSENT_REL), "utf8");
    const parsed = JSON.parse(raw) as { gated?: Record<string, string> };
    return parsed.gated && typeof parsed.gated === "object" ? parsed.gated : {};
  } catch {
    return {};
  }
}

async function loadPolicy(root: string): Promise<Policy> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(root, ".aletheia/policy.json"), "utf8"));
    return parsePolicy(raw);
  } catch {
    return { rules: [] };
  }
}

/** Like loadPolicy, but reports whether the file actually existed. */
async function loadPolicyWithPresence(root: string): Promise<{ policy: Policy; present: boolean }> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(root, ".aletheia/policy.json"), "utf8"));
    return { policy: parsePolicy(raw), present: true };
  } catch {
    return { policy: { rules: [] }, present: false };
  }
}

/** Read the agent's UX.md (repo-root or agent/), or null if absent. */
async function loadUxDoc(root: string): Promise<string | null> {
  for (const rel of ["UX.md", "agent/UX.md"]) {
    try {
      return await fs.readFile(path.join(root, rel), "utf8");
    } catch {
      /* try next */
    }
  }
  return null;
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

/**
 * `git:` / `file:` may be null (first snapshot). `build:<ref>` never is —
 * checkout or eve build failure throws and the CLI exits 2.
 */
async function loadBaseline(spec: string, root: string): Promise<CapabilitySnapshot | null> {
  if (spec.startsWith("build:")) {
    return resolveBuildBaseline(spec, root);
  }
  return resolveBaseline(spec, root);
}

function baselineErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith("aletheia:") ? msg : `aletheia: ${msg}`;
}

async function runDiff(opts: CliOptions): Promise<number> {
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

  const gated = await loadConsent(root);
  const facts = applyConsent(manifest.facts, gated);
  const current = snapshotFromFacts(facts);
  let baseline: CapabilitySnapshot | null;
  try {
    baseline = await loadBaseline(opts.baseline, root);
  } catch (err) {
    process.stderr.write(`${baselineErrorMessage(err)}\n`);
    return 2;
  }
  const diff = diffSnapshots(baseline, current, { rules: policy.rules });

  const warnings = [
    ...(manifest.warnings ?? []),
    ...driftWarnings(consentDrift(await loadToolSources(root), gated)),
  ];

  const meta: DiffMeta = {
    headSha: await gitShortSha(root),
    manifestSha: await manifestSha(root),
    baseline: opts.baseline,
    failOn,
    ackLabel: opts.ackLabel,
  };

  const text =
    opts.format === "json"
      ? renderJson(diff, current, meta, warnings)
      : renderMarkdown(diff, current, meta, portraitView(facts), warnings);
  await emit(text, opts.out);

  return verdict(diff, failOn).failing ? 1 : 0;
}

// `aletheia passport` — mechanically evaluate the Kit Certified checklist and
// emit a passport generated from the build. Exit: 0 = certified, 1 = not
// certified, 2 = error (build/manifest failure). Reuses every loader `diff`
// uses, so the passport and the portrait can never disagree about the facts.
async function runPassport(opts: CliOptions): Promise<number> {
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

  const gated = await loadConsent(root);
  const toolSources = await loadToolSources(root);
  const { policy, present: policyPresent } = await loadPolicyWithPresence(root);
  const facts = applyConsent(manifest.facts, gated);
  const current = snapshotFromFacts(facts);
  let baseline: CapabilitySnapshot | null;
  try {
    baseline = await loadBaseline(opts.baseline, root);
  } catch (err) {
    process.stderr.write(`${baselineErrorMessage(err)}\n`);
    return 2;
  }
  const failOn = opts.failOnExplicit ? opts.failOn : policy.failOn ?? opts.failOn;
  const diff = diffSnapshots(baseline, current, { rules: policy.rules });

  const result = evaluatePassport({
    manifestBuilt: true,
    facts,
    consentGated: gated,
    consentDrift: consentDrift(toolSources, gated),
    policy,
    policyPresent,
    baseline,
    // A missing baseline is its own failed check; only treat a present baseline's
    // verdict as the diff signal so "no baseline" isn't double-counted as a pass.
    diffPasses: baseline !== null && !verdict(diff, failOn).failing,
    uxDoc: await loadUxDoc(root),
  });

  const meta: PassportMeta = {
    headSha: await gitShortSha(root),
    manifestSha: await manifestSha(root),
    generatedAt: new Date().toISOString(),
  };

  const text =
    opts.format === "json"
      ? renderPassportJson(result, meta)
      : renderPassportMarkdown(result, facts, meta);
  await emit(text, opts.out);

  return result.certified ? 0 : 1;
}

// `aletheia portrait` — emit the portrait as a generated artifact from the
// build (JSON or text). Replaces shipping stale JPEG screenshots. Exit: 0 ok,
// 2 = error (build/manifest failure). Reuses the same facts loading as diff and
// passport, so all three stay consistent.
async function runPortrait(opts: CliOptions): Promise<number> {
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

  const gated = await loadConsent(root);
  const facts = applyConsent(manifest.facts, gated);
  const view = portraitView(facts);
  const card = buildPortraitCard(facts, view.rows, {
    verified: true,
    headSha: await gitShortSha(root),
    manifestSha: await manifestSha(root),
    generatedAt: new Date().toISOString(),
  });

  const text = opts.format === "json" ? renderPortraitJson(card) : renderPortraitText(card);
  await emit(text, opts.out);
  return 0;
}

// `aletheia snapshot` — write the committed deploy baseline from current facts.
// Exit: 0 = wrote, 2 = error (build/manifest failure). Does not fail on elevation.
async function runSnapshot(opts: CliOptions): Promise<number> {
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

  const gated = await loadConsent(root);
  const facts = applyConsent(manifest.facts, gated);
  const current = snapshotFromFacts(facts);

  let dest: string;
  if (opts.out) {
    dest = path.resolve(opts.out);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  } else {
    await writeDeployedSnapshot(path.join(root, "agent"), current);
    dest = path.join(root, SNAPSHOT_REL);
  }

  process.stdout.write(
    `Wrote ${dest}\ncommit this file so the next \`aletheia diff\` uses it as baseline.\n`
  );
  return 0;
}

// `aletheia init` — write policy, consent sidecar, and a thin PR workflow
// wrapping the composite Action. Inspection only: does not run or deploy
// the agent. Then the same path as `aletheia snapshot` unless skipped.
async function runInit(opts: CliOptions): Promise<number> {
  const root = opts.agentDir;
  try {
    await assertEveWorkspace(root);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 2;
  }

  const result = await writeInitFiles(root, {
    force: opts.force,
    actionRef: opts.actionRef ?? process.env.ALETHEIA_ACTION_SHA,
  });
  for (const rel of result.written) process.stdout.write(`wrote ${rel}\n`);
  for (const rel of result.kept) {
    process.stdout.write(`kept ${rel} (exists; pass --force to overwrite)\n`);
  }
  process.stdout.write(
    "Aletheia writes inspection sidecars and a PR workflow; it does not run or deploy the agent.\n"
  );

  const skipSnapshot = !opts.snapshot || !opts.build;
  if (skipSnapshot) {
    const reason = !opts.snapshot ? "--no-snapshot" : "--no-build";
    process.stdout.write(`skipped snapshot (${reason})\n`);
    return 0;
  }

  const existing = await readJsonSnapshot(path.join(root, SNAPSHOT_REL));
  if (existing) {
    process.stdout.write(
      `kept ${SNAPSHOT_REL} (exists; run \`aletheia snapshot\` to update)\n`
    );
    return 0;
  }

  return runSnapshot(opts);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (
    command !== "diff" &&
    command !== "passport" &&
    command !== "portrait" &&
    command !== "snapshot" &&
    command !== "init"
  ) {
    process.stderr.write(
      "usage:\n" +
        "  aletheia diff     [--baseline file:<p>|git:<ref>|build:<ref>] [--format markdown|json] [--fail-on elevated|any|never] [--out <file>] [--no-build] [--agent-dir <path>] [--ack-label <label>]\n" +
        "  aletheia passport [--format markdown|json] [--out <file>] [--no-build] [--agent-dir <path>]\n" +
        "  aletheia portrait [--format markdown|json] [--out <file>] [--no-build] [--agent-dir <path>]\n" +
        "  aletheia snapshot [--out <file>] [--no-build] [--agent-dir <path>]\n" +
        "  aletheia init     [--force] [--no-snapshot] [--no-build] [--agent-dir <path>] [--action-ref <sha>]\n"
    );
    process.exit(command ? 2 : 0);
  }
  try {
    const opts = parseArgs(rest, process.cwd(), command as CliCommand);
    if (command === "passport") process.exit(await runPassport(opts));
    if (command === "portrait") process.exit(await runPortrait(opts));
    if (command === "snapshot") process.exit(await runSnapshot(opts));
    if (command === "init") process.exit(await runInit(opts));
    process.exit(await runDiff(opts));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${msg.startsWith("aletheia:") ? msg : `aletheia: ${msg}`}\n`);
    process.exit(2);
  }
}

void main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${msg.startsWith("aletheia:") ? msg : `aletheia: ${msg}`}\n`);
  process.exit(2);
});
