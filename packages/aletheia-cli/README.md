# @danielalbinsson/aletheia-cli

Headless **authority diff** for [eve (Vercel)](https://eve.dev) agents. Diffs
what an agent can do / reach / do unprompted against a baseline and fails CI when
authority expands.

Part of [Aletheia](https://github.com/danielalbinsson/Aletheia) — the local-first
trust tool for eve agent legibility.

## Install

```bash
# in an eve agent project (eve available on PATH / as a dependency)
pnpm add -D @danielalbinsson/aletheia-cli
# or one-shot:
npx @danielalbinsson/aletheia-cli diff --baseline git:main
```

Bins: `aletheia` and `aletheia-cli` (same entrypoint).

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

All three accept `--no-build` (read an existing manifest) and `--agent-dir <path>`.

## Requirements

- Node 24+
- An eve agent project (directory with `agent/`)
- `eve` CLI available when the diff needs to build (`eve build`) for verified facts

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

Covers flag parsing, nested `git:` baselines, consent overlay, the passport checklist and portrait rendering, and smoke runs of the bundled bin against a fixture agent (`--no-build`).
