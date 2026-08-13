# Ledger — example eve agent

Finance-style [eve](https://eve.dev) agent (reconcile, QuickBooks/bank reach,
auditor subagent) used as an inspectable blueprint in
[Aletheia](https://github.com/danielalbinsson/Aletheia).

This folder is a standard eve workspace (`agent/agent.ts`). Point Aletheia at
it — Browse folder and `ALETHEIA_WORKSPACE` both resolve that layout:

```bash
# from the Aletheia repo root
ALETHEIA_WORKSPACE=$PWD/examples/ledger pnpm dev
```

Or: `pnpm dev` → Browse folder → select `examples/ledger`.

Install the trust skill for coding agents:

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
# authority diff (after npm publish):
npx @danielalbinsson/aletheia-cli diff --baseline git:main
```

Registry-ready copies (Eve Directory / Evex) live under
[`ecosystem/`](../../ecosystem/README.md).
