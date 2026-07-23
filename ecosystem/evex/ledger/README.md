# Ledger

Finance [eve](https://eve.dev) agent: fetch and categorize transactions, reconcile,
post entries, flag anomalies, run month-close, and delegate review to an
`auditor` subagent. Reaches bank + QuickBooks (OpenAPI) and Slack (MCP).

**Inspect before you run.** This listing is an Aletheia blueprint — point
[Aletheia](https://github.com/danielalbinsson/Aletheia) at the installed `agent/`
to see verified reach, schedules, and delegation before you trust it with money
paths.

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
npx @aletheia/cli diff --baseline git:main
```

## Layout

```text
ledger/
├── agent/
│   ├── tools/          fetch, categorize, reconcile, post-entry, flag-anomaly
│   ├── connections/    bank, quickbooks, slack
│   ├── schedules/      nightly-reconcile, month-close
│   ├── skills/
│   └── subagents/auditor/
├── evals/
└── SETUP.md
```

## Run

```bash
pnpm install
pnpm dev
```

See `SETUP.md`. Stubs return mock data — replace execute bodies with real APIs.

## License

MIT · Daniel Albinsson
