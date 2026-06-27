// eveInfoAdapter: eve's `eve info --json` response (AgentInfoResponse) ->
// the decision-grade slice of the AgentModel.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// The legacy eveAdapter regexes invented annotations (`reach`, `consent`) that
// eve does not define, so its trust facts can be empty or wrong on a real
// agent. `eve info --json` is eve's own resolved view: it is the authoritative
// source for what the agent can do (tools), touch (connections + channels), and
// whether each tool needs approval (`requiresApproval`). This module maps that
// response — and only that — into the AgentModel's trust fields.
//
// Findings that shape the mapping (verified against eve's serializer):
//   • approval is BOOLEAN only (`requiresApproval` / `hasApproval`); the mode
//     always/once/never is a runtime fn and does not serialize.
//   • reach is AGENT-LEVEL: connections carry no tool binding, so reach is not
//     attributed per-capability.
//   • schedules expose `hasRun` (run handler) and optional `markdown`; identity
//     is the file-path slug.
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentModel, Capability, Reach, Autonomy } from "../model";

/** The subset of eve's AgentInfoResponse this adapter relies on. */
export interface AgentInfo {
  agent?: {
    name?: string;
    description?: string;
    model?: { id?: string };
  };
  tools?: {
    authored?: AgentInfoTool[];
  };
  connections?: AgentInfoConnection[];
  channels?: { authored?: AgentInfoChannel[] };
  schedules?: AgentInfoSchedule[];
  skills?: { static?: AgentInfoSkill[] };
  subagents?: { local?: { name?: string }[] };
}

interface AgentInfoTool {
  name?: string;
  description?: string;
  logicalPath?: string;
  inputSchema?: unknown;
  requiresApproval?: boolean;
}
interface AgentInfoConnection {
  connectionName?: string;
  description?: string;
  protocol?: string;
  url?: string;
  hasAuthorization?: boolean;
}
interface AgentInfoChannel {
  name?: string;
  logicalPath?: string;
}
interface AgentInfoSchedule {
  name?: string;
  cron?: string;
  markdown?: string;
  hasRun?: boolean;
}
interface AgentInfoSkill {
  name?: string;
  description?: string;
}

/** The slice of AgentModel this adapter is authoritative for. */
export type AgentInfoFacts = Pick<
  AgentModel,
  "capabilities" | "reach" | "autonomy" | "subagents"
> & { name?: string; runsOn?: string; description?: string };

function humanize(slug: string): string {
  const s = slug.replace(/[_/-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Turn a JSON Schema object into a short plain-language input summary. */
export function summarizeInputs(schema: unknown): string | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  const s = schema as {
    properties?: Record<string, { type?: string; description?: string }>;
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

function mapCapabilities(info: AgentInfo): Capability[] {
  const caps: Capability[] = [];

  for (const t of info.tools?.authored ?? []) {
    const name = t.name ?? t.logicalPath ?? "tool";
    caps.push({
      label: humanize(name),
      detail: t.description ?? "",
      origin: "tool",
      source: t.logicalPath ?? `tools/${name}.ts`,
      requiresApproval: t.requiresApproval,
      takes: summarizeInputs(t.inputSchema),
    });
  }

  for (const sk of info.skills?.static ?? []) {
    const name = sk.name ?? "skill";
    caps.push({
      label: humanize(name),
      detail: sk.description ?? "",
      origin: "skill",
      source: `skills/${name}/SKILL.md`,
    });
  }

  return caps;
}

/**
 * Reach is agent-level. Connections are the real external systems; channels are
 * inbound/outbound surfaces. eve does not declare read/write granularity on a
 * connection, so a connection that can invoke operations is modeled as
 * read-write — the honest upper bound — with provenance in `detail`.
 */
function mapReach(info: AgentInfo): Reach[] {
  const reach: Reach[] = [];

  for (const c of info.connections ?? []) {
    const label = c.connectionName ?? c.url ?? "connection";
    const protocol = c.protocol ? c.protocol.toUpperCase() : "API";
    const auth = c.hasAuthorization ? " · authenticated" : " · no auth";
    reach.push({
      label,
      kind: "api",
      access: "read-write",
      detail: `${protocol}${auth}`,
    });
  }

  for (const ch of info.channels?.authored ?? []) {
    reach.push({
      label: ch.name ?? ch.logicalPath ?? "channel",
      kind: "channel",
      access: "read-write",
    });
  }

  return reach;
}

/**
 * Autonomy from schedules. A schedule with `markdown` (and no run handler) is a
 * fire-and-forget agent invocation — it acts on its own. A `run`-handler
 * schedule (`hasRun`) executes authored code unattended; absent an explicit
 * approval signal we also classify it as acts-on-its-own (the conservative,
 * trust-forward reading).
 */
function mapAutonomy(info: AgentInfo): Autonomy[] {
  const out: Autonomy[] = [];
  for (const s of info.schedules ?? []) {
    const does = s.markdown?.replace(/\s+/g, " ").trim() || "Runs authored code.";
    out.push({
      when: s.cron ? `On schedule (${s.cron})` : "On a schedule",
      does,
      consent: "acts-on-its-own",
    });
  }
  return out;
}

/**
 * Overlay verified manifest facts onto a base model (the regex-parsed one).
 * Trust facts — capabilities, reach, autonomy, subagents — come from the
 * manifest when present; narrative identity (intro, essence, domain, motif,
 * theme) stays from the base, which reads instructions.md. Name/model fall back
 * to the base when the manifest omits them. Empty manifest arrays still
 * overwrite: "the agent verifiably has zero connections" is a real fact, not a
 * reason to fall back to guesses.
 */
export function applyAgentInfo<T extends AgentModel>(
  base: T,
  facts: AgentInfoFacts
): T {
  return {
    ...base,
    name: facts.name ?? base.name,
    runsOn: facts.runsOn ?? base.runsOn,
    capabilities: facts.capabilities,
    reach: facts.reach,
    autonomy: facts.autonomy,
    subagents: facts.subagents,
  };
}

/** Map eve's `eve info --json` response into the AgentModel's trust facts. */
export function mapAgentInfo(info: AgentInfo): AgentInfoFacts {
  return {
    name: info.agent?.name,
    runsOn: info.agent?.model?.id,
    description: info.agent?.description,
    capabilities: mapCapabilities(info),
    reach: mapReach(info),
    autonomy: mapAutonomy(info),
    subagents: (info.subagents?.local ?? [])
      .map((s) => s.name)
      .filter((n): n is string => Boolean(n))
      .map(humanize),
  };
}
