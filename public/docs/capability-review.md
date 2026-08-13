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

Consumers pin this repo’s composite action at an immutable commit SHA. The Action runs the CLI bundled at that revision. The job must be secret-free.

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: danielalbinsson/Aletheia/.github/actions/capability-review@<commit-sha>
        with:
          baseline: git:origin/${{ github.base_ref }}
          fail-on: elevated
```

Inputs: `baseline` (required), `fail-on` (default `elevated`), `agent-dir` (default `.`), `ack-label` (default `capability-change-ack`), `cli` (optional override; default is the bundled Action CLI). Node 24+ on PATH.

This Aletheia repo dogfoods a local bin: `.github/workflows/capability-review.yml` builds `bin/aletheia.mjs` and passes `cli: node ${{ github.workspace }}/bin/aletheia.mjs`.

The check fails when the fail-on threshold is hit. Acknowledge an intended change with the `capability-change-ack` label, then run `aletheia snapshot` and commit `agent/.aletheia/deployed-capabilities.json` on the same PR — ack and the snapshot commit are one motion.

Baseline file: `agent/.aletheia/deployed-capabilities.json` (tracked in git).

## Analogy

Authority diff should feel like a **Vercel preview** for deploys: automatic, shareable, and blocking when authority expands — before the agent ships with more power than last time.

## Sitemap

See the full [sitemap](/sitemap.md) for all pages.
