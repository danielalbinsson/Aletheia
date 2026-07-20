# Release Health Watch

Use this module to turn a launch watch into executable rollout decisions. A
dashboard is not a verdict: every signal resolves to a baseline, segment,
sample rule, owner, action, recovery and verification state inside the Launch
Admission Record.

## State machine

```text
release_candidate -> preflight_passed -> bounded_canary_or_staged_rollout
-> health_observation -> expand | hold | rollback_or_forward_fix
-> full_release -> closeout_observation -> post_release_review

preflight_failed -> blocked
health_observation -> insufficient_sample -> remain_bounded
health_observation -> ruin_boundary_crossed -> automatic_stop
rollback_or_forward_fix -> recovery_readback -> resume_or_withdraw
```

Never expand merely because no alert fired. Require both no blocker and enough
representative evidence for the declared risk.

## Dashboard row contract

```text
release/candidate ID and exact version/config/model/policy:
signal and user journey:
source authority, freshness and completeness:
baseline window and expected direction:
segments and minimum representative sample:
watch/hold/stop threshold with uncertainty/hysteresis:
owner and independent decision authority:
automatic action, rollback/forward-fix and communication:
recovery predicate and exact live readback:
```

Separate these signal planes:

| Plane | Examples | Typical decision |
| --- | --- | --- |
| Release mechanics | deployed/released identity, rollout %, update adoption, processing/store state | hold until exact artifact/readback is correct |
| Reliability | startup/crash/hang, latency, resource, server, sync/save/data integrity | stop, rollback or narrow exposure |
| Critical journeys | login, onboarding, create/save/export, search, collaboration | hold or forward-fix with bounded cohort |
| Money/access | checkout, grant, restore, entitlement, refund/revoke, account access | immediate paid-flow stop or rollback |
| Trust | privacy/consent, permission, accessibility, safety, child/age, abuse | stop affected exposure; authority cannot be averaged away |
| Commercial | activation/conversion/retention and claim match | inspect mechanism; never trade against a hard floor |
| Support/reputation | ticket/incident themes, duplicate contacts, public reviews, known issues | support macro, public status, fix or claim correction |

## Rules

- `release-health-1` — Define rollout and rollback/withdraw constraints before
  choosing metrics; app stores, auto-updaters and PC storefronts may not permit
  instant rollback.
- `release-health-2` — Segment at least by exact version/config, platform,
  channel, region, plan/entitlement and device/hardware where they can hide
  materially different outcomes.
- `release-health-3` — Global averages cannot clear a segment that crossed a
  ruin boundary. Preserve small severe cohorts and contradictory evidence.
- `release-health-4` — Critical journeys combine deterministic smoke, runtime
  telemetry and support/review evidence; one source cannot self-certify health.
- `release-health-5` — Every hold/stop threshold names action, owner,
  communication, rollback/forward-fix and recovery readback.
- `release-health-6` — Missing, stale or contradictory telemetry fails safe by
  preventing expansion; it does not automatically roll back a healthy system
  unless the predeclared ruin boundary requires that response.
- `release-health-7` — Post-release review updates the owning test, runbook,
  release communication and future admission gate; it is not a narrative recap.

## Decision examples

| Signal | Required segmentation | Response |
| --- | --- | --- |
| Crash-free sessions regress | version, OS/device/hardware, journey | hold/rollback and verify recovery |
| Login or entitlement errors rise | region, provider, plan, version | stop affected access/paid exposure; auth/billing owner |
| Checkout conversion drops | channel, device, price/offer, release | hold promotion; verify product/claim/payment mechanism |
| Support duplicates spike | theme, severity, version, locale | link known issue, macro, fix owner and customer update |
| Store review/release stalls | store, version, territory | pause dependent launch beats; poll external state |
| Desktop update adoption stalls | OS, architecture, channel, from-version | inspect signing/updater; provide safe manual recovery |
| Save/cloud integrity fails | build, device count, migration path | stop release until restore/rollback is proven |

## PC/storefront first-week addendum

For a game or PC storefront release, include exact-build crash/performance,
server/disconnect, save integrity, controller/input/settings, demo-to-product
expectation, refund reason, review theme and support-duplicate rows. Use the
studio's approved target and baseline. If absent, label any proposed tripwire as
an internal hypothesis requiring owner acceptance before launch; never present
it as platform policy.

Store-claim mismatch can require a copy/tag/asset correction even when the build
is technically healthy. Creator/community response belongs to Marketing;
capsule/trailer/screenshots belong to Product Asset Production; technical
branch/build readback belongs to Distribution Readiness.

## Events and closeout

Record `release_candidate_created`, `release_preflight_passed`,
`rollout_started`, `rollout_percentage_changed`,
`release_health_signal_evaluated`, `rollout_hold_triggered`,
`automatic_stop_triggered`, `rollback_started`, `rollback_completed`,
`forward_fix_verified`, `store_release_state_changed`, and
`post_release_review_completed` only through the product's analytics/operations
owner.

Close only after the exact released identity is read back, every triggered
action has recovery evidence, conditional exceptions are resolved or stopped,
customer/support communication is truthful, and systemic blind spots have a
durable owning correction.
