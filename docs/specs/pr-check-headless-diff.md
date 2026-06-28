# Spec — Headless `aletheia diff` + PR check

*Status: draft · Owner: Daniel · Last updated: 2026-06-28*

## Problem Statement

Aletheia can already diff what an agent can do, reach, and do unprompted — but
only on localhost `/run`, manually, for one developer, at deploy time. That's a
trustworthy diff in the wrong place. The reason Vercel's preview made deploys
feel safe was never the diff itself; it was that the diff sat on the pull
request — automatic, shareable, and blocking — so review happened at a gate the
whole team already walked through. To deliver "you see what an agent can do,
reach, and do unprompted before it ships," the capability diff has to run in CI
and land on the PR. This spec is that path: a headless `aletheia diff` command
and a GitHub check built on it.

## Goals

1. Every PR that changes `agent/` gets an automatic, plain-language capability
   diff posted to the PR, derived from eve's compiled manifest.
2. PRs that **expand authority** (new external reach, new acts-on-its-own
   schedule, new delegation) fail a required check until acknowledged, so
   authority creep cannot merge silently.
3. The diff is reproducible and attributable: pinned to a head commit and a
   manifest hash, so a reviewer knows exactly what they approved.
4. The same engine powers the CLI and the `/run` panel — one diff, two surfaces.

## Non-Goals

- **Behavior diffing.** This compares declared *authority/surface area*, not what
  the agent does at runtime. Runtime attestation (`/observe`) is a separate act.
- **Approval/consent signals.** eve does not expose them (verified); out of scope
  until it does.
- **Hosting a preview URL per PR.** v1 posts a markdown comment + check status,
  not a live per-PR portrait deployment.
- **Non-GitHub forges.** The CLI is forge-agnostic; the shipped integration is
  GitHub Actions. GitLab/others can call the CLI themselves.
- **Policy-as-code engine.** A configurable severity/policy layer is P1, not v1.

## User Stories

- As a reviewer, I want a PR that touches `agent/` to show me, in plain language,
  what's changing about what the agent can reach and do unprompted — without
  reading the diff or running anything.
- As an eng lead, I want a PR that grants new external reach or a new autonomous
  schedule to be blocked until someone explicitly acknowledges the change.
- As the agent's owner / security, I want each approved change pinned to a commit
  and manifest hash, so there's an honest record of who approved what authority.
- As a developer, I want to run the same check locally (`aletheia diff`) before I
  open the PR, and get the same answer CI will.

## The CLI

```
aletheia diff [options]
  --baseline <source>   what to compare against (default: git:<base> in CI,
                        else file:agent/.aletheia/deployed-capabilities.json)
                          file:<path>   a snapshot JSON on disk
                          git:<ref>     the committed snapshot at a git ref
                          build:<ref>   checkout + eve build <ref>, derive snapshot
                          url:<addr>    GET a running/deployed agent's manifest
  --format <fmt>        markdown | json        (default: markdown)
  --fail-on <level>     elevated | any | never (default: elevated)
  --out <file>          write output           (default: stdout)
  --no-build            use existing .eve/ instead of running eve build first
  --agent-dir <path>    workspace root         (default: cwd)
```

**Behavior.** Runs `eve build` (unless `--no-build`), reads
`.eve/compile/compiled-agent-manifest.json`, maps it with `manifestAdapter`
(`mapManifest` → `snapshotFromFacts`) to the *current* snapshot, resolves the
baseline snapshot, computes `diffSnapshots(prev, current)`, renders, and exits
non-zero per `--fail-on`. The CLI is a thin wrapper over the existing pure
modules (`src/parser/capabilityDiff.ts`, `src/parser/manifestAdapter.ts`) — no
new diff logic.

**Why these baselines.** `git:<base>` answers "what does this PR change vs the
branch we're merging into." `url:` answers "vs what's actually live in
production" — the truest "before it ships" baseline. `file:`/`build:` are
escape hatches for local use and CI without a committed snapshot.

## Requirements

### Must-Have (P0)

**P0-1 — Headless diff command.**
A Node 24 CLI (`aletheia diff`, shipped as a bin) implementing the contract
above, reusing the existing engine.
- Given a built agent and a baseline, then it prints the diff and exits 0 (no
  elevated changes) or 1 (elevated present, with `--fail-on elevated`).
- Given no compiled manifest and `--no-build`, then it exits with a clear "build
  the agent first" error (distinct non-zero code from a diff failure).
- Given `--format json`, then it emits the `CapabilityDiff` plus metadata
  (head commit, manifest sha256, baseline source) for machine consumption.

**P0-2 — Markdown built for a PR comment.**
- Grouped "⚠ Needs your attention" (elevated) and "Other changes" (routine),
  each entry one plain-language line.
- A verdict line ("Authority expanded — review required" / "No authority
  changes").
- A provenance footer: head commit short SHA + manifest sha256 + baseline source.
- First-deploy / no-baseline case renders the full current capability set as
  "Initial capabilities," not a broken diff.

**P0-3 — GitHub Action / reusable workflow.**
Ship a workflow (and/or composite action) that, on `pull_request` touching
`agent/**`:
- checks out head + base, sets up Node 24, installs, runs `aletheia diff
  --baseline git:$BASE --format markdown`,
- upserts a single **sticky** PR comment (find-by-marker, edit in place — never
  spam new comments),
- sets a check run whose conclusion is success/failure from the CLI exit code.
- Given a PR with only routine changes, then the check passes and the comment
  shows them.
- Given a PR with elevated changes, then the check fails (blocking when marked
  required) and the comment headlines what expanded.

**P0-4 — Acknowledgement / override path.**
Because not every authority increase is wrong, provide an escape hatch that
mirrors `/run`'s acknowledgement: a PR label (e.g. `capability-change-ack`) or a
maintainer re-run flips the failing check to neutral/pass, and the comment
records who acknowledged. Without it, elevated changes stay blocked.

### Nice-to-Have (P1)

- **P1-1 — Consequence/severity model.** Beyond elevated/routine, classify reach
  by blast radius (payments, email/comms, data deletion, prod infra) via a
  configurable map, so the comment leads with "can now reach your payments API,"
  not "+1 connection." Severity drives `--fail-on` thresholds.
- **P1-2 — Diff the behavior levers.** Extend the snapshot/diff to
  `instructions.md` and `model` (and skills): a rewritten system prompt or a
  swapped model is the biggest invisible behavior change. Render as a separate
  "How it thinks" section, distinct from "What it can touch."
- **P1-3 — `url:` baseline against production.** Diff the PR vs the live deployed
  agent's manifest, so the comment is "vs what's actually running."
- **P1-4 — Job summary + artifact.** Also write the diff to the Actions job
  summary and upload the JSON as a build artifact for audit.

### Future Considerations (P2)

- **P2-1 — Signed provenance.** Sign the (commit, manifest hash, diff) tuple so
  an approval is tamper-evident — the compliance-grade version of P0-4.
- **P2-2 — Per-PR portrait artifact.** Render the static portrait for the PR head
  and link it from the comment (the shareable "portrait you can trust").
- **P2-3 — Policy-as-code.** Declarative rules ("new payment reach needs security
  sign-off") enforced by the check — the governance wedge.
- **P2-4 — Non-GitHub integrations** (GitLab MR, Bitbucket) on the same CLI.

## Design Decisions (defaults — flag if you disagree)

- **Reuse, don't reimplement.** The CLI imports the existing pure modules;
  shipped as a bin, transpiled with the same toolchain (esbuild) — verified to
  run headlessly on Node 24.
- **Default baseline in CI is `git:<base>`** (cheap, no second `eve build`),
  upgradable to `url:` for vs-production. Local default is the committed
  snapshot file.
- **Default `--fail-on elevated`** — block authority expansion, let routine
  changes through. Teams can set `any` (strict) or `never` (advisory only).
- **Sticky comment, single check** — match Vercel's calm one-comment UX; never
  spam.

## Success Metrics

**Leading**
- On a seeded PR that adds an external connection, the check fails and the
  comment names the new reach — verified by an end-to-end Action test on a
  fixture repo. Measured at release.
- CLI output is identical to `/run`'s panel for the same diff (one engine) —
  asserted by a shared snapshot test.

**Lagging**
- Dogfooding: at least one real PR where the check stops an unintended authority
  increase before merge (the whole reason it exists).
- Reviewers report they can approve/withhold from the comment alone, without
  opening the diff or running the agent.

## Open Questions

- **(eng)** CI baseline: is "vs base branch's committed snapshot" enough, or do
  teams need "vs production" (`url:`) as the default? Production is the truest
  "before it ships," but requires a reachable deployed endpoint + auth.
- **(eng)** Does `eve build` in CI need AI Gateway / model credentials, or does
  it build offline? (Observed: a model lacking context-window metadata fails the
  build; `modelContextWindowTokens` resolves it. Confirm the credential-free CI
  path.)
- **(product)** Override via label vs. required reviewer (CODEOWNERS) — which is
  the right "acknowledged" gesture for the target teams?
- **(eng)** Monorepos with multiple agents: diff each `agent/` independently and
  post one comment per agent, or a combined comment?

## Timeline / Phasing

1. **Phase 1 (P0):** `aletheia diff` CLI + markdown/json + GitHub Action with
   sticky comment, blocking check, and label override. Delivers the positioning.
2. **Phase 2 (P1):** severity/consequence model, instructions+model diffing,
   `url:` baseline, job-summary artifact.
3. **Phase 3 (P2):** signed provenance, per-PR portrait, policy-as-code.

Dependency: builds directly on the shipped manifest + diff engine
(`manifestAdapter`, `capabilityDiff`, `capabilitySnapshot`). No eve changes
required for P0.
