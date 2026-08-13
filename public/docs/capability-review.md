# Authority diff and `aletheia diff`

The **authority diff** asks whether this version gave the agent more power.

## What is elevated

Flagged as **needs your attention**:

- New external reach (connections / channels)
- New acts-on-its-own schedule
- New delegation (subagent)
- Lifted restriction / removed approval gate
- Model swap or system-prompt change that expands authority

Routine changes pass without a flag.

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
npx @danielalbinsson/aletheia-cli diff --baseline git:main
# from this repo: pnpm build:cli && node bin/aletheia.mjs diff --baseline git:main
```

Exit codes: `0` ok, `1` authority expanded, `2` error.

## CI

`.github/workflows/capability-review.yml` fails a required check when authority expands. Acknowledge an intended change with the `capability-change-ack` label, then run `aletheia snapshot` and commit `agent/.aletheia/deployed-capabilities.json` on the same PR — ack and the snapshot commit are one motion.

Baseline file: `agent/.aletheia/deployed-capabilities.json` (tracked in git).

## Analogy

Authority diff should feel like a **Vercel preview** for deploys: automatic, shareable, and blocking when authority expands — before the agent ships with more power than last time.

## Sitemap

See the full [sitemap](/sitemap.md) for all pages.
