# Beacon — Kit Certified Eve blueprint

Support-style [eve](https://eve.dev) agent used as an inspectable, **Kit Certified**
reference in [Aletheia](https://github.com/danielalbinsson/Aletheia) and
[Agentic Kit](https://agentic-kit.dev).

## Layout

```
examples/beacon/
  agent/                 # eve project (agent.ts, tools, connections, …)
  package.json           # eve build deps (Node 24)
  .aletheia/policy.json  # blast-radius / failOn
  .github/workflows/     # standalone-repo CI template (monorepo uses root workflow)
  UX.md                  # Before / While / After
  PASSPORT.md            # stakeholder one-pager (hand-authored)
```

## Inspect before you run

```bash
# from the Aletheia repo root
pnpm install && pnpm dev
# Browse folder → examples/beacon
```

Or:

```bash
ALETHEIA_WORKSPACE=$PWD/examples/beacon pnpm dev
```

## Capability gate

```bash
cd examples/beacon
npx @danielalbinsson/aletheia-cli diff --baseline git:main
# intentional authority growth: label the PR capability-change-ack
```

## Kit Certified checklist

See https://agentic-kit.dev/docs/kit-certified

Trust skill:

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
```
