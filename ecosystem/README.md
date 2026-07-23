# Ecosystem submissions (Phase B)

Ready-to-PR kits so Aletheia blueprints show up where eve agents look for
templates, plus the publishable CLI and community post draft.

## Contents

| Path | Purpose |
| --- | --- |
| `eve-directory/agents/{beacon,ledger}/` | Curated Eve Directory catalog apps |
| `eve-directory/registry-entries.json` | Fragments to merge into `catalog/registry.json` |
| `evex/{beacon,ledger}/` | Evex registry packages (`registry.json` + agent) |
| `../packages/aletheia-cli/` | npm package `@aletheia/cli` (`aletheia` bin) |
| `eve-discussions-post.md` | Paste into vercel/eve Discussions |

Canonical sources for agent *behavior* remain `examples/beacon` and
`examples/ledger` in the Aletheia repo. Ecosystem copies are registry-shaped
(snake_case tools, AI Gateway `agent.ts`, SETUP/evals).

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

## Publish `@aletheia/cli`

```bash
npm login
cd packages/aletheia-cli
pnpm pack          # sanity-check tarball
npm publish --access public
```

Consumers:

```bash
npx @aletheia/cli diff --baseline git:main
# or: pnpm add -D @aletheia/cli
```

Note: the unscoped name `aletheia` is already taken on npm (unrelated 0.0.4).

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
