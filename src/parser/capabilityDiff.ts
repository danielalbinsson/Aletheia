// capabilityDiff: snapshot an agent's trust facts and diff two snapshots.
//
// This turns the portrait into a control. Before a deploy we compare the
// agent's current capability/reach/autonomy against the last *deployed*
// snapshot and surface, in plain language, what is changing about what the
// agent can do, touch, and decide. Changes that raise risk — new autonomy,
// new or widened reach — are escalated so they can't ship unseen.
//
// Pure module: no fs, no eve. The server persists snapshots; this just maps
// and compares them. See docs/specs/diff-on-deploy.md.

import { z } from "zod";
import type { AgentModel, Autonomy, Reach, Restriction, Subagent } from "../model";
import { classifyReach, type ConsequenceRule } from "./consequence";

/** Options for diffSnapshots — e.g. team-defined consequence rules from policy. */
export interface DiffOptions {
  rules?: ConsequenceRule[];
}

export interface SnapshotCapability {
  source: string;
  label: string;
  /** "asks-first" when approval-gated. Dropping it later is authority expansion. */
  consent?: "asks-first";
}
export interface SnapshotReach {
  label: string;
  kind: Reach["kind"];
  access?: Reach["access"];
  detail?: string;
  /** Stable identity (logical path). Optional on legacy snapshots. */
  id?: string;
}
export interface SnapshotAutonomy {
  does: string;
  when: string;
  /** Omitted when source-only schedules have not been verified. */
  consent?: Autonomy["consent"];
}
export interface SnapshotRestriction {
  tool: string;
  label: string;
}

export interface SnapshotSubagentSlice {
  name: string;
  id?: string;
  runsOn?: string;
  capabilities: SnapshotCapability[];
  reach: SnapshotReach[];
}

export interface SnapshotDelegation {
  parent: string;
  child: string;
  parentId?: string;
  childId?: string;
}

export interface SnapshotSandbox {
  present?: boolean;
  workspaceCount?: number;
}

/**
 * "How it thinks" — the behavior levers. A swapped model or a rewritten
 * system prompt changes behavior more than any single tool, so they're tracked
 * and escalated. Instructions are stored as a hash (change detection); the PR
 * itself shows the prose diff.
 */
export interface SnapshotMind {
  model?: string;
  instructionsHash?: string;
}

/** The persisted trust facts at the moment of a deploy. */
export interface CapabilitySnapshot {
  /** ISO timestamp the snapshot was captured. */
  capturedAt: string;
  name: string;
  mind?: SnapshotMind;
  capabilities: SnapshotCapability[];
  reach: SnapshotReach[];
  autonomy: SnapshotAutonomy[];
  /**
   * Legacy snapshots store names only (`string[]`). New snapshots store a
   * capability/reach slice per subagent. Diffing nested authority is skipped
   * until the baseline has slices.
   */
  subagents: Array<string | SnapshotSubagentSlice>;
  /**
   * Framework tools the agent disabled. Optional: baselines captured before
   * restrictions were tracked omit it, and we skip the diff rather than
   * false-flag a "restriction lifted" on every old snapshot.
   */
  restrictions?: SnapshotRestriction[];
  /** Optional: omitted on baselines captured before sandbox tracking. */
  sandbox?: SnapshotSandbox;
  /** Optional: omitted on baselines captured before delegation tracking. */
  delegation?: SnapshotDelegation[];
}

export type DiffRisk = "elevated" | "routine";
export type DiffChange = "added" | "removed" | "changed";
export type DiffKind =
  | "capability"
  | "reach"
  | "autonomy"
  | "subagent"
  | "restriction"
  | "mind"
  | "sandbox"
  | "delegation";

export interface DiffEntry {
  kind: DiffKind;
  change: DiffChange;
  /** Plain-language one-liner, e.g. "Can now write to Slack (was read-only)". */
  summary: string;
  risk: DiffRisk;
  /** Blast-radius category for reach changes, e.g. "payments". */
  category?: string;
  /** Blast-radius severity, when classified. */
  severity?: "high" | "medium";
}

export interface CapabilityDiff {
  /** True when there is no prior snapshot — show "initial capabilities". */
  isInitial: boolean;
  entries: DiffEntry[];
  hasElevated: boolean;
  hasChanges: boolean;
}

const SnapshotCapabilitySchema = z.object({
  source: z.string(),
  label: z.string(),
  consent: z.literal("asks-first").optional(),
});

const SnapshotReachSchema = z.object({
  label: z.string(),
  kind: z.enum(["data", "api", "channel"]),
  access: z.enum(["read", "write", "read-write"]).optional(),
  detail: z.string().optional(),
  id: z.string().optional(),
});

const SnapshotAutonomySchema = z.object({
  does: z.string(),
  when: z.string(),
  consent: z.enum(["acts-on-its-own", "asks-first"]).optional(),
});

const SnapshotRestrictionSchema = z.object({
  tool: z.string(),
  label: z.string(),
});

const SnapshotSubagentSliceSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  runsOn: z.string().optional(),
  capabilities: z.array(SnapshotCapabilitySchema),
  reach: z.array(SnapshotReachSchema),
});

const SnapshotDelegationSchema = z.object({
  parent: z.string(),
  child: z.string(),
  parentId: z.string().optional(),
  childId: z.string().optional(),
});

const SnapshotSandboxSchema = z.object({
  present: z.boolean().optional(),
  workspaceCount: z.number().optional(),
});

const CapabilitySnapshotSchema = z.object({
  capturedAt: z.string(),
  name: z.string(),
  mind: z
    .object({
      model: z.string().optional(),
      instructionsHash: z.string().optional(),
    })
    .optional(),
  capabilities: z.array(SnapshotCapabilitySchema),
  reach: z.array(SnapshotReachSchema),
  autonomy: z.array(SnapshotAutonomySchema),
  subagents: z.array(z.union([z.string(), SnapshotSubagentSliceSchema])),
  restrictions: z.array(SnapshotRestrictionSchema).optional(),
  sandbox: SnapshotSandboxSchema.optional(),
  delegation: z.array(SnapshotDelegationSchema).optional(),
});

/** Parse a persisted snapshot. Throws if the payload is not a valid snapshot. */
export function parseCapabilitySnapshot(raw: unknown, source = "snapshot"): CapabilitySnapshot {
  const parsed = CapabilitySnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "root";
    throw new Error(`${source} is not a valid capability snapshot (${path}: ${issue?.message ?? "invalid"})`);
  }
  return parsed.data;
}

/** Capture the trust slice of a model as a deploy snapshot. */
export function snapshotFromModel(
  model: AgentModel,
  capturedAt = new Date().toISOString()
): CapabilitySnapshot {
  return snapshotFromFacts(model, capturedAt);
}

/** The trust slice a snapshot needs — what the eve manifest provides. */
export type SnapshotInput = Pick<
  AgentModel,
  "capabilities" | "reach" | "autonomy" | "subagents"
> & {
  name?: string;
  mind?: SnapshotMind;
  restrictions?: Restriction[];
  sandbox?: AgentModel["sandbox"];
  delegation?: AgentModel["delegation"];
};

function snapCap(c: { source: string; label: string; consent?: "asks-first" }): SnapshotCapability {
  return {
    source: c.source,
    label: c.label,
    ...(c.consent ? { consent: c.consent } : {}),
  };
}

function snapReach(r: Reach): SnapshotReach {
  return {
    label: r.label,
    kind: r.kind,
    ...(r.access ? { access: r.access } : {}),
    ...(r.detail ? { detail: r.detail } : {}),
    ...(r.id ? { id: r.id } : {}),
  };
}

function snapSubagent(s: Subagent): SnapshotSubagentSlice {
  return {
    name: s.name,
    ...(s.id ? { id: s.id } : {}),
    ...(s.runsOn ? { runsOn: s.runsOn } : {}),
    capabilities: s.capabilities.map(snapCap),
    reach: s.reach.map(snapReach),
  };
}

/** Capture a snapshot from manifest facts (or any model-shaped trust slice). */
export function snapshotFromFacts(
  facts: SnapshotInput,
  capturedAt = new Date().toISOString()
): CapabilitySnapshot {
  const snap: CapabilitySnapshot = {
    capturedAt,
    name: facts.name ?? "agent",
    mind: facts.mind,
    capabilities: facts.capabilities.map(snapCap),
    reach: facts.reach.map(snapReach),
    autonomy: facts.autonomy.map((a) => ({
      does: a.does,
      when: a.when,
      ...(a.consent ? { consent: a.consent } : {}),
    })),
    subagents: facts.subagents.map(snapSubagent),
    restrictions: (facts.restrictions ?? []).map((r) => ({
      tool: r.tool,
      label: r.label,
    })),
  };
  if (facts.sandbox) snap.sandbox = { ...facts.sandbox };
  if (facts.delegation) {
    snap.delegation = facts.delegation.map((e) => ({
      parent: e.parent,
      child: e.child,
      ...(e.parentId ? { parentId: e.parentId } : {}),
      ...(e.childId ? { childId: e.childId } : {}),
    }));
  }
  return snap;
}

const ACCESS_RANK: Record<NonNullable<Reach["access"]>, number> = {
  read: 0,
  write: 1,
  "read-write": 2,
};

/** Access rank, or -1 when access is unknown (manifest reach declares none). */
function rank(access: Reach["access"]): number {
  return access ? ACCESS_RANK[access] : -1;
}

/** Reach that touches an external system (vs internal data). */
function isExternal(r: SnapshotReach): boolean {
  return r.kind === "api" || r.kind === "channel";
}

function indexBy<T>(items: T[], key: (t: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const it of items) m.set(key(it), it);
  return m;
}

function reachKey(r: SnapshotReach): string {
  return (r.id || r.label).toLowerCase();
}

function indexReach(items: SnapshotReach[]): Map<string, SnapshotReach> {
  const byId = new Map<string, SnapshotReach>();
  const byLabel = new Map<string, SnapshotReach>();
  for (const r of items) {
    if (r.id) byId.set(r.id.toLowerCase(), r);
    byLabel.set(r.label.toLowerCase(), r);
  }
  const merged = new Map<string, SnapshotReach>();
  for (const r of items) merged.set(reachKey(r), r);
  // Preserve both indexes for lookup in diffReach.
  for (const [k, v] of byId) merged.set(`id:${k}`, v);
  for (const [k, v] of byLabel) merged.set(`label:${k}`, v);
  return merged;
}

function lookupReach(index: Map<string, SnapshotReach>, r: SnapshotReach): SnapshotReach | undefined {
  if (r.id) {
    const byId = index.get(`id:${r.id.toLowerCase()}`);
    if (byId) return byId;
  }
  return index.get(`label:${r.label.toLowerCase()}`);
}

function diffReach(
  prev: SnapshotReach[],
  next: SnapshotReach[],
  rules: ConsequenceRule[]
): DiffEntry[] {
  const prevIndex = indexReach(prev);
  const nextIndex = indexReach(next);
  const seenPrev = new Set<SnapshotReach>();
  const entries: DiffEntry[] = [];

  for (const r of next) {
    const before = lookupReach(prevIndex, r);
    if (!before) {
      const c = isExternal(r) ? classifyReach(r.label, r.detail, rules) : null;
      entries.push({
        kind: "reach",
        change: "added",
        summary: `Can now reach ${r.label}${c ? ` — ${c.category}` : ""}${r.access ? ` (${r.access})` : ""}`,
        risk: isExternal(r) ? "elevated" : "routine",
        category: c?.category,
        severity: c?.severity,
      });
      continue;
    }
    seenPrev.add(before);
    if (rank(r.access) > rank(before.access)) {
      entries.push({
        kind: "reach",
        change: "changed",
        summary: `${r.label}: access widened from ${before.access} to ${r.access}`,
        risk: "elevated",
      });
    } else if (rank(r.access) < rank(before.access)) {
      entries.push({
        kind: "reach",
        change: "changed",
        summary: `${r.label}: access narrowed from ${before.access} to ${r.access}`,
        risk: "routine",
      });
    }
    if (before.kind !== r.kind) {
      entries.push({
        kind: "reach",
        change: "changed",
        summary: `${r.label}: kind changed from ${before.kind} to ${r.kind}`,
        risk: isExternal(r) ? "elevated" : "routine",
      });
    }
    const beforeDetail = before.detail ?? "";
    const nextDetail = r.detail ?? "";
    if (beforeDetail !== nextDetail) {
      entries.push({
        kind: "reach",
        change: "changed",
        summary: `${r.label}: endpoint or connector changed`,
        risk: isExternal(r) || isExternal(before) ? "elevated" : "routine",
      });
    }
  }
  for (const r of prev) {
    if (seenPrev.has(r)) continue;
    if (lookupReach(nextIndex, r)) continue;
    entries.push({
      kind: "reach",
      change: "removed",
      summary: `No longer reaches ${r.label}`,
      risk: "routine",
    });
  }
  return entries;
}

function diffCapabilities(
  prev: SnapshotCapability[],
  next: SnapshotCapability[]
): DiffEntry[] {
  const prevBy = indexBy(prev, (c) => c.source);
  const nextBy = indexBy(next, (c) => c.source);
  const entries: DiffEntry[] = [];

  for (const [key, c] of nextBy) {
    const before = prevBy.get(key);
    if (!before) {
      entries.push({
        kind: "capability",
        change: "added",
        summary: `New capability: ${c.label}${c.consent ? " (asks first)" : ""}`,
        risk: "routine",
      });
    } else if (before.consent === "asks-first" && c.consent !== "asks-first") {
      entries.push({
        kind: "capability",
        change: "changed",
        summary: `${c.label}: no longer asks first — approval gate removed`,
        risk: "elevated",
      });
    } else if (before.consent !== "asks-first" && c.consent === "asks-first") {
      entries.push({
        kind: "capability",
        change: "changed",
        summary: `${c.label}: now asks first before running`,
        risk: "routine",
      });
    }
  }
  for (const [key, c] of prevBy) {
    if (!nextBy.has(key)) {
      entries.push({
        kind: "capability",
        change: "removed",
        summary: `Removed capability: ${c.label}`,
        risk: "routine",
      });
    }
  }
  return entries;
}

function diffAutonomy(
  prev: SnapshotAutonomy[],
  next: SnapshotAutonomy[]
): DiffEntry[] {
  const key = (a: SnapshotAutonomy) => `${a.when}::${a.does}`.toLowerCase();
  const prevBy = indexBy(prev, key);
  const nextBy = indexBy(next, key);
  const entries: DiffEntry[] = [];

  for (const [k, a] of nextBy) {
    if (!prevBy.has(k)) {
      const onOwn = a.consent === "acts-on-its-own";
      const unknown = a.consent !== "acts-on-its-own" && a.consent !== "asks-first";
      const how = unknown
        ? "consent unknown"
        : onOwn
          ? "acts on its own"
          : "asks first";
      entries.push({
        kind: "autonomy",
        change: "added",
        summary: `New autonomous action: ${a.does} — ${how} (${a.when})`,
        risk: onOwn || unknown ? "elevated" : "routine",
      });
    }
  }
  for (const [k, a] of prevBy) {
    if (!nextBy.has(k)) {
      entries.push({
        kind: "autonomy",
        change: "removed",
        summary: `No longer does: ${a.does}`,
        risk: "routine",
      });
    }
  }
  return entries;
}

function subagentName(s: string | SnapshotSubagentSlice): string {
  return typeof s === "string" ? s : s.name;
}

function isSlice(s: string | SnapshotSubagentSlice): s is SnapshotSubagentSlice {
  return typeof s !== "string";
}

function diffSubagents(
  prev: Array<string | SnapshotSubagentSlice>,
  next: Array<string | SnapshotSubagentSlice>
): DiffEntry[] {
  const prevSet = new Set(prev.map((s) => subagentName(s).toLowerCase()));
  const nextSet = new Set(next.map((s) => subagentName(s).toLowerCase()));
  const entries: DiffEntry[] = [];
  for (const s of next) {
    const name = subagentName(s);
    if (!prevSet.has(name.toLowerCase())) {
      entries.push({
        kind: "subagent",
        change: "added",
        summary: `Now delegates to ${name}`,
        risk: "elevated",
      });
    }
  }
  for (const s of prev) {
    const name = subagentName(s);
    if (!nextSet.has(name.toLowerCase())) {
      entries.push({
        kind: "subagent",
        change: "removed",
        summary: `No longer delegates to ${name}`,
        risk: "routine",
      });
    }
  }

  const prevSlices = prev.filter(isSlice);
  const nextSlices = next.filter(isSlice);
  if (prevSlices.length === 0 || nextSlices.length === 0) return entries;

  const prevBy = indexBy(prevSlices, (s) => (s.id || s.name).toLowerCase());
  for (const n of nextSlices) {
    const before = prevBy.get((n.id || n.name).toLowerCase()) ?? prevBy.get(n.name.toLowerCase());
    if (!before) continue;
    const nested = [
      ...diffCapabilities(before.capabilities, n.capabilities).map((e) => ({
        ...e,
        summary: `${n.name}: ${e.summary.charAt(0).toLowerCase()}${e.summary.slice(1)}`,
        risk: e.change === "added" || (e.change === "changed" && e.risk === "elevated") ? "elevated" as const : e.risk,
      })),
      ...diffReach(before.reach, n.reach, []).map((e) => ({
        ...e,
        summary: `${n.name}: ${e.summary.charAt(0).toLowerCase()}${e.summary.slice(1)}`,
      })),
    ];
    if (before.runsOn && n.runsOn && before.runsOn !== n.runsOn) {
      nested.push({
        kind: "subagent",
        change: "changed",
        summary: `${n.name}: model changed: ${before.runsOn} → ${n.runsOn}`,
        risk: "elevated",
      });
    }
    entries.push(...nested);
  }
  return entries;
}

/**
 * Restrictions are inverted authority: lifting one (a tool that was disabled is
 * enabled again) *expands* what the agent can do, so it's elevated — the same
 * gate logic as new reach. Adding one narrows authority and is routine.
 * Skipped entirely when the baseline predates restriction tracking (undefined),
 * to avoid false "restriction lifted" on every legacy snapshot.
 */
function diffRestrictions(
  prev: SnapshotRestriction[] | undefined,
  next: SnapshotRestriction[] | undefined
): DiffEntry[] {
  if (!prev) return [];
  const prevSet = indexBy(prev, (r) => r.tool);
  const nextSet = indexBy(next ?? [], (r) => r.tool);
  const entries: DiffEntry[] = [];
  for (const [tool, r] of prevSet) {
    if (!nextSet.has(tool)) {
      entries.push({
        kind: "restriction",
        change: "removed",
        summary: `Restriction lifted: can now ${r.label} (${tool} re-enabled)`,
        risk: "elevated",
      });
    }
  }
  for (const [tool, r] of nextSet) {
    if (!prevSet.has(tool)) {
      entries.push({
        kind: "restriction",
        change: "added",
        summary: `Now restricted: cannot ${r.label} (${tool} disabled)`,
        risk: "routine",
      });
    }
  }
  return entries;
}

function diffSandbox(
  prev: SnapshotSandbox | undefined,
  next: SnapshotSandbox | undefined
): DiffEntry[] {
  if (!prev) return [];
  const after = next ?? {};
  const entries: DiffEntry[] = [];
  if (prev.present === true && after.present === false) {
    entries.push({
      kind: "sandbox",
      change: "removed",
      summary: "Authored sandbox removed",
      risk: "elevated",
    });
  } else if (prev.present === false && after.present === true) {
    entries.push({
      kind: "sandbox",
      change: "added",
      summary: "Authored sandbox configured",
      risk: "routine",
    });
  }
  if (
    prev.workspaceCount !== undefined &&
    after.workspaceCount !== undefined &&
    after.workspaceCount < prev.workspaceCount
  ) {
    entries.push({
      kind: "sandbox",
      change: "changed",
      summary: `Sandbox workspace folders reduced (${prev.workspaceCount} → ${after.workspaceCount})`,
      risk: "elevated",
    });
  }
  return entries;
}

function delegationKey(e: SnapshotDelegation): string {
  return `${(e.parentId || e.parent).toLowerCase()}->${(e.childId || e.child).toLowerCase()}`;
}

function diffDelegation(
  prev: SnapshotDelegation[] | undefined,
  next: SnapshotDelegation[] | undefined
): DiffEntry[] {
  if (!prev) return [];
  const prevBy = indexBy(prev, delegationKey);
  const nextBy = indexBy(next ?? [], delegationKey);
  const entries: DiffEntry[] = [];
  for (const [key, e] of nextBy) {
    if (!prevBy.has(key)) {
      entries.push({
        kind: "delegation",
        change: "added",
        summary: `New delegation: ${e.parent} → ${e.child}`,
        risk: "elevated",
      });
    }
  }
  for (const [key, e] of prevBy) {
    if (!nextBy.has(key)) {
      entries.push({
        kind: "delegation",
        change: "removed",
        summary: `Delegation removed: ${e.parent} → ${e.child}`,
        risk: "routine",
      });
    }
  }
  return entries;
}

/**
 * "How it thinks" — model + system prompt. Both are elevated: they change
 * behavior more than any single tool. Only compared when the baseline recorded
 * a `mind` (older snapshots predate it), so we never false-flag on first run.
 */
function diffMind(prev?: SnapshotMind, next?: SnapshotMind): DiffEntry[] {
  if (!prev || !next) return [];
  const entries: DiffEntry[] = [];
  if (prev.model && next.model && prev.model !== next.model) {
    entries.push({
      kind: "mind",
      change: "changed",
      summary: `Model changed: ${prev.model} → ${next.model}`,
      risk: "elevated",
    });
  }
  if (
    prev.instructionsHash &&
    next.instructionsHash &&
    prev.instructionsHash !== next.instructionsHash
  ) {
    entries.push({
      kind: "mind",
      change: "changed",
      summary: "Instructions (system prompt) changed — review the file diff",
      risk: "elevated",
    });
  }
  return entries;
}

/**
 * Diff the current snapshot against the last deployed one. A null `prev` means
 * this is the first deploy — `isInitial` is set and there are no entries (the
 * UI shows the full current capability set instead).
 */
export function diffSnapshots(
  prev: CapabilitySnapshot | null,
  next: CapabilitySnapshot,
  opts: DiffOptions = {}
): CapabilityDiff {
  if (!prev) {
    return { isInitial: true, entries: [], hasElevated: false, hasChanges: false };
  }
  const entries = [
    ...diffMind(prev.mind, next.mind),
    ...diffCapabilities(prev.capabilities, next.capabilities),
    ...diffReach(prev.reach, next.reach, opts.rules ?? []),
    ...diffAutonomy(prev.autonomy, next.autonomy),
    ...diffSubagents(prev.subagents, next.subagents),
    ...diffRestrictions(prev.restrictions, next.restrictions),
    ...diffSandbox(prev.sandbox, next.sandbox),
    ...diffDelegation(prev.delegation, next.delegation),
  ];
  const sev = (e: DiffEntry) => (e.severity === "high" ? 0 : e.severity === "medium" ? 1 : 2);
  entries.sort((a, b) => {
    if (a.risk !== b.risk) return a.risk === "elevated" ? -1 : 1;
    return sev(a) - sev(b);
  });
  return {
    isInitial: false,
    entries,
    hasElevated: entries.some((e) => e.risk === "elevated"),
    hasChanges: entries.length > 0,
  };
}
