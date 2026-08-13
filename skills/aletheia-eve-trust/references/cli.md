# Aletheia CLI reference

## Install (published)

In the eve agent directory:

```bash
npx @danielalbinsson/aletheia-cli portrait
npx @danielalbinsson/aletheia-cli diff --baseline git:main
npx @danielalbinsson/aletheia-cli snapshot   # after intentional expansion; commit the file
```

`init` and `build:<ref>` are in this source tree and are **not** in the published npm 0.4.0 package. From this repo: `pnpm build:cli && node bin/aletheia.mjs <command>`.

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

- `git:main` / `git:<ref>` — compare to the committed snapshot file at that ref
- `file:<path>` — compare to a snapshot file (default `agent/.aletheia/deployed-capabilities.json`)
- `build:<ref>` — check out that ref, install its frozen `pnpm-lock.yaml`, run `eve build`, and snapshot (source/unreleased until the next npm publish)

Do not pass `--no-build` with `build:<ref>`.

## Init (sidecars + PR workflow)

After `eve init`, scaffold inspection files. Writes Aletheia sidecars and a PR workflow; does not run or deploy the agent. **Not in the published npm 0.4.0 package** — run from this repo until the next release.

```bash
# from the Aletheia repo
pnpm build:cli && node bin/aletheia.mjs init --action-ref <40-char-sha>
# writes .aletheia/policy.json, agent/.aletheia/consent.json,
# .github/workflows/capability-review.yml (thin Action wrapper, pinned SHA)
# then `aletheia snapshot` only when no deploy baseline exists
# --force overwrites existing sidecars; existing snapshots stay until `aletheia snapshot`
```

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

Pin the composite action at an immutable commit SHA (no Marketplace listing). The Action runs the CLI bundled at that revision — not npm `latest`.

```yaml
- uses: danielalbinsson/Aletheia/.github/actions/capability-review@<commit-sha>
  with:
    baseline: git:origin/${{ github.base_ref }}
    fail-on: elevated
```

Inputs: `baseline`, `fail-on`, `agent-dir`, `ack-label` (default `capability-change-ack`), `cli` (optional override; default is the bundled Action CLI). This Aletheia repo dogfoods `cli: node ${{ github.workspace }}/bin/aletheia.mjs` after building the local bin.

Fail required checks on elevated changes. Acknowledge with label `capability-change-ack`, then run `aletheia snapshot` and commit `agent/.aletheia/deployed-capabilities.json` on the same PR.

## Policy

Repo-level `.aletheia/policy.json` can set `failOn` (`elevated` | `never` | …) and custom blast-radius `rules` with `category`, `severity`, and `pattern`.
