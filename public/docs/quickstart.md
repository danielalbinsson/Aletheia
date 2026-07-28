# Quickstart — Aletheia for eve agents

Aletheia is a local-first trust tool for [Vercel eve](https://eve.dev) agents. It reads an agent's files (and optionally the compiled eve manifest) and renders a **self-portrait** plus a **capability review**. It never runs, edits, or deploys the agent.

The `aletheia diff` CLI invokes `eve build` by default so its facts can read *verified from build* — pass `--no-build` to skip it. That writes eve's own output under `.eve/` and leaves your agent source untouched. Browsing in the web UI never builds.

**Requirements:** Node 24+ and pnpm.

## Install and run

```bash
git clone https://github.com/danielalbinsson/Aletheia.git
cd Aletheia
pnpm install
pnpm dev            # → http://localhost:5173
```

In the app, click **Browse folder…** and pick a directory that contains eve projects (folders with `agent/agent.ts`). Choose an agent from the dropdown. Portrait and capability review render for that agent.

## Fixed workspace

```bash
# .env.local
ALETHEIA_WORKSPACE=/path/to/your/eve-agent
```

## Headless capability review (CI)

```bash
npx @danielalbinsson/aletheia-cli diff --baseline git:main
# from this repo: pnpm build:cli && node bin/aletheia.mjs diff --baseline git:main
# exit 0 = ok, 1 = authority expanded, 2 = error
```

Ship `.github/workflows/capability-review.yml` as a required check. Acknowledge intentional authority expansion with the `capability-change-ack` label.

## Agent skill

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
```

## What "verified" means

- **Verified from build** — facts from `.eve/compile/compiled-agent-manifest.json` after `eve build`
- **From source** — tolerant read of `agent/` when no manifest exists; labelled honestly
- Aletheia never invents approval or read/write semantics that eve does not expose

See [honesty-contract.md](./honesty-contract.md) and [capability-review.md](./capability-review.md).

## Sitemap

See the full [sitemap](/sitemap.md) for all pages.
