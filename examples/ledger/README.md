# Ledger — example eve agent

Finance-style [eve](https://eve.dev) agent (reconcile, QuickBooks/bank reach,
auditor subagent) used as an inspectable blueprint in
[Aletheia](https://github.com/danielalbinsson/Aletheia).

**Before you run it**, point Aletheia at this folder:

```bash
# from the Aletheia repo root
ALETHEIA_WORKSPACE=$PWD/examples/ledger pnpm dev
```

Or: `pnpm dev` → Browse folder → select `examples/ledger`.

Install the trust skill for coding agents:

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
```
