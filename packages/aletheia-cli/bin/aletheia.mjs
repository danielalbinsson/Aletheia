#!/usr/bin/env node

// ../../src/cli/aletheia.ts
import { execFile as execFile2 } from "node:child_process";
import { createHash } from "node:crypto";
import fs5 from "node:fs/promises";
import path6 from "node:path";
import { promisify as promisify2 } from "node:util";

// ../../src/server/eveBuild.ts
import fs from "node:fs/promises";
import path2 from "node:path";

// ../../src/server/eveCli.ts
import { spawn } from "node:child_process";
import path from "node:path";
function eveBinPath(workspaceRoot) {
  return path.join(workspaceRoot, "node_modules/eve/bin/eve.js");
}
function runEveCommand(workspaceRoot, args, onData) {
  const eveBin = eveBinPath(workspaceRoot);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [eveBin, ...args], {
      cwd: workspaceRoot,
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onData?.(text, "stdout");
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onData?.(text, "stderr");
    });
    child.on("close", (code) => {
      const exitCode = code ?? 1;
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout,
        stderr
      });
    });
  });
}

// ../../src/server/eveBuild.ts
function parseDiagnosticsJson(raw) {
  if (!raw || typeof raw !== "object") return [];
  const entries = Array.isArray(raw) ? raw : "entries" in raw && Array.isArray(raw.entries) ? raw.entries : "diagnostics" in raw && Array.isArray(raw.diagnostics) ? raw.diagnostics : [];
  return entries.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const e = entry;
    const severity = e.severity;
    if (severity !== "error" && severity !== "warning" && severity !== "info") {
      return null;
    }
    const message = typeof e.message === "string" ? e.message : String(e.message ?? "");
    return {
      severity,
      message,
      sourcePath: typeof e.sourcePath === "string" ? e.sourcePath : typeof e.path === "string" ? e.path : void 0,
      code: typeof e.code === "string" ? e.code : void 0
    };
  }).filter((d) => d !== null);
}
async function readDiagnostics(workspaceRoot) {
  const diagPath = path2.join(workspaceRoot, ".eve/discovery/diagnostics.json");
  try {
    const raw = JSON.parse(await fs.readFile(diagPath, "utf8"));
    return parseDiagnosticsJson(raw);
  } catch {
    return [];
  }
}
async function runEveBuild(workspaceRoot) {
  const result = await runEveCommand(workspaceRoot, ["build"]);
  const diagnostics = await readDiagnostics(workspaceRoot);
  const outputMatch = result.stdout.match(/built output at (.+)$/m);
  return {
    ok: result.ok && !diagnostics.some((d) => d.severity === "error"),
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    diagnostics,
    outputPath: outputMatch?.[1]?.trim()
  };
}

// ../../src/server/eveObservability.ts
import fs2 from "node:fs/promises";
import path3 from "node:path";

// ../../src/parser/manifestAdapter.ts
var FRAMEWORK_TOOL_PHRASE = {
  bash: "run shell commands",
  write_file: "write files",
  read_file: "read files",
  edit_file: "edit files",
  glob: "search for files by name",
  grep: "search inside files",
  web_fetch: "fetch web pages",
  web_search: "search the web",
  todo: "keep its own task list",
  ask_question: "ask you clarifying questions",
  agent: "spawn subagents"
};
function frameworkRestriction(slug) {
  const phrase = FRAMEWORK_TOOL_PHRASE[slug] ?? slug.replace(/[_-]+/g, " ").trim();
  return { tool: slug, label: phrase };
}
function mapRestrictions(m) {
  return (m.disabledFrameworkTools ?? []).map(frameworkRestriction);
}
function manifestRestrictionWarning(m) {
  const hasTools = (m.tools?.length ?? 0) > 0;
  if (hasTools && m.disabledFrameworkTools === void 0) {
    return "Manifest has tools but no `disabledFrameworkTools` field \u2014 restriction data may be missing (eve version drift?). Treating restrictions as unknown, not none.";
  }
  return null;
}
var MOTIF_RULES = [
  { motif: "correspondence", words: /\b(inbox|email|mail|message|correspond)/i },
  { motif: "ledger", words: /\b(book|ledger|reconcil|transaction|account|invoice|finance)/i },
  { motif: "hearth", words: /\b(support|customer|ticket|help|reply|conversation)/i },
  { motif: "atlas", words: /\b(research|search|web|gather|brief|read)/i }
];
function deriveMotif(text) {
  let motif = "form";
  let best = 0;
  for (const rule of MOTIF_RULES) {
    const hits = (text.match(new RegExp(rule.words, "gi")) || []).length;
    if (hits > best) {
      best = hits;
      motif = rule.motif;
    }
  }
  return motif;
}
function parseName(md) {
  return md.match(/^#\s+(.+)$/m)?.[1]?.trim();
}
function parseEssence(md) {
  const body = md.replace(/^#\s+.*$/m, "").trim();
  const firstPara = body.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  return firstPara.split(/(?<=[.!?])\s/)[0] || void 0;
}
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
function humanize(slug) {
  const s = slug.replace(/[_/-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function summarizeInputs(schema) {
  if (!schema || typeof schema !== "object") return void 0;
  const s = schema;
  const props = s.properties;
  if (!props || Object.keys(props).length === 0) return void 0;
  const required = new Set(s.required ?? []);
  const parts = Object.entries(props).map(([key, def]) => {
    const type = def?.type ? ` (${def.type})` : "";
    const opt = required.has(key) ? "" : " \u2014 optional";
    return `${humanize(key).toLowerCase()}${type}${opt}`;
  });
  return parts.join(", ");
}
function mapCapabilities(m) {
  const caps = [];
  for (const t of m.tools ?? []) {
    const name = t.name ?? t.logicalPath ?? "tool";
    caps.push({
      label: humanize(name),
      detail: t.description ?? "",
      origin: "tool",
      source: t.logicalPath ?? `tools/${name}.ts`,
      takes: summarizeInputs(t.inputSchema)
    });
  }
  for (const sk of m.skills ?? []) {
    const name = sk.name ?? "skill";
    caps.push({
      label: humanize(name),
      detail: sk.description ?? "",
      origin: "skill",
      source: sk.logicalPath ?? `skills/${name}/SKILL.md`
    });
  }
  return caps;
}
function mapReach(m) {
  const reach = [];
  for (const c of m.connections ?? []) {
    const protocol = c.protocol ? c.protocol.toUpperCase() : "API";
    reach.push({
      label: c.connectionName ?? c.url ?? "connection",
      kind: "api",
      detail: c.url ? `${protocol} \xB7 ${c.url}` : protocol
    });
  }
  const seenChannels = /* @__PURE__ */ new Set();
  for (const ch of m.channels ?? []) {
    const name = ch.name ?? ch.logicalPath ?? "channel";
    if (name === "eve" || seenChannels.has(name)) continue;
    seenChannels.add(name);
    reach.push({ label: name, kind: "channel" });
  }
  return reach;
}
function mapAutonomy(m) {
  return (m.schedules ?? []).map((s) => ({
    when: s.cron ? `On schedule (${s.cron})` : "On a schedule",
    does: s.markdown?.replace(/\s+/g, " ").trim() || "Runs authored code.",
    consent: "acts-on-its-own"
  }));
}
function mapSubagents(m) {
  const out = [];
  for (const s of m.subagents ?? []) {
    const sub = s.agent;
    const name = sub?.config?.name ?? s.name;
    if (!name) continue;
    out.push({
      name: humanize(name),
      description: s.description ?? sub?.config?.description,
      runsOn: sub?.config?.model?.id,
      capabilities: sub ? mapCapabilities(sub) : [],
      reach: sub ? mapReach(sub) : []
    });
  }
  return out;
}
function mapManifest(m) {
  const instructions = m.instructions?.markdown ?? "";
  const description = m.config?.description ?? "";
  return {
    runsOn: m.config?.model?.id,
    description: m.config?.description,
    // Prefer eve's verified agent name; fall back to the instructions H1. Avoids
    // a generic H1 ("# Agent") masking the real name from the compiled manifest.
    name: m.config?.name?.trim() || (instructions ? parseName(instructions) : void 0),
    essence: instructions ? parseEssence(instructions) : void 0,
    motif: deriveMotif(`${instructions}
${description}`),
    mind: {
      model: m.config?.model?.id,
      instructionsHash: instructions ? hashString(instructions) : void 0
    },
    capabilities: mapCapabilities(m),
    reach: mapReach(m),
    autonomy: mapAutonomy(m),
    restrictions: mapRestrictions(m),
    subagents: mapSubagents(m)
  };
}

// ../../src/server/eveObservability.ts
async function runEveManifest(workspaceRoot) {
  const manifestPath = path3.join(
    workspaceRoot,
    ".eve/compile/compiled-agent-manifest.json"
  );
  try {
    const raw = JSON.parse(await fs2.readFile(manifestPath, "utf8"));
    const warning = manifestRestrictionWarning(raw);
    return {
      ok: true,
      built: true,
      facts: mapManifest(raw),
      ...warning ? { warnings: [warning] } : {}
    };
  } catch {
    return {
      ok: false,
      built: false,
      error: "No compiled manifest found. Build the agent first."
    };
  }
}

// ../../src/server/capabilitySnapshot.ts
import fs3 from "node:fs/promises";
import path4 from "node:path";
var SNAPSHOT_REL = ".aletheia/deployed-capabilities.json";
function snapshotPath(agentRoot) {
  return path4.join(agentRoot, SNAPSHOT_REL);
}
async function writeDeployedSnapshot(agentRoot, snapshot) {
  const dest = snapshotPath(agentRoot);
  await fs3.mkdir(path4.dirname(dest), { recursive: true });
  await fs3.writeFile(dest, `${JSON.stringify(snapshot, null, 2)}
`, "utf8");
}

// ../../src/parser/consequence.ts
var DEFAULT_RULES = [
  { category: "payments", severity: "high", pattern: /\b(stripe|paypal|quickbooks|bank|ledger|invoic|billing|charge|payout|payment|treasury|plaid|wise|adyen)\b/i },
  { category: "secrets & identity", severity: "high", pattern: /\b(vault|secret|okta|auth0|\biam\b|oauth|credential|password|kms|token|clerk)\b/i },
  { category: "infrastructure", severity: "high", pattern: /\b(aws|gcp|azure|kubernetes|k8s|terraform|vercel|cloudflare|fly\.io|render|ec2|lambda|deploy)\b/i },
  { category: "data store", severity: "high", pattern: /\b(s3|postgres|mysql|mongo|database|bigquery|snowflake|redis|bucket|datastore|dynamodb|supabase)\b/i },
  { category: "code & repos", severity: "medium", pattern: /\b(github|gitlab|bitbucket|\brepo\b|\bgit\b)\b/i },
  { category: "communications", severity: "medium", pattern: /\b(slack|gmail|email|mail|twilio|sendgrid|intercom|zendesk|discord|teams|\bsms\b|notif|webhook)\b/i },
  { category: "calendar & docs", severity: "medium", pattern: /\b(calendar|gcal|notion|confluence|drive|sheets|docs|airtable)\b/i }
];
function classifyReach(label, detail = "", extra = []) {
  const hay = `${label} ${detail}`;
  for (const r of [...extra, ...DEFAULT_RULES]) {
    if (r.pattern.test(hay)) return { category: r.category, severity: r.severity };
  }
  return null;
}

// ../../src/parser/capabilityDiff.ts
function snapshotFromFacts(facts, capturedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    capturedAt,
    name: facts.name ?? "agent",
    mind: facts.mind,
    capabilities: facts.capabilities.map((c) => ({
      source: c.source,
      label: c.label,
      ...c.consent ? { consent: c.consent } : {}
    })),
    reach: facts.reach.map((r) => ({
      label: r.label,
      kind: r.kind,
      access: r.access,
      detail: r.detail
    })),
    autonomy: facts.autonomy.map((a) => ({
      does: a.does,
      when: a.when,
      consent: a.consent
    })),
    subagents: facts.subagents.map((s) => s.name),
    restrictions: (facts.restrictions ?? []).map((r) => ({
      tool: r.tool,
      label: r.label
    }))
  };
}
var ACCESS_RANK = {
  read: 0,
  write: 1,
  "read-write": 2
};
function rank(access) {
  return access ? ACCESS_RANK[access] : -1;
}
function isExternal(r) {
  return r.kind === "api" || r.kind === "channel";
}
function indexBy(items, key) {
  const m = /* @__PURE__ */ new Map();
  for (const it of items) m.set(key(it), it);
  return m;
}
function diffReach(prev, next, rules) {
  const prevByLabel = indexBy(prev, (r) => r.label.toLowerCase());
  const nextByLabel = indexBy(next, (r) => r.label.toLowerCase());
  const entries = [];
  for (const [key, r] of nextByLabel) {
    const before = prevByLabel.get(key);
    if (!before) {
      const c = isExternal(r) ? classifyReach(r.label, r.detail, rules) : null;
      entries.push({
        kind: "reach",
        change: "added",
        summary: `Can now reach ${r.label}${c ? ` \u2014 ${c.category}` : ""}${r.access ? ` (${r.access})` : ""}`,
        risk: isExternal(r) ? "elevated" : "routine",
        category: c?.category,
        severity: c?.severity
      });
    } else if (rank(r.access) > rank(before.access)) {
      entries.push({
        kind: "reach",
        change: "changed",
        summary: `${r.label}: access widened from ${before.access} to ${r.access}`,
        risk: "elevated"
      });
    } else if (rank(r.access) < rank(before.access)) {
      entries.push({
        kind: "reach",
        change: "changed",
        summary: `${r.label}: access narrowed from ${before.access} to ${r.access}`,
        risk: "routine"
      });
    }
  }
  for (const [key, r] of prevByLabel) {
    if (!nextByLabel.has(key)) {
      entries.push({
        kind: "reach",
        change: "removed",
        summary: `No longer reaches ${r.label}`,
        risk: "routine"
      });
    }
  }
  return entries;
}
function diffCapabilities(prev, next) {
  const prevBy = indexBy(prev, (c) => c.source);
  const nextBy = indexBy(next, (c) => c.source);
  const entries = [];
  for (const [key, c] of nextBy) {
    const before = prevBy.get(key);
    if (!before) {
      entries.push({
        kind: "capability",
        change: "added",
        // A new tool that arrives gated is reassuring; ungated is the baseline.
        summary: `New capability: ${c.label}${c.consent ? " (asks first)" : ""}`,
        risk: "routine"
      });
    } else if (before.consent === "asks-first" && c.consent !== "asks-first") {
      entries.push({
        kind: "capability",
        change: "changed",
        summary: `${c.label}: no longer asks first \u2014 approval gate removed`,
        risk: "elevated"
      });
    } else if (before.consent !== "asks-first" && c.consent === "asks-first") {
      entries.push({
        kind: "capability",
        change: "changed",
        summary: `${c.label}: now asks first before running`,
        risk: "routine"
      });
    }
  }
  for (const [key, c] of prevBy) {
    if (!nextBy.has(key)) {
      entries.push({
        kind: "capability",
        change: "removed",
        summary: `Removed capability: ${c.label}`,
        risk: "routine"
      });
    }
  }
  return entries;
}
function diffAutonomy(prev, next) {
  const key = (a) => `${a.when}::${a.does}`.toLowerCase();
  const prevBy = indexBy(prev, key);
  const nextBy = indexBy(next, key);
  const entries = [];
  for (const [k, a] of nextBy) {
    if (!prevBy.has(k)) {
      const onOwn = a.consent === "acts-on-its-own";
      entries.push({
        kind: "autonomy",
        change: "added",
        summary: `New autonomous action: ${a.does} \u2014 ${onOwn ? "acts on its own" : "asks first"} (${a.when})`,
        risk: onOwn ? "elevated" : "routine"
      });
    }
  }
  for (const [k, a] of prevBy) {
    if (!nextBy.has(k)) {
      entries.push({
        kind: "autonomy",
        change: "removed",
        summary: `No longer does: ${a.does}`,
        risk: "routine"
      });
    }
  }
  return entries;
}
function diffSubagents(prev, next) {
  const prevSet = new Set(prev.map((s) => s.toLowerCase()));
  const nextSet = new Set(next.map((s) => s.toLowerCase()));
  const entries = [];
  for (const s of next) {
    if (!prevSet.has(s.toLowerCase())) {
      entries.push({
        kind: "subagent",
        change: "added",
        summary: `Now delegates to ${s}`,
        risk: "elevated"
      });
    }
  }
  for (const s of prev) {
    if (!nextSet.has(s.toLowerCase())) {
      entries.push({
        kind: "subagent",
        change: "removed",
        summary: `No longer delegates to ${s}`,
        risk: "routine"
      });
    }
  }
  return entries;
}
function diffRestrictions(prev, next) {
  if (!prev) return [];
  const prevSet = indexBy(prev, (r) => r.tool);
  const nextSet = indexBy(next ?? [], (r) => r.tool);
  const entries = [];
  for (const [tool, r] of prevSet) {
    if (!nextSet.has(tool)) {
      entries.push({
        kind: "restriction",
        change: "removed",
        summary: `Restriction lifted: can now ${r.label} (${tool} re-enabled)`,
        risk: "elevated"
      });
    }
  }
  for (const [tool, r] of nextSet) {
    if (!prevSet.has(tool)) {
      entries.push({
        kind: "restriction",
        change: "added",
        summary: `Now restricted: cannot ${r.label} (${tool} disabled)`,
        risk: "routine"
      });
    }
  }
  return entries;
}
function diffMind(prev, next) {
  if (!prev || !next) return [];
  const entries = [];
  if (prev.model && next.model && prev.model !== next.model) {
    entries.push({
      kind: "mind",
      change: "changed",
      summary: `Model changed: ${prev.model} \u2192 ${next.model}`,
      risk: "elevated"
    });
  }
  if (prev.instructionsHash && next.instructionsHash && prev.instructionsHash !== next.instructionsHash) {
    entries.push({
      kind: "mind",
      change: "changed",
      summary: "Instructions (system prompt) changed \u2014 review the file diff",
      risk: "elevated"
    });
  }
  return entries;
}
function diffSnapshots(prev, next, opts = {}) {
  if (!prev) {
    return { isInitial: true, entries: [], hasElevated: false, hasChanges: false };
  }
  const entries = [
    ...diffMind(prev.mind, next.mind),
    ...diffCapabilities(prev.capabilities, next.capabilities),
    ...diffReach(prev.reach, next.reach, opts.rules ?? []),
    ...diffAutonomy(prev.autonomy, next.autonomy),
    ...diffSubagents(prev.subagents, next.subagents),
    ...diffRestrictions(prev.restrictions, next.restrictions)
  ];
  const sev = (e) => e.severity === "high" ? 0 : e.severity === "medium" ? 1 : 2;
  entries.sort((a, b) => {
    if (a.risk !== b.risk) return a.risk === "elevated" ? -1 : 1;
    return sev(a) - sev(b);
  });
  return {
    isInitial: false,
    entries,
    hasElevated: entries.some((e) => e.risk === "elevated"),
    hasChanges: entries.length > 0
  };
}

// ../../src/parser/policy.ts
function parsePolicy(raw) {
  const policy = { rules: [] };
  if (!raw || typeof raw !== "object") return policy;
  const o = raw;
  if (o.failOn === "elevated" || o.failOn === "any" || o.failOn === "never") {
    policy.failOn = o.failOn;
  }
  if (Array.isArray(o.rules)) {
    for (const entry of o.rules) {
      const r = entry;
      const category = typeof r.category === "string" ? r.category : null;
      const severity = r.severity === "high" || r.severity === "medium" ? r.severity : null;
      const patternStr = typeof r.pattern === "string" ? r.pattern : null;
      if (!category || !severity || !patternStr) continue;
      try {
        const flags = typeof r.flags === "string" ? r.flags : "i";
        policy.rules.push({ category, severity, pattern: new RegExp(patternStr, flags) });
      } catch {
      }
    }
  }
  return policy;
}

// ../../src/parser/sourceScan.ts
function stripCodeComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
function hasApprovalGate(src) {
  return /\bapproval\s*:\s*[A-Za-z_$][\w$]*\s*\(/.test(stripCodeComments(src));
}
function consentDrift(toolSources, gated) {
  const drifted = [];
  for (const [tool, src] of Object.entries(toolSources)) {
    if (hasApprovalGate(src) && gated[tool] === void 0) drifted.push(tool);
  }
  return drifted.sort();
}

// ../../src/portrait/signals.ts
function saturate(n, k) {
  return n / (n + k);
}
function hashString2(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function deriveSignals(agent) {
  const subReach = agent.subagents.flatMap((s) => s.reach);
  const subCaps = agent.subagents.flatMap((s) => s.capabilities);
  const allReach = [...agent.reach, ...subReach];
  const writes = allReach.filter(
    (r) => r.access === "write" || r.access === "read-write"
  ).length;
  const reach = saturate(allReach.length + writes, 4);
  const acts = agent.autonomy.filter((a) => a.consent === "acts-on-its-own").length;
  const asks = agent.autonomy.filter((a) => a.consent === "asks-first").length;
  const ownership = acts + asks === 0 ? 0 : acts / (acts + asks + 1);
  const autonomy = Math.max(
    0,
    Math.min(1, ownership * 0.6 + Math.min(acts, 3) / 3 * 0.4)
  );
  const range = saturate(
    agent.capabilities.length + subCaps.length + agent.subagents.length,
    5
  );
  const seed = hashString2(agent.id + "|" + agent.name + "|" + agent.essence);
  return { reach, autonomy, range, seed, motif: agent.motif };
}

// ../../src/portrait/portrait.ts
var MOTIFS = {
  correspondence: { accent: "\u2500", mote: "\xB7" },
  ledger: { accent: "\u2502", mote: "\xB7" },
  hearth: { accent: "\u25E6", mote: "\u02D9" },
  atlas: { accent: "\u2234", mote: "\xB7" },
  form: { accent: "\xB7", mote: "\xB7" }
};
var RAMP = [" ", " ", "\xB7", ":", "\u2592", "\u2592", "\u2593", "\u2593", "\u2588"];
function mulberry32(a) {
  return function() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var W = 46;
var H = 26;
var ASPECT = 2.05;
function renderPortrait(sig) {
  const rnd = mulberry32(sig.seed);
  const m = MOTIFS[sig.motif] ?? MOTIFS.form;
  const half = Math.ceil(W / 2);
  const grain = [];
  for (let y = 0; y < H; y++) {
    grain[y] = [];
    for (let x = 0; x < half; x++) grain[y][x] = rnd();
  }
  const grainAt = (x, y) => grain[y][x < half ? x : W - 1 - x];
  const cx = (W - 1) / 2;
  const headCy = H * 0.36;
  const headRx = W * 0.165;
  const headRy = headRx / ASPECT * 1.15;
  const shCy = H * 0.92;
  const shRx = W * (0.3 + 0.16 * sig.autonomy);
  const shRy = H * 0.42;
  const L = [0, -0.35, 0.94];
  const Ln = Math.hypot(L[0], L[1], L[2]);
  L[0] /= Ln;
  L[1] /= Ln;
  L[2] /= Ln;
  const auraR = 1 + 1.6 * sig.reach;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const nx = (x - cx) / headRx;
      const ny = (y - headCy) / headRy;
      const r2 = nx * nx + ny * ny;
      let ch = " ";
      if (r2 <= 1) {
        const nz = Math.sqrt(1 - r2);
        let lum = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        lum = 0.15 + 0.85 * lum;
        lum *= 0.7 + 0.3 * sig.reach;
        lum += (sig.autonomy - 0.4) * 0.18;
        lum += (grainAt(x, y) - 0.5) * (0.1 + 0.3 * sig.range);
        lum = Math.max(0, Math.min(0.999, lum));
        ch = RAMP[Math.floor(lum * RAMP.length)];
        if (ch !== " " && grainAt(x, y) > 0.93 - 0.15 * sig.range && r2 > 0.15 && r2 < 0.8)
          ch = m.accent;
      } else {
        const sx = (x - cx) / shRx;
        const sy = (y - shCy) / shRy;
        const s2 = sx * sx + sy * sy;
        if (y > headCy + headRy * 0.6 && s2 <= 1) {
          const depth = Math.sqrt(1 - s2);
          let lum = 0.12 + 0.6 * depth * (0.6 + 0.4 * sig.autonomy);
          lum += (grainAt(x, y) - 0.5) * (0.08 + 0.16 * sig.range);
          lum = Math.max(0, Math.min(0.999, lum));
          ch = RAMP[Math.floor(lum * RAMP.length)];
        } else {
          const d = Math.hypot(nx, ny);
          if (d < auraR && grainAt(x, y) > 0.9 + 0.08 * (d - 1)) ch = m.mote;
        }
      }
      row += ch;
    }
    rows.push(row);
  }
  return rows;
}

// ../../src/cli/renderDiff.ts
var STICKY_MARKER = "<!-- aletheia-capability-diff -->";
var GLYPH = {
  added: "\uFF0B",
  removed: "\uFF0D",
  changed: "\uFF5E"
};
function line(e) {
  return `- ${GLYPH[e.change]} ${e.summary}`;
}
function footer(meta) {
  const bits = [
    meta.headSha ? `head \`${meta.headSha}\`` : null,
    meta.manifestSha ? `manifest \`sha256:${meta.manifestSha.slice(0, 12)}\u2026\`` : null,
    `baseline \`${meta.baseline}\``
  ].filter(Boolean);
  return `<sub>${bits.join(" \xB7 ")}</sub>`;
}
function verdict(diff, failOn) {
  if (diff.isInitial) {
    return { failing: failOn !== "never", headline: "First deploy \u2014 review the initial capabilities." };
  }
  if (!diff.hasChanges) {
    return { failing: false, headline: "No capability changes since the baseline." };
  }
  if (diff.hasElevated) {
    const topHigh = diff.entries.find((e) => e.severity === "high");
    return {
      failing: failOn === "elevated" || failOn === "any",
      headline: topHigh ? `Authority expanded \u2014 now reaches ${topHigh.category}. Review required.` : "Authority expanded \u2014 review required."
    };
  }
  return { failing: failOn === "any", headline: "Routine capability changes only." };
}
function portraitBlock(p) {
  return [
    "",
    "<details><summary>Portrait</summary>",
    "",
    "```",
    p.name,
    ...p.rows,
    "```",
    "",
    "</details>"
  ];
}
function warningsBlock(warnings) {
  if (warnings.length === 0) return [];
  return ["#### Integrity warnings", "", ...warnings.map((w) => `- ${w}`), ""];
}
function renderMarkdown(diff, current, meta, portrait, warnings = []) {
  const v = verdict(diff, meta.failOn);
  const out = [STICKY_MARKER, "", "### Aletheia \u2014 authority diff", ""];
  out.push(`**${v.headline}**`, "");
  out.push(...warningsBlock(warnings));
  if (portrait) out.push(...portraitBlock(portrait));
  if (diff.isInitial) {
    out.push("This agent has no prior deployed baseline. It will be able to:", "");
    for (const c of current.capabilities) out.push(`- ${c.label}`);
    if (current.reach.length) {
      out.push("", "And reach:", "");
      for (const r of current.reach) out.push(`- ${r.label}${r.detail ? ` (${r.detail})` : ""}`);
    } else {
      out.push("", "It reaches nothing outside itself.");
    }
    if (current.restrictions?.length) {
      out.push("", "And it cannot:", "");
      for (const r of current.restrictions) out.push(`- ${r.label} (${r.tool} disabled)`);
    }
    out.push("", footer(meta));
    return out.join("\n");
  }
  if (!diff.hasChanges) {
    out.push(footer(meta));
    return out.join("\n");
  }
  const elevated = diff.entries.filter((e) => e.risk === "elevated");
  const routine = diff.entries.filter((e) => e.risk === "routine");
  if (elevated.length) {
    out.push("#### Needs your attention", "");
    for (const e of elevated) out.push(line(e));
    out.push("");
    out.push(
      "After acknowledging with `capability-change-ack`, run `aletheia snapshot` and commit `agent/.aletheia/deployed-capabilities.json` on the same PR.",
      ""
    );
  }
  if (routine.length) {
    out.push("#### Other changes", "");
    for (const e of routine) out.push(line(e));
    out.push("");
  }
  out.push(footer(meta));
  return out.join("\n");
}
function renderJson(diff, current, meta, warnings = []) {
  const v = verdict(diff, meta.failOn);
  return JSON.stringify(
    { failing: v.failing, headline: v.headline, meta, warnings, diff, current },
    null,
    2
  );
}

// ../../src/parser/passport.ts
var REQUIRED = true;
var ADVISORY = false;
function check(id, title, required, ok, passDetail, failDetail) {
  const status = ok ? required ? "pass" : "advisory-pass" : required ? "fail" : "advisory-fail";
  return { id, title, required, status, detail: ok ? passDetail : failDetail };
}
function documentsLifecycle(uxDoc) {
  if (!uxDoc) return false;
  const text = uxDoc.toLowerCase();
  return /\bbefore\b/.test(text) && /\bwhile\b/.test(text) && /\bafter\b/.test(text);
}
function policyIsSensible(policy, present) {
  if (!present) return false;
  return Boolean(policy.failOn) || Array.isArray(policy.rules) && policy.rules.length > 0;
}
function evaluatePassport(input) {
  const facts = input.facts;
  const restrictionCount = facts?.restrictions?.length ?? 0;
  const checks = [
    check(
      "compiles",
      "Compiles; portrait verified from build",
      REQUIRED,
      input.manifestBuilt && facts !== null,
      "eve build succeeded and produced a compiled manifest.",
      "No compiled manifest. Run `eve build` \u2014 until it compiles, the portrait is source-only and cannot be certified."
    ),
    check(
      "consent-mirrors-gates",
      "consent.json mirrors approval gates (no drift)",
      REQUIRED,
      input.consentDrift.length === 0,
      "Every source-declared approval gate is recorded in consent.json.",
      `${input.consentDrift.length} tool(s) declare \`approval:\` in source but are missing from consent.json: ${input.consentDrift.join(", ")}.`
    ),
    check(
      "policy-present",
      "policy.json with failOn + blast-radius rules",
      REQUIRED,
      policyIsSensible(input.policy, input.policyPresent),
      "policy.json sets a failOn threshold and/or blast-radius rules.",
      input.policyPresent ? "policy.json is present but sets neither a failOn threshold nor any blast-radius rules." : "No .aletheia/policy.json found."
    ),
    check(
      "ci-diff-green",
      "aletheia diff green against a committed baseline",
      REQUIRED,
      input.baseline !== null && input.diffPasses,
      "A committed baseline exists and the current build introduces no unacknowledged authority expansion.",
      input.baseline === null ? "No committed baseline (agent/.aletheia/deployed-capabilities.json) to diff against." : "aletheia diff is failing: authority expanded relative to the committed baseline."
    ),
    check(
      "restrictions-visible",
      'Intentional restrictions visible as "cannots"',
      REQUIRED,
      restrictionCount > 0,
      `${restrictionCount} framework tool(s) explicitly disabled and shown as cannots.`,
      "No disabled framework tools. A certified agent states what it deliberately cannot do (e.g. bash, write_file)."
    ),
    check(
      "lifecycle-documented",
      "Before the agent acts / While the agent works / After the agent acts lifecycle documented",
      ADVISORY,
      documentsLifecycle(input.uxDoc),
      "UX.md documents the Agentic UX lifecycle (Before the agent acts / While the agent works / After the agent acts).",
      "UX.md is missing or does not document all three lifecycle stages (before the agent acts / while the agent works / after the agent acts)."
    )
  ];
  const failures = checks.filter((c) => c.required && c.status === "fail").length;
  return {
    name: facts?.name ?? "agent",
    certified: failures === 0,
    checks,
    failures
  };
}

// ../../src/cli/renderPassport.ts
var STATUS_MARK = {
  pass: "PASS",
  fail: "FAIL",
  "advisory-pass": "PASS (advisory)",
  "advisory-fail": "SKIP (advisory)"
};
function bullets(items) {
  return items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none)";
}
function renderPassportJson(result, meta) {
  return `${JSON.stringify(
    {
      schema: "aletheia.passport/v1",
      name: result.name,
      certified: result.certified,
      stamp: result.certified ? "Kit Certified" : "Not certified",
      failures: result.failures,
      generatedAt: meta.generatedAt,
      headSha: meta.headSha,
      manifestSha: meta.manifestSha,
      checks: result.checks.map((c) => ({
        id: c.id,
        title: c.title,
        required: c.required,
        status: c.status,
        detail: c.detail
      }))
    },
    null,
    2
  )}
`;
}
function renderPassportMarkdown(result, facts, meta) {
  const can = facts.capabilities.map(
    (c) => c.consent === "asks-first" ? `${c.label} (**asks first**)` : c.label
  );
  const reach = facts.reach.map((r) => r.label);
  const autonomy = facts.autonomy.map((a) => {
    const line2 = `${a.when}: ${a.does}`;
    return a.consent === "asks-first" ? `${line2} (**asks first**)` : line2;
  });
  const cannots = (facts.restrictions ?? []).map((r) => `${r.label} (\`${r.tool}\` disabled)`);
  const subagents = (facts.subagents ?? []).map((s) => s.name);
  const stampLine = result.certified ? "**Stamp:** Kit Certified \u2014 every required check passed (generated, not hand-authored)" : `**Stamp:** Not certified \u2014 ${result.failures} required check(s) failed (see below)`;
  const checklist = result.checks.map((c) => `| ${STATUS_MARK[c.status]} | ${c.title} | ${c.detail} |`).join("\n");
  const provenance = meta.manifestSha ? `Generated from compiled manifest \`${meta.manifestSha.slice(0, 12)}\`${meta.headSha ? ` at commit \`${meta.headSha}\`` : ""}.` : "Generated from the compiled manifest.";
  return `# Capability passport \u2014 ${result.name}

${stampLine}
Generated by \`aletheia passport\` on ${meta.generatedAt}. Do not edit by hand \u2014 regenerate.

## Kit Certified checklist

| Result | Check | Detail |
| --- | --- | --- |
${checklist}

## What I can do

${bullets(can)}

## What I can touch

${bullets(reach)}

## What I do on my own

${bullets(autonomy)}
${subagents.length ? `
## Subagents

${bullets(subagents)}
` : ""}
## What I cannot / will not do alone

${bullets(cannots)}

## How to verify

\`\`\`bash
eve build
npx @danielalbinsson/aletheia-cli passport --format json
\`\`\`

## Provenance

${provenance} Prefer **verified from build** facts. This is legibility tooling,
not a security audit. See https://agentic-kit.dev/docs/disclaimer
`;
}

// ../../src/cli/renderPortraitCard.ts
function buildPortraitCard(facts, bust, meta) {
  return {
    schema: "aletheia.portrait/v1",
    name: facts.name ?? "agent",
    verified: meta.verified,
    provenance: meta.verified ? "verified from build \u2014 except \u201Casks first\u201D, which is source-declared (eve does not serialize approval)" : "from source \u2014 build to verify",
    generatedAt: meta.generatedAt,
    headSha: meta.headSha,
    manifestSha: meta.manifestSha,
    bust,
    canDo: facts.capabilities.map((c) => ({
      label: c.label,
      asksFirst: c.consent === "asks-first"
    })),
    canTouch: facts.reach.map((r) => r.label),
    doesOnItsOwn: facts.autonomy.map((a) => ({
      when: a.when,
      does: a.does,
      asksFirst: a.consent === "asks-first"
    })),
    cannot: (facts.restrictions ?? []).map((r) => ({ tool: r.tool, label: r.label })),
    subagents: (facts.subagents ?? []).map((s) => s.name)
  };
}
function renderPortraitJson(card) {
  return `${JSON.stringify(card, null, 2)}
`;
}
function bullets2(items) {
  return items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none)";
}
function renderPortraitText(card) {
  const canDo = card.canDo.map((c) => c.asksFirst ? `${c.label} (asks first)` : c.label);
  const alone = card.doesOnItsOwn.map(
    (a) => a.asksFirst ? `${a.when}: ${a.does} (asks first)` : `${a.when}: ${a.does}`
  );
  const cannot = card.cannot.map((r) => `${r.label} (\`${r.tool}\` disabled)`);
  return [
    card.bust.join("\n"),
    "",
    `# ${card.name}`,
    `_${card.provenance}_`,
    "",
    "## What I can do",
    "",
    bullets2(canDo),
    "",
    "## What I can touch",
    "",
    bullets2(card.canTouch),
    "",
    "## What I do on my own",
    "",
    bullets2(alone),
    ...card.subagents.length ? ["", "## Subagents", "", bullets2(card.subagents)] : [],
    "",
    "## What I cannot do",
    "",
    bullets2(cannot),
    ""
  ].join("\n");
}

// ../../src/cli/cliCore.ts
import { execFile } from "node:child_process";
import fs4 from "node:fs/promises";
import path5 from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var SNAPSHOT_REL2 = "agent/.aletheia/deployed-capabilities.json";
var MANIFEST_REL = ".eve/compile/compiled-agent-manifest.json";
var CONSENT_REL = "agent/.aletheia/consent.json";
var TOOLS_REL = "agent/tools";
function parseArgs(argv, cwd = process.cwd()) {
  const o = {
    baseline: `file:${SNAPSHOT_REL2}`,
    format: "markdown",
    failOn: "elevated",
    failOnExplicit: false,
    build: true,
    agentDir: cwd
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--baseline") o.baseline = next();
    else if (a === "--format") o.format = next();
    else if (a === "--fail-on") {
      o.failOn = next();
      o.failOnExplicit = true;
    } else if (a === "--out") o.out = next();
    else if (a === "--no-build") o.build = false;
    else if (a === "--agent-dir") o.agentDir = path5.resolve(cwd, next());
  }
  return o;
}
function driftWarnings(drifted) {
  if (drifted.length === 0) return [];
  return [
    `${drifted.length} tool(s) declare \`approval:\` in source but are missing from \`${CONSENT_REL}\`: ${drifted.map((t) => `\`${t}\``).join(", ")}. This PR check reads the sidecar only \u2014 add them so the gate is recorded.`
  ];
}
function applyConsent(facts, gated) {
  if (Object.keys(gated).length === 0) return facts;
  return {
    ...facts,
    capabilities: facts.capabilities.map((c) => {
      const m = /^tools\/(.+)\.ts$/.exec(c.source);
      const reason = m ? gated[m[1]] : void 0;
      return reason !== void 0 ? { ...c, consent: "asks-first", consentReason: reason } : c;
    })
  };
}
async function gitSnapshotRelPath(agentRoot) {
  const abs = path5.join(agentRoot, SNAPSHOT_REL2);
  const toplevel = await findGitToplevel(agentRoot) ?? await gitRevParseToplevel(agentRoot);
  if (!toplevel) return SNAPSHOT_REL2;
  return path5.relative(toplevel, abs).split(path5.sep).join("/");
}
async function findGitToplevel(start) {
  let dir = path5.resolve(start);
  for (; ; ) {
    try {
      const st = await fs4.stat(path5.join(dir, ".git"));
      if (st.isDirectory() || st.isFile()) return dir;
    } catch {
    }
    const parent = path5.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
async function gitRevParseToplevel(cwd) {
  try {
    const env = { ...process.env };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    delete env.GIT_COMMON_DIR;
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      env
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
async function readJsonSnapshot(file) {
  try {
    const parsed = JSON.parse(await fs4.readFile(file, "utf8"));
    return Array.isArray(parsed.capabilities) ? parsed : null;
  } catch {
    return null;
  }
}
async function resolveBaseline(spec, root) {
  if (spec.startsWith("file:")) {
    return readJsonSnapshot(path5.resolve(root, spec.slice("file:".length)));
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
      const parsed = JSON.parse(stdout);
      return Array.isArray(parsed.capabilities) ? parsed : null;
    } catch {
      return null;
    }
  }
  throw new Error(
    `Unsupported --baseline "${spec}". Use file:<path> or git:<ref> (url:/build: are planned).`
  );
}

// ../../src/cli/aletheia.ts
var execFileAsync2 = promisify2(execFile2);
async function loadToolSources(root) {
  const dir = path6.join(root, TOOLS_REL);
  const sources = {};
  let names;
  try {
    names = await fs5.readdir(dir);
  } catch {
    return sources;
  }
  await Promise.all(
    names.filter((n) => n.endsWith(".ts")).map(async (n) => {
      try {
        sources[n.slice(0, -".ts".length)] = await fs5.readFile(path6.join(dir, n), "utf8");
      } catch {
      }
    })
  );
  return sources;
}
async function loadConsent(root) {
  try {
    const raw = await fs5.readFile(path6.join(root, CONSENT_REL), "utf8");
    const parsed = JSON.parse(raw);
    return parsed.gated && typeof parsed.gated === "object" ? parsed.gated : {};
  } catch {
    return {};
  }
}
async function loadPolicy(root) {
  try {
    const raw = JSON.parse(await fs5.readFile(path6.join(root, ".aletheia/policy.json"), "utf8"));
    return parsePolicy(raw);
  } catch {
    return { rules: [] };
  }
}
async function loadPolicyWithPresence(root) {
  try {
    const raw = JSON.parse(await fs5.readFile(path6.join(root, ".aletheia/policy.json"), "utf8"));
    return { policy: parsePolicy(raw), present: true };
  } catch {
    return { policy: { rules: [] }, present: false };
  }
}
async function loadUxDoc(root) {
  for (const rel of ["UX.md", "agent/UX.md"]) {
    try {
      return await fs5.readFile(path6.join(root, rel), "utf8");
    } catch {
    }
  }
  return null;
}
async function gitShortSha(root) {
  try {
    const { stdout } = await execFileAsync2("git", ["rev-parse", "--short", "HEAD"], {
      cwd: root,
      encoding: "utf8"
    });
    return stdout.trim() || void 0;
  } catch {
    return void 0;
  }
}
async function manifestSha(root) {
  try {
    const buf = await fs5.readFile(path6.join(root, MANIFEST_REL));
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return void 0;
  }
}
function portraitView(facts) {
  const name = facts.name ?? "Agent";
  const model = {
    id: name.toLowerCase(),
    name,
    essence: facts.essence ?? "",
    motif: facts.motif ?? "form",
    intro: "",
    domain: [],
    theme: {},
    runsOn: facts.runsOn,
    capabilities: facts.capabilities,
    reach: facts.reach,
    autonomy: facts.autonomy,
    restrictions: facts.restrictions,
    subagents: facts.subagents
  };
  return { name, rows: renderPortrait(deriveSignals(model)) };
}
async function emit(text, out) {
  if (out) await fs5.writeFile(out, text.endsWith("\n") ? text : `${text}
`, "utf8");
  else process.stdout.write(`${text}
`);
}
async function runDiff(opts) {
  const root = opts.agentDir;
  if (opts.build) {
    const build = await runEveBuild(root);
    if (!build.ok) {
      const msg = build.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.sourcePath ?? "project"}: ${d.message}`).join("; ") || build.stderr || "eve build failed";
      process.stderr.write(`aletheia: build failed \u2014 ${msg}
`);
      return 2;
    }
  }
  const manifest = await runEveManifest(root);
  if (!manifest.built || !manifest.facts) {
    process.stderr.write(
      `aletheia: no compiled manifest. Build the agent first (omit --no-build).
`
    );
    return 2;
  }
  const policy = await loadPolicy(root);
  const failOn = opts.failOnExplicit ? opts.failOn : policy.failOn ?? opts.failOn;
  const gated = await loadConsent(root);
  const facts = applyConsent(manifest.facts, gated);
  const current = snapshotFromFacts(facts);
  const baseline = await resolveBaseline(opts.baseline, root);
  const diff = diffSnapshots(baseline, current, { rules: policy.rules });
  const warnings = [
    ...manifest.warnings ?? [],
    ...driftWarnings(consentDrift(await loadToolSources(root), gated))
  ];
  const meta = {
    headSha: await gitShortSha(root),
    manifestSha: await manifestSha(root),
    baseline: opts.baseline,
    failOn
  };
  const text = opts.format === "json" ? renderJson(diff, current, meta, warnings) : renderMarkdown(diff, current, meta, portraitView(facts), warnings);
  await emit(text, opts.out);
  return verdict(diff, failOn).failing ? 1 : 0;
}
async function runPassport(opts) {
  const root = opts.agentDir;
  if (opts.build) {
    const build = await runEveBuild(root);
    if (!build.ok) {
      const msg = build.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.sourcePath ?? "project"}: ${d.message}`).join("; ") || build.stderr || "eve build failed";
      process.stderr.write(`aletheia: build failed \u2014 ${msg}
`);
      return 2;
    }
  }
  const manifest = await runEveManifest(root);
  if (!manifest.built || !manifest.facts) {
    process.stderr.write(
      `aletheia: no compiled manifest. Build the agent first (omit --no-build).
`
    );
    return 2;
  }
  const gated = await loadConsent(root);
  const toolSources = await loadToolSources(root);
  const { policy, present: policyPresent } = await loadPolicyWithPresence(root);
  const facts = applyConsent(manifest.facts, gated);
  const current = snapshotFromFacts(facts);
  const baseline = await resolveBaseline(opts.baseline, root);
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
    uxDoc: await loadUxDoc(root)
  });
  const meta = {
    headSha: await gitShortSha(root),
    manifestSha: await manifestSha(root),
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const text = opts.format === "json" ? renderPassportJson(result, meta) : renderPassportMarkdown(result, facts, meta);
  await emit(text, opts.out);
  return result.certified ? 0 : 1;
}
async function runPortrait(opts) {
  const root = opts.agentDir;
  if (opts.build) {
    const build = await runEveBuild(root);
    if (!build.ok) {
      const msg = build.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.sourcePath ?? "project"}: ${d.message}`).join("; ") || build.stderr || "eve build failed";
      process.stderr.write(`aletheia: build failed \u2014 ${msg}
`);
      return 2;
    }
  }
  const manifest = await runEveManifest(root);
  if (!manifest.built || !manifest.facts) {
    process.stderr.write(
      `aletheia: no compiled manifest. Build the agent first (omit --no-build).
`
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
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const text = opts.format === "json" ? renderPortraitJson(card) : renderPortraitText(card);
  await emit(text, opts.out);
  return 0;
}
async function runSnapshot(opts) {
  const root = opts.agentDir;
  if (opts.build) {
    const build = await runEveBuild(root);
    if (!build.ok) {
      const msg = build.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.sourcePath ?? "project"}: ${d.message}`).join("; ") || build.stderr || "eve build failed";
      process.stderr.write(`aletheia: build failed \u2014 ${msg}
`);
      return 2;
    }
  }
  const manifest = await runEveManifest(root);
  if (!manifest.built || !manifest.facts) {
    process.stderr.write(
      `aletheia: no compiled manifest. Build the agent first (omit --no-build).
`
    );
    return 2;
  }
  const gated = await loadConsent(root);
  const facts = applyConsent(manifest.facts, gated);
  const current = snapshotFromFacts(facts);
  let dest;
  if (opts.out) {
    dest = path6.resolve(opts.out);
    await fs5.mkdir(path6.dirname(dest), { recursive: true });
    await fs5.writeFile(dest, `${JSON.stringify(current, null, 2)}
`, "utf8");
  } else {
    await writeDeployedSnapshot(path6.join(root, "agent"), current);
    dest = path6.join(root, SNAPSHOT_REL2);
  }
  process.stdout.write(
    `Wrote ${dest}
commit this file so the next \`aletheia diff\` uses it as baseline.
`
  );
  return 0;
}
async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "diff" && command !== "passport" && command !== "portrait" && command !== "snapshot") {
    process.stderr.write(
      "usage:\n  aletheia diff     [--baseline file:<p>|git:<ref>] [--format markdown|json] [--fail-on elevated|any|never] [--out <file>] [--no-build] [--agent-dir <path>]\n  aletheia passport [--format markdown|json] [--out <file>] [--no-build] [--agent-dir <path>]\n  aletheia portrait [--format markdown|json] [--out <file>] [--no-build] [--agent-dir <path>]\n  aletheia snapshot [--out <file>] [--no-build] [--agent-dir <path>]\n"
    );
    process.exit(command ? 2 : 0);
  }
  const opts = parseArgs(rest);
  if (command === "passport") process.exit(await runPassport(opts));
  if (command === "portrait") process.exit(await runPortrait(opts));
  if (command === "snapshot") process.exit(await runSnapshot(opts));
  process.exit(await runDiff(opts));
}
void main();
