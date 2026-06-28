// policy: optional, per-repo configuration for the capability gate.
//
// Read from `.aletheia/policy.json` at the workspace root. Lets a team teach
// Aletheia what *they* consider high blast radius (e.g. an internal billing
// service Aletheia wouldn't recognize) and how strict the gate should be.
// Everything is optional; with no file, built-in defaults apply.

import type { ConsequenceRule } from "./consequence";

export interface Policy {
  /** Extra consequence rules; these take precedence over the defaults. */
  rules: ConsequenceRule[];
  /** Default gate threshold when the CLI doesn't pass --fail-on. */
  failOn?: "elevated" | "any" | "never";
}

interface RawRule {
  category?: unknown;
  severity?: unknown;
  pattern?: unknown;
  flags?: unknown;
}

/** Parse a policy object (already JSON-decoded). Tolerant: bad entries dropped. */
export function parsePolicy(raw: unknown): Policy {
  const policy: Policy = { rules: [] };
  if (!raw || typeof raw !== "object") return policy;
  const o = raw as { rules?: unknown; failOn?: unknown };

  if (o.failOn === "elevated" || o.failOn === "any" || o.failOn === "never") {
    policy.failOn = o.failOn;
  }

  if (Array.isArray(o.rules)) {
    for (const entry of o.rules) {
      const r = entry as RawRule;
      const category = typeof r.category === "string" ? r.category : null;
      const severity = r.severity === "high" || r.severity === "medium" ? r.severity : null;
      const patternStr = typeof r.pattern === "string" ? r.pattern : null;
      if (!category || !severity || !patternStr) continue;
      try {
        const flags = typeof r.flags === "string" ? r.flags : "i";
        policy.rules.push({ category, severity, pattern: new RegExp(patternStr, flags) });
      } catch {
        // invalid regex — skip this rule rather than fail the whole gate
      }
    }
  }
  return policy;
}
