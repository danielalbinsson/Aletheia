// Kit Certified, made mechanical.
//
// "Kit Certified" was a boolean someone typed into a gallery array. The badge
// asserted a 7-point checklist that nothing checked. This module turns that
// checklist into a function: given the facts Aletheia already extracts, it
// decides — per point, with a reason — whether an agent is certified, and emits
// a passport generated from the build rather than hand-authored to match it.
//
// The checklist is the public definition at agentic-kit.dev/docs/kit-certified.
// An agent is certified only if every REQUIRED check passes. Advisory checks
// are reported but do not gate, so the honest states are "certified",
// "not certified (reason)", never a silent pass.
//
// Pure: no fs, no git, no process. The CLI loads inputs and calls evaluate().
// That keeps every rule unit-testable in isolation — see passport.test.ts.

import type { ManifestFacts } from "./manifestAdapter";
import type { CapabilitySnapshot } from "./capabilityDiff";
import type { Policy } from "./policy";

export type CheckStatus = "pass" | "fail" | "advisory-pass" | "advisory-fail";

export interface PassportCheck {
  id: string;
  title: string;
  required: boolean;
  status: CheckStatus;
  detail: string;
}

export interface PassportResult {
  name: string;
  certified: boolean;
  checks: PassportCheck[];
  /** Count of required checks that failed — 0 iff certified. */
  failures: number;
}

export interface PassportInputs {
  /** Did `eve build` succeed and produce a manifest? */
  manifestBuilt: boolean;
  /** Facts from the compiled manifest, or null if the build did not produce them. */
  facts: ManifestFacts | null;
  /** consent.json `gated` map (tool → reason). */
  consentGated: Record<string, string>;
  /** Tools that declare `approval:` in source but are missing from consent.json. */
  consentDrift: string[];
  /** Parsed .aletheia/policy.json. */
  policy: Policy;
  /** Was policy.json actually present, vs the empty default? */
  policyPresent: boolean;
  /** Committed baseline snapshot, or null if none was found. */
  baseline: CapabilitySnapshot | null;
  /** Does `aletheia diff` against that baseline currently pass (not failing)? */
  diffPasses: boolean;
  /** Text of the agent's UX.md, or null if absent. */
  uxDoc: string | null;
}

const REQUIRED = true;
const ADVISORY = false;

function check(
  id: string,
  title: string,
  required: boolean,
  ok: boolean,
  passDetail: string,
  failDetail: string
): PassportCheck {
  const status: CheckStatus = ok
    ? required
      ? "pass"
      : "advisory-pass"
    : required
      ? "fail"
      : "advisory-fail";
  return { id, title, required, status, detail: ok ? passDetail : failDetail };
}

/** True when UX.md documents all three lifecycle stages (order-independent). */
export function documentsLifecycle(uxDoc: string | null): boolean {
  if (!uxDoc) return false;
  const text = uxDoc.toLowerCase();
  return /\bbefore\b/.test(text) && /\bwhile\b/.test(text) && /\bafter\b/.test(text);
}

/** A policy is "sensible" if it sets a failOn threshold or defines blast-radius rules. */
export function policyIsSensible(policy: Policy, present: boolean): boolean {
  if (!present) return false;
  return Boolean(policy.failOn) || (Array.isArray(policy.rules) && policy.rules.length > 0);
}

export function evaluatePassport(input: PassportInputs): PassportResult {
  const facts = input.facts;
  const restrictionCount = facts?.restrictions?.length ?? 0;

  const checks: PassportCheck[] = [
    check(
      "compiles",
      "Compiles; portrait verified from build",
      REQUIRED,
      input.manifestBuilt && facts !== null,
      "eve build succeeded and produced a compiled manifest.",
      "No compiled manifest. Run `eve build` — until it compiles, the portrait is source-only and cannot be certified."
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
      input.policyPresent
        ? "policy.json is present but sets neither a failOn threshold nor any blast-radius rules."
        : "No .aletheia/policy.json found."
    ),
    check(
      "ci-diff-green",
      "aletheia diff green against a committed baseline",
      REQUIRED,
      input.baseline !== null && input.diffPasses,
      "A committed baseline exists and the current build introduces no unacknowledged authority expansion.",
      input.baseline === null
        ? "No committed baseline (agent/.aletheia/deployed-capabilities.json) to diff against."
        : "aletheia diff is failing: authority expanded relative to the committed baseline."
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
      "Before / While / After lifecycle documented",
      ADVISORY,
      documentsLifecycle(input.uxDoc),
      "UX.md documents the before / while / after lifecycle.",
      "UX.md is missing or does not document all three lifecycle stages (before / while / after)."
    ),
  ];

  const failures = checks.filter((c) => c.required && c.status === "fail").length;

  return {
    name: facts?.name ?? "agent",
    certified: failures === 0,
    checks,
    failures,
  };
}
