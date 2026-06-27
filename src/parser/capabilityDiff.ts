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

import type { AgentModel, Autonomy, Reach } from "../model";

export interface SnapshotCapability {
  source: string;
  label: string;
  requiresApproval?: boolean;
}
export interface SnapshotReach {
  label: string;
  kind: Reach["kind"];
  access: Reach["access"];
  detail?: string;
}
export interface SnapshotAutonomy {
  does: string;
  when: string;
  consent: Autonomy["consent"];
}

/** The persisted trust facts at the moment of a deploy. */
export interface CapabilitySnapshot {
  /** ISO timestamp the snapshot was captured. */
  capturedAt: string;
  name: string;
  capabilities: SnapshotCapability[];
  reach: SnapshotReach[];
  autonomy: SnapshotAutonomy[];
  subagents: string[];
}

export type DiffRisk = "elevated" | "routine";
export type DiffChange = "added" | "removed" | "changed";
export type DiffKind = "capability" | "reach" | "autonomy" | "subagent";

export interface DiffEntry {
  kind: DiffKind;
  change: DiffChange;
  /** Plain-language one-liner, e.g. "Can now write to Slack (was read-only)". */
  summary: string;
  risk: DiffRisk;
}

export interface CapabilityDiff {
  /** True when there is no prior snapshot — show "initial capabilities". */
  isInitial: boolean;
  entries: DiffEntry[];
  hasElevated: boolean;
  hasChanges: boolean;
}

/** Capture the trust slice of a model as a deploy snapshot. */
export function snapshotFromModel(
  model: AgentModel,
  capturedAt = new Date().toISOString()
): CapabilitySnapshot {
  return snapshotFromFacts(model, capturedAt);
}

/** The trust slice a snapshot needs — what the eve manifest (AgentInfoFacts) provides. */
export type SnapshotInput = Pick<
  AgentModel,
  "capabilities" | "reach" | "autonomy" | "subagents"
> & { name?: string };

/** Capture a snapshot from manifest facts (or any model-shaped trust slice). */
export function snapshotFromFacts(
  facts: SnapshotInput,
  capturedAt = new Date().toISOString()
): CapabilitySnapshot {
  return {
    capturedAt,
    name: facts.name ?? "agent",
    capabilities: facts.capabilities.map((c) => ({
      source: c.source,
      label: c.label,
      requiresApproval: c.requiresApproval,
    })),
    reach: facts.reach.map((r) => ({
      label: r.label,
      kind: r.kind,
      access: r.access,
      detail: r.detail,
    })),
    autonomy: facts.autonomy.map((a) => ({
      does: a.does,
      when: a.when,
      consent: a.consent,
    })),
    subagents: [...facts.subagents],
  };
}

const ACCESS_RANK: Record<Reach["access"], number> = {
  read: 0,
  write: 1,
  "read-write": 2,
};

/** Reach that touches an external system (vs internal data). */
function isExternal(r: SnapshotReach): boolean {
  return r.kind === "api" || r.kind === "channel";
}

function indexBy<T>(items: T[], key: (t: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const it of items) m.set(key(it), it);
  return m;
}

function diffReach(prev: SnapshotReach[], next: SnapshotReach[]): DiffEntry[] {
  const prevByLabel = indexBy(prev, (r) => r.label.toLowerCase());
  const nextByLabel = indexBy(next, (r) => r.label.toLowerCase());
  const entries: DiffEntry[] = [];

  for (const [key, r] of nextByLabel) {
    const before = prevByLabel.get(key);
    if (!before) {
      // New reach is elevated when it touches an external system.
      entries.push({
        kind: "reach",
        change: "added",
        summary: `Can now reach ${r.label} (${r.access})`,
        risk: isExternal(r) ? "elevated" : "routine",
      });
    } else if (ACCESS_RANK[r.access] > ACCESS_RANK[before.access]) {
      entries.push({
        kind: "reach",
        change: "changed",
        summary: `${r.label}: access widened from ${before.access} to ${r.access}`,
        risk: "elevated",
      });
    } else if (ACCESS_RANK[r.access] < ACCESS_RANK[before.access]) {
      entries.push({
        kind: "reach",
        change: "changed",
        summary: `${r.label}: access narrowed from ${before.access} to ${r.access}`,
        risk: "routine",
      });
    }
  }
  for (const [key, r] of prevByLabel) {
    if (!nextByLabel.has(key)) {
      entries.push({
        kind: "reach",
        change: "removed",
        summary: `No longer reaches ${r.label}`,
        risk: "routine",
      });
    }
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
        summary: `New capability: ${c.label}${
          c.requiresApproval === false ? " (runs without approval)" : ""
        }`,
        risk: "routine",
      });
    } else if (before.requiresApproval === true && c.requiresApproval === false) {
      // An action that used to ask now runs unattended — elevated.
      entries.push({
        kind: "capability",
        change: "changed",
        summary: `${c.label}: no longer asks for approval`,
        risk: "elevated",
      });
    } else if (before.requiresApproval !== true && c.requiresApproval === true) {
      entries.push({
        kind: "capability",
        change: "changed",
        summary: `${c.label}: now asks for approval`,
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
      entries.push({
        kind: "autonomy",
        change: "added",
        summary: `New autonomous action: ${a.does} — ${
          onOwn ? "acts on its own" : "asks first"
        } (${a.when})`,
        risk: onOwn ? "elevated" : "routine",
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

function diffSubagents(prev: string[], next: string[]): DiffEntry[] {
  const prevSet = new Set(prev.map((s) => s.toLowerCase()));
  const nextSet = new Set(next.map((s) => s.toLowerCase()));
  const entries: DiffEntry[] = [];
  for (const s of next) {
    if (!prevSet.has(s.toLowerCase())) {
      entries.push({
        kind: "subagent",
        change: "added",
        summary: `Now delegates to ${s}`,
        risk: "elevated",
      });
    }
  }
  for (const s of prev) {
    if (!nextSet.has(s.toLowerCase())) {
      entries.push({
        kind: "subagent",
        change: "removed",
        summary: `No longer delegates to ${s}`,
        risk: "routine",
      });
    }
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
  next: CapabilitySnapshot
): CapabilityDiff {
  if (!prev) {
    return { isInitial: true, entries: [], hasElevated: false, hasChanges: false };
  }
  const entries = [
    ...diffCapabilities(prev.capabilities, next.capabilities),
    ...diffReach(prev.reach, next.reach),
    ...diffAutonomy(prev.autonomy, next.autonomy),
    ...diffSubagents(prev.subagents, next.subagents),
  ];
  // Elevated first, then by kind, for a scannable list.
  entries.sort((a, b) =>
    a.risk === b.risk ? 0 : a.risk === "elevated" ? -1 : 1
  );
  return {
    isInitial: false,
    entries,
    hasElevated: entries.some((e) => e.risk === "elevated"),
    hasChanges: entries.length > 0,
  };
}
