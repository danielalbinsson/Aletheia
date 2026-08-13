# Aletheia CLI reference

## Install (published)

In the eve agent directory:

```bash
npx @danielalbinsson/aletheia-cli portrait
npx @danielalbinsson/aletheia-cli diff --baseline git:main
npx @danielalbinsson/aletheia-cli snapshot   # after intentional expansion; commit the file
```

Or `pnpm add -D @danielalbinsson/aletheia-cli`. The binary name is `aletheia` either way.

## Build from this repo

```bash
pnpm build:cli
# → bin/aletheia.mjs
pnpm build:cli:npm   # → packages/aletheia-cli/bin/aletheia.mjs
```

## Diff against a baseline

```bash
aletheia diff --baseline git:main
# or: node bin/aletheia.mjs diff --baseline git:main
```

Typical baselines:

- `git:main` / `git:<ref>` — compare to committed snapshot at that ref
- File path to `agent/.aletheia/deployed-capabilities.json`

## Snapshot (commit the baseline)

After an intentional authority expansion, write and commit the new baseline:

```bash
aletheia snapshot
# writes agent/.aletheia/deployed-capabilities.json
# --no-build, --agent-dir <path>, --out <file>
```

Exit `0` on write, `2` on build/manifest failure. Does not fail on elevation.
Commit the file so the next `aletheia diff` uses it as baseline.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | OK / no elevated authority expansion (per policy) |
| 1 | Authority expanded — needs human attention |
| 2 | Error |

## CI

Use `.github/workflows/capability-review.yml`. Fail required checks on elevated changes. Acknowledge with label `capability-change-ack`, then run `aletheia snapshot` and commit `agent/.aletheia/deployed-capabilities.json` on the same PR.

## Policy

Repo-level `.aletheia/policy.json` can set `failOn` (`elevated` | `never` | …) and custom blast-radius `rules` with `category`, `severity`, and `pattern`.
