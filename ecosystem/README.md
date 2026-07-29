# Ecosystem submissions (Phase B)

Ready-to-PR kits so Aletheia blueprints show up where eve agents look for
templates, plus the publishable CLI and community post draft.

## Contents

| Path | Purpose |
| --- | --- |
| `eve-directory/agents/{beacon,ledger}/` | Curated Eve Directory catalog apps |
| `eve-directory/registry-entries.json` | Fragments to merge into `catalog/registry.json` |
| `evex/{beacon,ledger}/` | Evex registry packages (`registry.json` + agent) |
| `../packages/aletheia-cli/` | npm package `@danielalbinsson/aletheia-cli` (`aletheia` bin) |
| `eve-discussions-post.md` | Paste into vercel/eve Discussions |

Canonical source for support-agent *behavior* is the **support-bot** blueprint
in https://github.com/danielalbinsson/eve-blueprints; `examples/ledger` remains
in this repo. Ecosystem copies are registry-shaped (snake_case tools, AI Gateway
`agent.ts`, SETUP/evals).

> Note: the `eve-directory/agents/beacon` and `evex/beacon` submission copies
> predate the Beacon→support-bot consolidation. Refresh or remove them before
> submitting; support-bot is the canonical support blueprint now.

## Submit to Eve Directory

```bash
gh auth login
gh repo fork nolly-studio/eve-directory --clone
# copy Aletheia kits:
cp -R /path/to/Aletheia/ecosystem/eve-directory/agents/beacon catalog/agents/
cp -R /path/to/Aletheia/ecosystem/eve-directory/agents/ledger catalog/agents/
# merge registry-entries.json → catalog/registry.json agents[]
cd catalog/agents/beacon && pnpm install && npx eve info
cd ../ledger && pnpm install && npx eve info
cd ../../.. && pnpm registry:build && pnpm catalog:validate
# open PR
```

## Submit to Evex

```bash
gh repo fork TommyBez/evex --clone
# copy packages under registry/ (Evex layout uses registry/<slug>/)
cp -R /path/to/Aletheia/ecosystem/evex/beacon registry/beacon
cp -R /path/to/Aletheia/ecosystem/evex/ledger registry/ledger
# follow CONTRIBUTIONS.md: registry:scaffold / generate / check
# author must be your GitHub username (danielalbinsson)
```

## Publish `@danielalbinsson/aletheia-cli`

```bash
npm login
cd packages/aletheia-cli
pnpm pack          # sanity-check tarball
npm publish --access public
```

Consumers:

```bash
npx @danielalbinsson/aletheia-cli diff --baseline git:main
# or: pnpm add -D @danielalbinsson/aletheia-cli
```

Note: the unscoped name `aletheia` is already taken on npm (unrelated language).
We publish as `@danielalbinsson/aletheia-cli` (bins: `aletheia` and `aletheia-cli`).
The `@aletheia` npm org/scope is also unavailable.

## Seed skills.sh

After the skill is on `main`:

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
```

Local seed (already done on this machine → `~/.agents/skills/aletheia-eve-trust`).

## GitHub topics

```bash
gh repo edit danielalbinsson/Aletheia \
  --add-topic eve \
  --add-topic vercel-eve \
  --add-topic ai-agent \
  --add-topic agent-skills \
  --add-topic agent-legibility \
  --add-topic capability-review \
  --add-topic aletheia
```
