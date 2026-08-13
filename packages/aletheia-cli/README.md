# @danielalbinsson/aletheia-cli

Headless **authority diff** for [eve (Vercel)](https://eve.dev) agents. Diffs
what an agent can do / reach / do unprompted against a baseline and fails CI when
authority expands.

Part of [Aletheia](https://github.com/danielalbinsson/Aletheia) — the local-first
trust tool for eve agent legibility.

## Install

In your eve agent directory:

```bash
npx @danielalbinsson/aletheia-cli portrait
npx @danielalbinsson/aletheia-cli diff --baseline git:main
npx @danielalbinsson/aletheia-cli snapshot   # after intentional expansion; commit the file
```

The published npm package is **0.4.0** and does not include `init` or `build:<ref>`. Those commands are in this source tree: `pnpm build:cli && node bin/aletheia.mjs`.

Or add as a dev dependency: `pnpm add -D @danielalbinsson/aletheia-cli`. Bins:
`aletheia` and `aletheia-cli` (same entrypoint).

### `init` — sidecars and PR workflow

After `eve init`, write the inspection sidecars and a thin GitHub Actions wrapper around the composite authority-diff Action. Writes Aletheia files; does not run or deploy the agent. Pin the Action with `--action-ref <40-char-sha>`. Snapshots only when no deploy baseline exists.

```bash
node bin/aletheia.mjs init --action-ref <sha>
# writes .aletheia/policy.json, agent/.aletheia/consent.json,
# and .github/workflows/capability-review.yml (if missing)
# --force overwrites existing sidecars; existing snapshots stay until `aletheia snapshot`
```

### `diff` — authority diff for CI

```bash
aletheia diff --baseline git:main
# exit 0 = ok, 1 = authority expanded, 2 = error
```

### `passport` — Kit Certified checklist, mechanically

Scores the agent against the Kit Certified checklist (compiles, consent mirrors
gates, policy present, diff green vs baseline, restrictions visible) and emits a
passport generated from the build.

```bash
aletheia passport --format json    # or markdown
# exit 0 = certified, 1 = not certified, 2 = error
```

### `portrait` — generated capability portrait

Renders the agent's portrait (bust + what it can do / touch / do alone / cannot,
with honest provenance labels) as a build artifact — not a screenshot.

```bash
aletheia portrait --format json    # or text
```

### `snapshot` — write the committed deploy baseline

Writes `agent/.aletheia/deployed-capabilities.json` from current facts so the
next `aletheia diff` uses it as baseline. After an intentional authority
expansion (and the `capability-change-ack` label), run this and commit the file
on the same PR.

```bash
aletheia snapshot
# exit 0 = wrote, 2 = error (build/manifest failure)
# does not fail on elevation
# --out <file> overrides the path
```

All commands accept `--agent-dir <path>`. `diff`, `passport`, `portrait`, `snapshot`, and `init` accept `--no-build` (skip `eve build`; `init` also skips snapshot). `init` also accepts `--force` and `--no-snapshot`.

## Requirements

- Node 24+
- An eve agent project (directory with `agent/`)
- `eve` CLI available when the diff needs to build (`eve build`) for verified facts

## GitHub Action

Pin the composite action at an immutable commit SHA (not a Marketplace listing). The Action runs the CLI bundled at that revision.

```yaml
- uses: danielalbinsson/Aletheia/.github/actions/capability-review@<commit-sha>
  with:
    baseline: git:origin/${{ github.base_ref }}
    fail-on: elevated
```

Inputs: `baseline`, `fail-on` (default `elevated`), `agent-dir` (default `.`), `ack-label` (default `capability-change-ack`), `cli` (optional override; default is the bundled Action CLI). Needs Node 24+ on PATH, plus `contents: read` and `pull-requests: write`. The job must be secret-free: the Action forces a placeholder `OPENROUTER_API_KEY`.

## Related

- Interactive inspector: clone the [Aletheia](https://github.com/danielalbinsson/Aletheia) repo and `pnpm dev`
- Agent skill: `npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust`
- Index for agents: https://raw.githubusercontent.com/danielalbinsson/Aletheia/main/public/llms.txt

## License

MIT

## Tests

From the Aletheia repo root:

```bash
pnpm exec vitest run src/cli
# or
pnpm --dir packages/aletheia-cli test
```

Covers flag parsing, nested `git:` baselines, consent overlay, `init` sidecars, the passport checklist and portrait rendering, and smoke runs of the bundled bin against a fixture agent (`--no-build`).
