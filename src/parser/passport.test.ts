import { describe, it, expect } from "vitest";
import {
  evaluatePassport,
  documentsLifecycle,
  policyIsSensible,
  type PassportInputs,
} from "./passport";
import type { ManifestFacts } from "./manifestAdapter";
import type { CapabilitySnapshot } from "./capabilityDiff";

const facts: ManifestFacts = {
  name: "support-bot",
  capabilities: [
    {
      source: "tools/draft-reply.ts",
      label: "Draft reply",
      detail: "Write and send a reply.",
      origin: "tool",
      consent: "asks-first",
    },
    { source: "tools/search-docs.ts", label: "Search docs", detail: "Search docs.", origin: "tool" },
  ],
  reach: [{ label: "slack", kind: "api" }],
  autonomy: [{ when: "Every 15 min", does: "check tickets", consent: "acts-on-its-own" }],
  restrictions: [
    { tool: "bash", label: "run shell commands" },
    { tool: "write_file", label: "write files" },
  ],
  subagents: [],
};

const baseline: CapabilitySnapshot = {
  capturedAt: "2026-07-26T00:00:00.000Z",
  name: "support-bot",
  capabilities: [],
  reach: [],
  autonomy: [],
  subagents: [],
};

// A fully compliant agent: every required check passes.
function certifiedInputs(): PassportInputs {
  return {
    manifestBuilt: true,
    facts,
    consentGated: { "draft-reply": "Customer-facing send." },
    consentDrift: [],
    policy: { failOn: "elevated", rules: [] },
    policyPresent: true,
    baseline,
    diffPasses: true,
    uxDoc: "## Before\n...\n## While\n...\n## After\n...",
  };
}

describe("evaluatePassport — the happy path", () => {
  it("certifies an agent that passes every required check", () => {
    const r = evaluatePassport(certifiedInputs());
    expect(r.certified).toBe(true);
    expect(r.failures).toBe(0);
    expect(r.name).toBe("support-bot");
    expect(r.checks.every((c) => c.status === "pass" || c.status === "advisory-pass")).toBe(true);
  });
});

describe("evaluatePassport — each required check can fail the stamp", () => {
  it("fails when the manifest did not build", () => {
    const r = evaluatePassport({ ...certifiedInputs(), manifestBuilt: false, facts: null });
    expect(r.certified).toBe(false);
    expect(r.checks.find((c) => c.id === "compiles")?.status).toBe("fail");
  });

  it("fails on consent drift (a source gate missing from consent.json)", () => {
    const r = evaluatePassport({ ...certifiedInputs(), consentDrift: ["refund"] });
    expect(r.certified).toBe(false);
    const c = r.checks.find((c) => c.id === "consent-mirrors-gates");
    expect(c?.status).toBe("fail");
    expect(c?.detail).toContain("refund");
  });

  it("fails when policy.json is absent", () => {
    const r = evaluatePassport({ ...certifiedInputs(), policy: { rules: [] }, policyPresent: false });
    expect(r.certified).toBe(false);
    expect(r.checks.find((c) => c.id === "policy-present")?.detail).toMatch(/No .*policy\.json/);
  });

  it("fails when policy.json is present but empty (no failOn, no rules)", () => {
    const r = evaluatePassport({ ...certifiedInputs(), policy: { rules: [] }, policyPresent: true });
    expect(r.certified).toBe(false);
    expect(r.checks.find((c) => c.id === "policy-present")?.detail).toMatch(/neither/);
  });

  it("fails when there is no committed baseline to diff against", () => {
    const r = evaluatePassport({ ...certifiedInputs(), baseline: null, diffPasses: false });
    expect(r.certified).toBe(false);
    expect(r.checks.find((c) => c.id === "ci-diff-green")?.detail).toMatch(/No committed baseline/);
  });

  it("fails when authority expanded (diff not green)", () => {
    const r = evaluatePassport({ ...certifiedInputs(), diffPasses: false });
    expect(r.certified).toBe(false);
    expect(r.checks.find((c) => c.id === "ci-diff-green")?.detail).toMatch(/authority expanded/);
  });

  it("fails when the agent declares no intentional restrictions", () => {
    const r = evaluatePassport({ ...certifiedInputs(), facts: { ...facts, restrictions: [] } });
    expect(r.certified).toBe(false);
    expect(r.checks.find((c) => c.id === "restrictions-visible")?.status).toBe("fail");
  });
});

describe("evaluatePassport — advisory checks report but never gate", () => {
  it("stays certified when the lifecycle doc is missing (advisory only)", () => {
    const r = evaluatePassport({ ...certifiedInputs(), uxDoc: null });
    expect(r.certified).toBe(true);
    const c = r.checks.find((c) => c.id === "lifecycle-documented");
    expect(c?.required).toBe(false);
    expect(c?.status).toBe("advisory-fail");
  });
});

describe("evaluatePassport — the design-qa case that exposed the original bug", () => {
  // The bundled design-qa agent was marked stamped:true in the gallery while
  // its PASSPORT.md admitted "hand-authored ... until aletheia passport ships".
  // With no committed baseline it must NOT certify — which is exactly what the
  // hardcoded boolean never checked.
  it("does not certify an orchestrator with no baseline just because it looks complete", () => {
    const orchestrator: ManifestFacts = {
      name: "design-qa",
      capabilities: [],
      reach: [{ label: "github", kind: "api" }],
      autonomy: [],
      restrictions: [
        { tool: "bash", label: "run shell commands" },
        { tool: "write_file", label: "write files" },
      ],
      subagents: [
        { name: "a11y-auditor", capabilities: [], reach: [] },
        { name: "design-system-checker", capabilities: [], reach: [] },
        { name: "heuristic-critic", capabilities: [], reach: [] },
      ],
    };
    const r = evaluatePassport({
      manifestBuilt: true,
      facts: orchestrator,
      consentGated: {},
      consentDrift: [],
      policy: { failOn: "elevated", rules: [] },
      policyPresent: true,
      baseline: null, // no deployed-capabilities.json committed
      diffPasses: false,
      uxDoc: null,
    });
    expect(r.certified).toBe(false);
    expect(r.failures).toBeGreaterThan(0);
  });
});

describe("helper predicates", () => {
  it("documentsLifecycle needs all three stages", () => {
    expect(documentsLifecycle("before while after")).toBe(true);
    expect(documentsLifecycle("## Before\n## After")).toBe(false); // missing while
    expect(documentsLifecycle(null)).toBe(false);
  });

  it("policyIsSensible requires presence plus failOn or rules", () => {
    expect(policyIsSensible({ failOn: "elevated", rules: [] }, true)).toBe(true);
    expect(policyIsSensible({ rules: [{}] as never }, true)).toBe(true);
    expect(policyIsSensible({ rules: [] }, true)).toBe(false);
    expect(policyIsSensible({ failOn: "any", rules: [] }, false)).toBe(false); // not present
  });
});
