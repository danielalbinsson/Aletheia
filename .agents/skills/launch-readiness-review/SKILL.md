---
name: launch-readiness-review
description: Produce or audit one cross-domain launch admission verdict for an app, game, SaaS, desktop product, developer tool, marketplace, major release, beta, or campaign. Integrate exact product, quality, performance, security/privacy, payments, distribution, analytics, support, marketing, legal/authority, rollback, and post-launch evidence into go, conditional-go, hold, or no-go gates. Use when launch-day decision ownership is the artifact; use specialist skills to create missing domain evidence.
---

# Launch Readiness Review

Produce a **Launch Admission Record** that makes a proportional release decision
from exact evidence rather than a ceremonial checklist.

## Atomic boundary

Own the final cross-domain evidence graph, blocker classification, decision,
conditions, launch watch, authority, and recovery drill. Consume sibling facts
by ID/version/digest; do not recreate product design, store submission, payment,
marketing, security, or support artifacts.

Use the shared product artifact envelope when composing with repository product
artifacts. Missing required evidence is a blocker or explicit handoff, never an
invented pass. Do not require an envelope for a standalone review with no such
upstream contract.

## Resource guide

- Read `references/launch-readiness-patterns.md` for proportional domain gates,
  decision classes, conditional-go exceptions, and recovery authority.
- Read `references/release-health-watch.md` when the candidate needs a canary,
  staged rollout, release-health dashboard, first-week operating thresholds, or
  post-release closeout.

## Workflow

1. Identify exact commit/build/content/config/model/policy/migration digests,
   launch type, audiences/age modes, channels/territories, blast radius,
   decision owner, change window, and irreversible harm boundaries.
2. Read the applicable references above. Select only gates applicable to the
   declared candidate, audience, channel, data, money, regulation, and blast
   radius. Record why a domain is applicable or not applicable.
3. Classify each gate `pass`, `watch`, `blocked`, or `not-applicable-with-proof`.
   Separate construction, proof, exposure, and external authority. Do not turn
   an unknown into N/A.
4. Verify exact-candidate artifacts, provenance/signatures where applicable,
   canary/staged rollout, data/backward compatibility, migrations/replay,
   feature/config kill switches, rollback/forward-fix, derived-state/cache
   recovery, and restoration drills.
5. Define the smallest launch watch appropriate to the risk: telemetry and
   countermetrics, alert ownership, exposure caps where useful, pause/withdraw,
   communications, and live readback. For staged or high-change releases,
   produce the release-health row schema, baseline/segment/sample rules,
   expansion/hold/rollback predicates, and closeout evidence.
6. Issue `go`, `conditional-go`, `hold`, or `no-go`. Every condition needs an
   owner, deadline, exact proof, and consequence; it is not a vague promise.

## Source verification

Retrieve current platform/store, privacy/consent, accessibility, security,
payment/refund, advertising/promotion, child/age, legal/regulated-category,
regional, certification, and partner authority. External approval remains an
explicit floor and may not be self-attested.

## When not to use

- Use `product-lifecycle-architect` to build the multi-domain program graph and
  produce the sibling artifacts, not merely decide one launch candidate.
- Use `app-store-distribution-readiness` for channel submission, reviewer,
  certification, rollout, and live-store evidence.
- Use `game-soft-launch-review` for a multi-cohort game learning/exposure
  program rather than final cross-domain admission.
- Use a domain specialist when only one missing artifact is being designed or
  audited and the overall launch decision is not reopened.

## Guardrails

- Marketing readiness never substitutes for product, authority, support,
  payment, migration, security, or recovery readiness.
- Do not call an open high-impact item “post-launch” without a bounded exposure,
  explicit risk acceptance authority, expiry, countermetric, and automatic stop.
- No launch of paid, personal-data, child, destructive, migration, or
  irreversible flows without authoritative state, support, compensation, and
  recovery.
- A green workflow exit is not live proof. Verify deployed/released identity and
  user-visible or telemetry readback.
- Do not add unrelated gates merely for checklist completeness; proportionality
  must never erase a requirement that is actually applicable.

## Output contract

Return one typed Launch Admission Record with:

1. exact candidate/authority identities, scope, audiences/channels, decision
   owner, change window, and ruin boundaries;
2. dependency/evidence graph and pass/watch/blocked/N-A gate matrix;
3. blocker records with owner, exact proof, deadline, and automatic consequence;
4. canary/staged exposure, migration, rollback/forward-fix, cache/derived-state,
   and restoration drill evidence;
5. proportionate launch watch, including any release-health dashboard rows,
   baseline/segment/sample rules, pause/withdraw, communication, and
   live-readback plan;
6. `go | conditional-go | hold | no-go` verdict with machine-readable reasons;
7. post-release live-readback and closeout evidence.

State unresolved external authority and manual decisions explicitly. Do not call
the launch complete until the exact released candidate has live readback.
