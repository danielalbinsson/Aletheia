# Spec — Diff-on-Deploy: a capability review gate

*Status: draft · Owner: Daniel · Last updated: 2026-06-27*

## Problem Statement

When you deploy an eve agent, you ship a change to what that agent can **do**,
what it can **touch**, and when it **acts on its own** — but nothing in the
current flow tells you what changed. A refactor can quietly add write access to
a channel, or a new schedule that runs unattended, and it lands in production
unseen. Aletheia already parses these facts into a structured model
(`Capability`, `Reach`, `Autonomy.consent` — "the trust line"); today it only
*displays* them. The cost of not solving this is privilege creep shipped
silently: the exact failure mode that makes autonomous agents hard to trust.

## Goals

1. Before any deploy, the user sees a plain-language summary of every change to
   the agent's capabilities, reach, and autonomy since the last deployed version.
2. Changes that raise risk — new autonomous actions, new or widened write
   access, new external reach — are visually escalated and require explicit
   acknowledgement before deploy proceeds.
3. The deploy snapshot travels with the code, so the diff is correct on any
   machine and survives across sessions.
4. Turn the portrait from a picture into a control: the legibility layer and the
   IDE fuse at the deploy step.

## Non-Goals

- **Runtime verification** that the agent only touches what it declares. This
  spec diffs *declared* capability from the parsed model, not observed behavior.
  Separate, larger initiative.
- **Multi-agent / fleet diffing.** One agent per workspace, as today.
- **Policy enforcement / approvals by a second person.** v1 is single-user
  self-acknowledgement, not a role-gated approval workflow.
- **Rich visual diff of the portrait image.** The diff is over the structured
  model (capabilities/reach/autonomy), not the rendered face.
- **Git/version history browsing.** We compare against one baseline (last
  deploy), not an arbitrary historical version.

## User Stories

**Builder (primary)**
- As an agent builder, I want to see what changed about what my agent can do,
  touch, and decide before I deploy, so I don't ship capability I didn't intend.
- As an agent builder, I want risky changes (new autonomy, new write/external
  reach) called out distinctly from benign ones, so I can focus my review.
- As an agent builder deploying for the first time, I want a clear "initial
  capabilities" summary instead of a broken or empty diff.

**Stakeholder / approver (secondary, sets up future work)**
- As someone the agent acts on behalf of, I want the capability change recorded
  with each deploy, so there's an honest trail of how its powers grew over time.

## Requirements

### Must-Have (P0)

**P0-1 — Snapshot the model at deploy.**
On a successful `eve deploy`, persist the current `AgentModel`'s
capability/reach/autonomy (plus name, model id, and a content hash) to a
tracked file.
- Given a deploy succeeds, when it completes, then a snapshot is written to
  `agent/.aletheia/deployed-capabilities.json` (tracked in git).
- Given a deploy fails, then no snapshot is written.

**P0-2 — Compute the diff.**
Before deploy, compare the current parsed model against the last snapshot and
produce added / removed / changed entries for each of capabilities, reach, and
autonomy.
- Reach changes must distinguish *access level* changes (read → read-write) from
  wholly new reach.
- Autonomy changes must surface `consent` transitions (asks-first →
  acts-on-its-own) as their own category.

**P0-3 — Risk classification.**
Each diff entry is tagged `elevated` or `routine`. Elevated = any of: new
`acts-on-its-own` autonomy; new reach; reach access widened toward `write`;
new external `api`/`channel` reach. Everything else is routine.

**P0-4 — Review panel in `/run` deploy flow.**
Before the deploy runs, render the diff grouped by elevated vs routine, in plain
language ("Can now **write** to Slack #support — was read-only").
- Given there are elevated changes, when the user clicks deploy, then they must
  tick an acknowledgement ("I've reviewed these capability changes") before the
  deploy request is sent.
- Given there are no changes, then show "No capability changes since last
  deploy" and allow deploy without a gate.

**P0-5 — First-deploy baseline.**
- Given no snapshot exists, then show the full current capability set labelled
  "Initial capabilities" (not a diff) and require a single acknowledgement.

### Nice-to-Have (P1)

- **P1-1** — Show the diff at build time too (advisory, no gate), so changes are
  visible earlier in the loop.
- **P1-2** — A "what changed" line in the deploy success log and the clickable
  Production link card.
- **P1-3** — Persist a short append-only history of snapshots
  (`deployed-capabilities.history.jsonl`) for the stakeholder trail.

### Future Considerations (P2)

- **P2-1** — Runtime attestation: compare declared reach against what the agent
  actually called in observed sessions (`/observe` already has traces).
- **P2-2** — Shareable read-only diff link for a non-builder approver.
- **P2-3** — Second-party approval gate (someone other than the deployer ack's).
- **P2-4** — Framework-agnostic snapshots via the adapter, so the diff works for
  non-eve agents.

## Design Decisions (resolved defaults — flag if you disagree)

- **Snapshot location:** `agent/.aletheia/deployed-capabilities.json`, **tracked
  in git**, so the baseline is the last *deployed* state and travels with the
  repo. (Alternative — `.eve/`, untracked — was rejected: the diff would reset
  per machine.)
- **Gate style:** advisory + acknowledgement, **not hard block.** v1 trusts the
  single user; it makes change *unmissable*, it doesn't forbid it.
- **Diff source:** the parsed `AgentModel`, reusing the existing
  parser/adapter — no new extraction layer.

## Success Metrics

**Leading**
- ≥ 90% of deploys with elevated changes show the gate (instrumentation: deploy
  events tagged with diff outcome). Measured from first release.
- Builder can correctly state "what changed" after viewing the panel in
  unmoderated test (target: 8/10 sessions). Measured once, pre-GA.

**Lagging**
- Qualitative: in dogfooding, at least one instance where the diff catches an
  unintended capability change before it ships. (The feature's whole reason to
  exist; one real catch validates it.)
- The portrait/legibility story becomes demoable as a *control*, not a picture —
  judged by whether the deploy gate is the thing shown first in a demo.

## Open Questions

- **(eng)** How faithfully does `eveAdapter.ts` populate `reach.access` from real
  eve tools today? If it's approximate, the diff is approximate — do we need to
  tighten extraction first, or ship advisory and improve in parallel? *Blocking
  for trust, not for build.*
- **(eng)** Stable identity for diff entries — match capabilities/reach by
  `source`/`label`? Renames will otherwise read as remove + add. Acceptable for
  v1?
- **(product)** Should a removed `acts-on-its-own` autonomy count as elevated
  (powers shrank — arguably safe) or routine? Leaning routine.
- **(product)** Do we snapshot on *local* `eve start` too, or deploy only?
  Leaning deploy only — deploy is the trust boundary.

## Timeline / Phasing

No hard deadline. Suggested phasing:

1. **Phase 1 (this spec, P0):** snapshot + diff + review gate at deploy.
2. **Phase 2 (P1):** build-time advisory diff, success-log summary, history log.
3. **Phase 3 (P2):** runtime attestation and shareable diff — the bridge to the
   full legibility product.

Dependency: relies on the parser populating reach/autonomy accurately (see open
questions). No external-team dependencies — all local.
