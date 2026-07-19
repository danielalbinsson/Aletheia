// manifestAdapter: eve's compiled manifest (.eve/compile/compiled-agent-manifest.json)
// -> the verified trust slice of the AgentModel.
//
// ── WHY THIS, AND NOT `eve info --json` ─────────────────────────────────────
// Verified live against eve 0.15.5 (see docs/specs/capability-manifest.md):
//   • The CLI `eve info --json` returns a SLIM shape (tools/skills as bare name
//     strings, no schemas) — not enough.
//   • The rich `AgentInfoResponse` at GET /eve/v1/info needs a running agent AND
//     still does NOT expose approval or getToken-auth (function-valued fields
//     don't survive serialization), so `requiresApproval`/`hasAuthorization`
//     read false even for gated tools.
//   • The compiled manifest, written by `eve build`, carries the decision-grade
//     facts with no server needed: tool name/description/inputSchema, connection
//     name/description/protocol/url, schedule cron/markdown/hasRun, skills,
//     subagents. It does NOT carry approval or connection read/write — so we do
//     not render those as fact.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AgentModel,
  Capability,
  Reach,
  Autonomy,
  Restriction,
  Subagent,
} from "../model";
import type { SnapshotMind } from "./capabilityDiff";

/** The subset of the compiled manifest this adapter relies on. */
export interface CompiledManifest {
  config?: { name?: string; model?: { id?: string }; description?: string };
  instructions?: { markdown?: string };
  tools?: ManifestTool[];
  skills?: ManifestSkill[];
  connections?: ManifestConnection[];
  channels?: ManifestChannel[];
  schedules?: ManifestSchedule[];
  /**
   * Each subagent entry nests its own full compiled manifest under `agent`
   * (verified live, eve 0.15.5). `name`/`description` may also appear at the
   * top level as a slim summary — we prefer the nested manifest when present so
   * the subagent's own tools/connections/model become legible.
   */
  subagents?: ManifestSubagent[];
  /**
   * Framework tools the agent turned off with `disableTool()`. eve records
   * these by slug in the compiled manifest — a decision-grade "cannot" that
   * needs no running server. Verified against eve 0.15.5 and 0.25.2 (identical
   * shape).
   */
  disabledFrameworkTools?: string[];
}

/**
 * Plain-language phrasing for the built-in eve harness tools, so a disabled
 * tool reads as a human "cannot" rather than a slug. Unknown slugs fall back to
 * a humanized form.
 */
const FRAMEWORK_TOOL_PHRASE: Record<string, string> = {
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
  agent: "spawn subagents",
};

/** Map a disabled framework-tool slug to a verifiable "cannot" fact. */
export function frameworkRestriction(slug: string): Restriction {
  const phrase = FRAMEWORK_TOOL_PHRASE[slug] ?? slug.replace(/[_-]+/g, " ").trim();
  return { tool: slug, label: phrase };
}

function mapRestrictions(m: CompiledManifest): Restriction[] {
  return (m.disabledFrameworkTools ?? []).map(frameworkRestriction);
}

interface ManifestSubagent {
  name?: string;
  description?: string;
  /** The subagent's own compiled manifest (nested by `eve build`). */
  agent?: CompiledManifest;
}

// Narrative (name, essence, motif) is derived from the manifest's own
// instructions text — enough to render the portrait headless. Mirrors the
// source parser's intent without coupling to it.
const MOTIF_RULES: Array<{ motif: string; words: RegExp }> = [
  { motif: "correspondence", words: /\b(inbox|email|mail|message|correspond)/i },
  { motif: "ledger", words: /\b(book|ledger|reconcil|transaction|account|invoice|finance)/i },
  { motif: "hearth", words: /\b(support|customer|ticket|help|reply|conversation)/i },
  { motif: "atlas", words: /\b(research|search|web|gather|brief|read)/i },
];

function deriveMotif(text: string): string {
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

function parseName(md: string): string | undefined {
  return md.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function parseEssence(md: string): string | undefined {
  const body = md.replace(/^#\s+.*$/m, "").trim();
  const firstPara = body.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  return firstPara.split(/(?<=[.!?])\s/)[0] || undefined;
}

/** Small stable non-crypto hash (FNV-1a) — enough to detect prompt changes. */
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

interface ManifestTool {
  name?: string;
  description?: string;
  logicalPath?: string;
  inputSchema?: unknown;
}
interface ManifestSkill {
  name?: string;
  description?: string;
  logicalPath?: string;
}
interface ManifestConnection {
  connectionName?: string;
  description?: string;
  protocol?: string;
  url?: string;
  logicalPath?: string;
}
interface ManifestChannel {
  name?: string;
  logicalPath?: string;
}
interface ManifestSchedule {
  name?: string;
  cron?: string;
  markdown?: string;
  hasRun?: boolean;
}

/** The slice of AgentModel this adapter is authoritative for. */
export type ManifestFacts = Pick<
  AgentModel,
  "capabilities" | "reach" | "autonomy" | "restrictions" | "subagents"
> & {
  runsOn?: string;
  description?: string;
  mind?: SnapshotMind;
  /** Narrative bits for rendering the portrait headless. */
  name?: string;
  essence?: string;
  motif?: string;
};

function humanize(slug: string): string {
  const s = slug.replace(/[_/-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Turn a JSON Schema object into a short plain-language input summary. */
export function summarizeInputs(schema: unknown): string | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  const s = schema as {
    properties?: Record<string, { type?: string }>;
    required?: string[];
  };
  const props = s.properties;
  if (!props || Object.keys(props).length === 0) return undefined;
  const required = new Set(s.required ?? []);
  const parts = Object.entries(props).map(([key, def]) => {
    const type = def?.type ? ` (${def.type})` : "";
    const opt = required.has(key) ? "" : " — optional";
    return `${humanize(key).toLowerCase()}${type}${opt}`;
  });
  return parts.join(", ");
}

function mapCapabilities(m: CompiledManifest): Capability[] {
  const caps: Capability[] = [];
  for (const t of m.tools ?? []) {
    const name = t.name ?? t.logicalPath ?? "tool";
    caps.push({
      label: humanize(name),
      detail: t.description ?? "",
      origin: "tool",
      source: t.logicalPath ?? `tools/${name}.ts`,
      takes: summarizeInputs(t.inputSchema),
    });
  }
  for (const sk of m.skills ?? []) {
    const name = sk.name ?? "skill";
    caps.push({
      label: humanize(name),
      detail: sk.description ?? "",
      origin: "skill",
      source: sk.logicalPath ?? `skills/${name}/SKILL.md`,
    });
  }
  return caps;
}

/**
 * Reach is the real external surface: connections (with protocol + url) and
 * channels. eve does not declare read/write granularity on a connection, so we
 * leave `access` unset rather than inventing one — the protocol/url in `detail`
 * is what's actually known.
 */
function mapReach(m: CompiledManifest): Reach[] {
  const reach: Reach[] = [];
  for (const c of m.connections ?? []) {
    const protocol = c.protocol ? c.protocol.toUpperCase() : "API";
    reach.push({
      label: c.connectionName ?? c.url ?? "connection",
      kind: "api",
      detail: c.url ? `${protocol} · ${c.url}` : protocol,
    });
  }
  // Channels appear once per HTTP route in the manifest, so dedupe by name. The
  // built-in "eve" channel is the agent's own inbound chat endpoint (how you
  // reach it, present on every agent) — not outbound reach, so skip it.
  const seenChannels = new Set<string>();
  for (const ch of m.channels ?? []) {
    const name = ch.name ?? ch.logicalPath ?? "channel";
    if (name === "eve" || seenChannels.has(name)) continue;
    seenChannels.add(name);
    reach.push({ label: name, kind: "channel" });
  }
  return reach;
}

/**
 * Autonomy from schedules. eve schedules fire unattended, so each is
 * acts-on-its-own; human-in-the-loop, when present, lives at the tool level
 * (which eve does not expose) — not on the schedule.
 */
function mapAutonomy(m: CompiledManifest): Autonomy[] {
  return (m.schedules ?? []).map((s) => ({
    when: s.cron ? `On schedule (${s.cron})` : "On a schedule",
    does: s.markdown?.replace(/\s+/g, " ").trim() || "Runs authored code.",
    consent: "acts-on-its-own" as const,
  }));
}

/**
 * Subagents are nested agent packages. eve compiles each one's full manifest
 * under `subagents[].agent`, so we recurse with the same mappers to surface the
 * subagent's own model, tools, and connections — the work an orchestrator-style
 * agent actually does lives here, not on the (often tool-less) root.
 */
function mapSubagents(m: CompiledManifest): Subagent[] {
  const out: Subagent[] = [];
  for (const s of m.subagents ?? []) {
    const sub = s.agent;
    const name = sub?.config?.name ?? s.name;
    if (!name) continue;
    out.push({
      name: humanize(name),
      description: s.description ?? sub?.config?.description,
      runsOn: sub?.config?.model?.id,
      capabilities: sub ? mapCapabilities(sub) : [],
      reach: sub ? mapReach(sub) : [],
    });
  }
  return out;
}

/** Map the compiled manifest into the AgentModel's verified trust facts. */
export function mapManifest(m: CompiledManifest): ManifestFacts {
  const instructions = m.instructions?.markdown ?? "";
  const description = m.config?.description ?? "";
  return {
    runsOn: m.config?.model?.id,
    description: m.config?.description,
    name: instructions ? parseName(instructions) : undefined,
    essence: instructions ? parseEssence(instructions) : undefined,
    motif: deriveMotif(`${instructions}\n${description}`),
    mind: {
      model: m.config?.model?.id,
      instructionsHash: instructions ? hashString(instructions) : undefined,
    },
    capabilities: mapCapabilities(m),
    reach: mapReach(m),
    autonomy: mapAutonomy(m),
    restrictions: mapRestrictions(m),
    subagents: mapSubagents(m),
  };
}

/**
 * Overlay verified manifest facts onto the source-parsed base model. Trust
 * facts come from the manifest; narrative identity (intro, essence, motif,
 * theme, name) stays from the base, which reads instructions.md. Empty arrays
 * still overwrite — "verifiably zero connections" is a real fact.
 */
export function applyManifest<T extends AgentModel>(base: T, facts: ManifestFacts): T {
  // The seam: capability existence, labels, and schemas are manifest-verified,
  // but eve doesn't serialize approval — so consent (asks-first + why) is carried
  // over from the source-parsed base, matched by the tool's logical path. The
  // portrait shows verified capabilities with a source-declared consent badge.
  const consentBySource = new Map(
    base.capabilities
      .filter((c) => c.consent)
      .map((c) => [c.source, c] as const),
  );
  const capabilities = facts.capabilities.map((c) => {
    const declared = consentBySource.get(c.source);
    return declared
      ? { ...c, consent: declared.consent, consentReason: declared.consentReason }
      : c;
  });

  return {
    ...base,
    runsOn: facts.runsOn ?? base.runsOn,
    capabilities,
    reach: facts.reach,
    autonomy: facts.autonomy,
    restrictions: facts.restrictions,
    subagents: facts.subagents,
  };
}
