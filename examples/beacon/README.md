# Beacon — example eve agent

Support-style [eve](https://eve.dev) agent used as an inspectable blueprint in
[Aletheia](https://github.com/danielalbinsson/Aletheia).

**Before you run it**, point Aletheia at this folder:

```bash
# from the Aletheia repo root
ALETHEIA_WORKSPACE=$PWD/examples/beacon pnpm dev
```

Or: `pnpm dev` → Browse folder → select `examples/beacon`.

Install the trust skill for coding agents:

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
```
