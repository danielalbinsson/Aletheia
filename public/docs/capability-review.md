# Capability review and `aletheia diff`

The novel part of Aletheia is not only the portrait — it is the **authority diff** over time. The question: *did this version give the agent more power?*

## What is elevated

Flagged as **needs your attention**:

- New external reach (connections / channels)
- New acts-on-its-own schedule
- New delegation (subagent)
- Lifted restriction / removed approval gate
- Model swap or system-prompt change that expands authority

Routine changes pass quietly.

## Blast radius

New reach is ranked by category severity. Defaults (tunable via `.aletheia/policy.json`):

- **High** — payments, secrets & identity, infrastructure, data stores
- **Medium** — communications, repos, docs/calendar

Example policy:

```json
{
  "failOn": "elevated",
  "rules": [
    { "category": "customer records", "severity": "high", "pattern": "zendesk|intercom" }
  ]
}
```

## CLI

```bash
pnpm build:cli
aletheia diff --baseline git:main
```

Exit codes: `0` ok, `1` authority expanded, `2` error.

## CI

`.github/workflows/capability-review.yml` fails a required check when authority expands. Merge intentional changes with the `capability-change-ack` label.

Baseline file often used: `agent/.aletheia/deployed-capabilities.json` (tracked in git).

## Analogy

Capability review should feel like a **Vercel preview** for deploys: automatic, shareable, and blocking when authority expands — before the agent ships with more power than last time.

## Sitemap

See the full [sitemap](/sitemap.md) for all pages.
