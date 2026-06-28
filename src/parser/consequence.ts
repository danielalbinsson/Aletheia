// consequence: classify a reach target by blast radius, so the diff can lead
// with "can now reach your payments API" instead of "+1 connection".
//
// Pure and heuristic — matches the connection's label + detail (name, url,
// description) against a default ruleset. Teams can pass extra rules to extend
// or override it; first match wins, so caller rules take precedence.

export interface Consequence {
  /** Plain-language category shown to a reviewer, e.g. "payments". */
  category: string;
  /** Blast radius. High = money / secrets / infra / data; medium = the rest. */
  severity: "high" | "medium";
}

export interface ConsequenceRule extends Consequence {
  pattern: RegExp;
}

// Order matters — higher blast radius first.
export const DEFAULT_RULES: ConsequenceRule[] = [
  { category: "payments", severity: "high", pattern: /\b(stripe|paypal|quickbooks|bank|ledger|invoic|billing|charge|payout|payment|treasury|plaid|wise|adyen)\b/i },
  { category: "secrets & identity", severity: "high", pattern: /\b(vault|secret|okta|auth0|\biam\b|oauth|credential|password|kms|token|clerk)\b/i },
  { category: "infrastructure", severity: "high", pattern: /\b(aws|gcp|azure|kubernetes|k8s|terraform|vercel|cloudflare|fly\.io|render|ec2|lambda|deploy)\b/i },
  { category: "data store", severity: "high", pattern: /\b(s3|postgres|mysql|mongo|database|bigquery|snowflake|redis|bucket|datastore|dynamodb|supabase)\b/i },
  { category: "code & repos", severity: "medium", pattern: /\b(github|gitlab|bitbucket|\brepo\b|\bgit\b)\b/i },
  { category: "communications", severity: "medium", pattern: /\b(slack|gmail|email|mail|twilio|sendgrid|intercom|zendesk|discord|teams|\bsms\b|notif|webhook)\b/i },
  { category: "calendar & docs", severity: "medium", pattern: /\b(calendar|gcal|notion|confluence|drive|sheets|docs|airtable)\b/i },
];

/** Classify a reach target, or null if nothing matches. */
export function classifyReach(
  label: string,
  detail = "",
  extra: ConsequenceRule[] = []
): Consequence | null {
  const hay = `${label} ${detail}`;
  for (const r of [...extra, ...DEFAULT_RULES]) {
    if (r.pattern.test(hay)) return { category: r.category, severity: r.severity };
  }
  return null;
}
