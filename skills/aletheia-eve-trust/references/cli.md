# Aletheia CLI reference

## Build the binary

From the Aletheia repo:

```bash
pnpm build:cli
# → bin/aletheia.mjs
```

## Diff against a baseline

```bash
node bin/aletheia.mjs diff --baseline git:main
```

Typical baselines:

- `git:main` / `git:<ref>` — compare to committed snapshot at that ref
- File path to `agent/.aletheia/deployed-capabilities.json`

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | OK / no elevated authority expansion (per policy) |
| 1 | Authority expanded — needs human attention |
| 2 | Error |

## CI

Use `.github/workflows/capability-review.yml`. Fail required checks on elevated changes. Acknowledge with label `capability-change-ack`.

## Policy

Repo-level `.aletheia/policy.json` can set `failOn` (`elevated` | `never` | …) and custom blast-radius `rules` with `category`, `severity`, and `pattern`.
