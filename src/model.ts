import type { PersonalityTheme } from "./theme/personalityTheme";

// The structured model every surface in Aletheia renders from.
//
// The parser (src/parser) turns a raw eve agent directory into one of these.
// The portrait system (src/portrait) and the page (src/components) only ever
// touch this model — never the raw files. That boundary is deliberate: swap the
// parser when the real eve format is confirmed and nothing downstream changes.

/** A single capability the agent can perform (sourced from tools/ and skills/). */
export interface Capability {
  /** Human, plain-language name. e.g. "Read your inbox". */
  label: string;
  /** One-line description of what it does, in plain language. */
  detail: string;
  /** Where it came from, for honest provenance. */
  origin: "tool" | "skill" | "subagent";
  /** The underlying file/symbol name, kept for the system view. */
  source: string;
  /** Plain-language summary of inputs, derived from the tool's input schema. */
  takes?: string;
  /**
   * "asks-first" when the tool is approval-gated (`approval: always()` in eve).
   * eve does not serialize approval into the compiled manifest, so this is
   * never manifest-verified — it comes from the tool source or from the
   * `agent/.aletheia/consent.json` sidecar, and is rendered with that caveat.
   */
  consent?: "asks-first";
  /** Why it asks first, from the consent sidecar. e.g. "charges a payment method". */
  consentReason?: string;
}

/** Something the agent can reach — data, an API, or a channel. */
export interface Reach {
  /** e.g. "Gmail", "Slack #support", "your calendar". */
  label: string;
  kind: "data" | "api" | "channel";
  /**
   * "read" | "write" | "read-write" — how much it can do there. Optional:
   * eve does not declare read/write on a connection, so both the compiled
   * manifest and the from-source fallback leave this unset rather than
   * inventing it.
   */
  access?: "read" | "write" | "read-write";
  /**
   * Optional provenance detail for connection-backed reach, e.g.
   * "OPENAPI · https://api.intercom.io". Shown beneath the label.
   */
  detail?: string;
  /**
   * Stable identity for diffs: compiled logical path or source path.
   * Labels are display-only and can collide or change without a reach change.
   */
  id?: string;
}

/**
 * A subagent the orchestrator delegates to. In eve, a subagent is a nested
 * agent package with its own model, tools, and connections — so it carries its
 * own capability/reach slice, not just a name. The compiled manifest nests the
 * full sub-manifest under each subagent, which is what makes this knowable.
 */
export interface Subagent {
  /** Human, plain-language name. e.g. "A11y auditor". */
  name: string;
  /** One-line description from the subagent's own defineAgent description. */
  description?: string;
  /** The model the subagent runs on, if declared. */
  runsOn?: string;
  /** What the subagent itself can do (its own tools/skills). */
  capabilities: Capability[];
  /** What the subagent itself can reach (its own connections/channels). */
  reach: Reach[];
  /** Compiled node id or source path. Used to match delegation edges. */
  id?: string;
}

/**
 * A framework capability the agent has explicitly given up — a verifiable
 * "cannot". Sourced from the manifest's `disabledFrameworkTools` (a tool the
 * agent disabled with `disableTool()`). Unlike everything else in the model,
 * this is a trust-*positive* fact: the absence of power, stated plainly.
 */
export interface Restriction {
  /** The disabled framework tool slug, e.g. "bash". */
  tool: string;
  /** Plain-language phrase of what it can no longer do, e.g. "run shell commands". */
  label: string;
}

/** A way the agent acts without being prompted (sourced from schedules/). */
export interface Autonomy {
  /** Plain-language description. e.g. "Every morning at 7am". */
  when: string;
  /** What it does at that time. */
  does: string;
  /**
   * Whether it acts on its own or asks first. Optional: from-source
   * schedules omit it (unknown — never treated as asks-first). The verified
   * adapter sets `acts-on-its-own` because eve schedules fire unattended.
   */
  consent?: "acts-on-its-own" | "asks-first";
}

/** The fully parsed agent — the single source of truth for rendering. */
export interface AgentModel {
  /** Stable id, derived from directory name. */
  id: string;
  /** Display name. */
  name: string;
  /** The model it runs on, if declared (e.g. "claude-opus-4"). */
  runsOn?: string;
  /**
   * First-person introduction, derived from instructions.md.
   * e.g. "I'm a research assistant. I read your inbox each morning…"
   */
  intro: string;
  /** A short first-person tagline — the one-sentence essence. */
  essence: string;
  /** Domain keywords distilled from the intent (drives the portrait motif). */
  domain: string[];
  /** Dominant motif distilled from the intent — the portrait's organizing form. */
  motif: string;
  /** Accent palette derived from the personality motif. */
  theme: PersonalityTheme;
  capabilities: Capability[];
  reach: Reach[];
  autonomy: Autonomy[];
  /**
   * Framework tools the agent has explicitly disabled — verifiable "cannots".
   * Empty means none were disabled (or, from source, none detected).
   */
  restrictions: Restriction[];
  /** Subagents it can delegate to, each with its own capability/reach slice. */
  subagents: Subagent[];
  /**
   * Parent→child delegation from eve's compiled `subagentEdges`. Undefined
   * means the field was absent (unknown), not "no edges". Verified from build
   * when set — including an explicit empty list.
   */
  delegation?: {
    parent: string;
    child: string;
    parentId?: string;
    childId?: string;
  }[];
  /**
   * Authored sandbox presence from eve's compiled `sandbox` /
   * `sandboxWorkspaces`. Undefined means those fields were absent (unknown),
   * not "no sandbox". `present` is set only when `sandbox` itself was
   * serialized (`true` for an object, `false` for `null`). Verified from build
   * when set. Evals are not on this model — eve does not put them on the
   * compiled manifest.
   */
  sandbox?: {
    present?: boolean;
    workspaceCount?: number;
  };
}

/** Derived signals the portrait system maps to visual variables. */
export interface PortraitSignals {
  /** 0–1. How much the agent can touch. Drives density. */
  reach: number;
  /** 0–1. How much it does without asking. Drives weight/posture. */
  autonomy: number;
  /** 0–1. Breadth of capabilities. Drives complexity of the figure. */
  range: number;
  /** A stable hash of the agent definition — same agent, same face. */
  seed: number;
  /** Dominant domain motif. */
  motif: string;
}
