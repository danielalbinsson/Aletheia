# @aletheia/cli

Headless **capability review** for [Vercel eve](https://eve.dev) agents. Diffs
what an agent can do / reach / do unprompted against a baseline and fails CI when
authority expands.

Part of [Aletheia](https://github.com/danielalbinsson/Aletheia) — the local-first
trust tool for eve agent legibility.

## Install

```bash
# in an eve agent project (eve available on PATH / as a dependency)
pnpm add -D @aletheia/cli
# or one-shot:
npx @aletheia/cli diff --baseline git:main
```

The `aletheia` binary name is unchanged:

```bash
aletheia diff --baseline git:main
# exit 0 = ok, 1 = authority expanded, 2 = error
```

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
