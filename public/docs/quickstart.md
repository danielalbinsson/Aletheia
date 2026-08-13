# Quickstart — Aletheia for eve agents

Aletheia is a local-first trust tool for [eve (Vercel)](https://eve.dev) agents. It reads an agent's files (and optionally the compiled eve manifest) and renders a **self-portrait** plus an **authority diff**. It never runs or deploys the agent. `init` and `snapshot` write Aletheia inspection files; they do not edit agent source.

The CLI (`diff`, `portrait`, `passport`, `snapshot`, `init`) invokes `eve build` by default so its facts can read *verified from build*. Pass `--no-build` to skip the build and reuse an existing compiled manifest (exits `2` if none exists; it does not produce from-source facts). That writes eve's own output under `.eve/` and leaves your agent source untouched. Browsing in the web UI never builds.

**Requirements:** Node 24+ and pnpm.

## In the agent directory

```bash
npx @danielalbinsson/aletheia-cli portrait
npx @danielalbinsson/aletheia-cli diff --baseline git:main
npx @danielalbinsson/aletheia-cli snapshot   # after intentional expansion; commit the file
```

The published npm package is **0.4.0** and does not include `init` or `build:<ref>`. Those commands, and the remote Action, are source/unreleased until the next publish. From this repo: `pnpm build:cli && node bin/aletheia.mjs <command>`.

Exit `0` = ok, `1` = authority expanded, `2` = error. After an intentional expansion: label `capability-change-ack`, run `snapshot`, and commit `agent/.aletheia/deployed-capabilities.json` on the same PR.

Ship `.github/workflows/capability-review.yml` as a required check.

## Visual inspector

```bash
git clone https://github.com/danielalbinsson/Aletheia.git
cd Aletheia
pnpm install
pnpm dev            # → http://localhost:5173
```

In the app, click **Browse folder…** and pick a directory that contains eve projects (folders with `agent/agent.ts`). Choose an agent from the dropdown. Portrait and authority diff render for that agent.

## Fixed workspace

```bash
# .env.local
ALETHEIA_WORKSPACE=/path/to/your/eve-agent
```

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
