# Launch Readiness Patterns

## Readiness matrix

| Area | Launch question |
| --- | --- |
| Product | Does the core promise work for the target segment? |
| UI/UX | Are onboarding, empty/loading/error, mobile/responsive states ready? |
| Monetization | Are pricing, payment, entitlement, refund, and cancellation paths clear? |
| Distribution | Are store/web/direct assets, review notes, and releases ready? |
| Support | Are help center, macros, escalation, and contact routes ready? |
| Analytics | Can the team see acquisition, activation, conversion, retention, errors, refunds, and support? |
| Trust/legal | Are privacy, data retention, consent, and policy disclosures consistent? |
| Operations | Is rollback, incident response, monitoring, and ownership clear? |
| Promotion | Are campaign promises, fulfillment, and measurement ready? |

## Rule IDs

- `launch-1` — Define launch objective and no-go criteria before reviewing details.
- `launch-2` — Paid launches require tested checkout, entitlement, refund, cancellation, and support paths.
- `launch-3` — App/store launches require metadata, screenshots, privacy, review notes, test accounts, and policy risk review.
- `launch-4` — Desktop launches require signed installer/update/uninstall and support diagnostics.
- `launch-5` — Game launches require economy, live event, refund, support, and community readiness.
- `launch-6` — Analytics must cover the launch funnel and failure signals, not just page views.
- `launch-7` — Support must have macros, escalation, known issues, and refund/incident routes.
- `launch-8` — Rollback/recovery must be real enough for the blast radius.
- `launch-9` — Promotion claims must match shipped product behavior.
- `launch-10` — Post-launch review should convert evidence into roadmap changes within a fixed window.

## Go/no-go decision table

| Finding | Verdict |
| --- | --- |
| Core promise broken | No-go |
| Payment grants unreliable | No-go for paid launch |
| Store metadata incomplete | No-go for store submission |
| Support macros missing for high-risk flows | Conditional or no-go depending blast radius |
| Analytics missing for non-critical feature | Hold that exposure, or use a finite canary only when an automated observable proxy, cap, stop trigger, owner, and expiry are proven; manual monitoring alone is not admission evidence |
| Promotion assets incomplete | Delay campaign, not necessarily product release |

## Launch room checklist

Document owner, release version, channels, launch window, rollback owner, support lead, incident lead, dashboard links, known issues, no-go criteria, and post-launch review time.

## Conditional-go exception subsystem

A conditional launch is a governed exception, not a softer `go`. Keep the
exception record inside the Launch Admission Record so the product cannot ship
on verbal risk acceptance.

```text
exception_requested
  -> blocked_gate_identified
  -> risk_and_authority_classified
  -> compensating_controls_proved
  -> bounded_exposure_approved
  -> live_monitoring
  -> remediated_and_closed | automatic_stop | rollback
```

Required exception fields:

- exact failed gate and evidence, affected artifact, users, region/channel,
  severity, reversibility, and maximum blast radius;
- accountable remediation owner, independent approval authority, expiry, and
  linked corrective work;
- compensating controls, feature/config gate, cohort/canary cap, observable
  failure signal, threshold, automatic stop, rollback/forward-fix, and tested
  restoration path;
- customer/support communication, incident linkage, live readback, actual
  impact, and post-release gate correction.

| Exception class | Minimum authority/evidence | Default decision |
| --- | --- | --- |
| Flaky non-critical test with isolated failure | Root-cause evidence, bounded canary, replay, expiry | Conditional only |
| Known reversible product defect | Impact cohort, support path, flag, stop threshold, remediation | Conditional or hold |
| Performance regression | Load/SLO evidence, cap, live telemetry, rollback proof | Canary or hold |
| Security, privacy, payment, data-loss, legal, or child-safety gap | Current owning authority and complete recovery evidence | Hold/no-go; generic business approval cannot waive |
| Unobservable, unbounded, or irreversible failure | No compensating control can prove containment | No-go |

Close the exception only after the exact shipped artifact is read back, the
remediation is verified, and any systemic blind spot has changed the canonical
gate. An elapsed expiry automatically blocks further exposure; it never renews
itself.
