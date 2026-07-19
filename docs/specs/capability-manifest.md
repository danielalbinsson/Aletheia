# Spec — Decision-grade capability manifest

*Status: draft · Owner: Daniel · Last updated: 2026-06-27*

## Problem Statement

Aletheia's promise is that a non-builder can read the portrait and *trust* what
the agent can do, touch, and decide. Today it can't deliver that, because the
manifest is built from annotations that eve doesn't actually define — the
adapter regexes `name:`, `reach: { label, kind, access }`, channel `access:`,
and schedule `consent:` out of source. Those fields exist only in Aletheia's own
example agents. On a real eve agent they're absent, so the manifest comes up
empty; and where an author does write them, they're decoupled from behavior, so
they can be wrong. A page that *can* be wrong about what an agent touches is
worse than no page — it manufactures false trust.

Meanwhile eve already computes the truth. `eve build` emits
`.eve/compile/compiled-agent-manifest.json` with structured `tools` (real input
schemas, descriptions), `schedules` (cron + kind), `connections`, `channels`,
`subagents`, and `subagentEdges`. We should source the manifest from there.

## Goals

1. Every fact on the portrait (capability, reach, autonomy, delegation) is
   derived from eve's compiled manifest — the same artifact the runtime uses —
   not from hand-written annotations.
2. A non-builder can read, for each capability: what it does, what it accepts,
   what external systems it touches, and whether it needs approval to run.
3. The manifest is honest about absence: "touches nothing external yet" is a
   first-class, clearly-rendered state, not a blank.
4. The manifest is the substrate the diff-on-deploy gate diffs (see
   `diff-on-deploy.md`), so both features share one source of truth.

## Non-Goals

- **Runtime/observed behavior.** This manifest is static (post-compile). Whether
  the agent *actually* called what it declared at runtime is the `/observe`
  attestation track — separate, later.
- **Perfect static taint analysis.** We will surface connections eve resolves
  and (P1) flag obvious drift, not prove information-flow safety.
- **Authoring UI for reach/approval.** We read what eve compiled; we don't add
  Aletheia-specific annotation fields (that's the mistake we're undoing).
- **Multi-agent.** One agent per workspace, as today.

## Background — the real eve primitives

| Aletheia concept | Authoritative eve source | Notes |
| --- | --- | --- |
| Capability (tool) | `tools[]` in compiled manifest | `name` (path-slug), `description`, `inputSchema` (real JSON Schema). No `reach` field exists. |
| Capability (skill) | `skills[]` | `name`, `description`, markdown. |
| Reach | `connections[]` + `channels[]` | The real external systems (protocol, auth provider). Empty = touches nothing external. |
| Approval / consent | tool `approval` (`always`/`never`/`once`) | The real per-tool human-in-the-loop gate. |
| Autonomy | `schedules[]` | `cron`; `markdown` present ⇒ fire-and-forget autonomous run; `run` handler ⇒ can open sessions on other channels with the agent's own auth (`appAuth`). |
| Delegation | `subagents[]` + `subagentEdges` | Real delegation graph. |

Tool/schedule identity is the **file path slug**; there is no authored `name`.

## Requirements

### Must-Have (P0)

**P0-1 — Source from the compiled manifest.**
Add a reader for `.eve/compile/compiled-agent-manifest.json`; map it into the
`AgentModel`. Capabilities, reach, autonomy, and subagents come from it.
- Given a built agent, when parsed, then capability descriptions and input
  schemas match the compiled manifest exactly.
- Given the manifest is missing (never built), then the UI shows a clear "Build
  the agent to see its verified capabilities" state rather than a stale or
  guessed manifest.

**P0-2 — Reach from connections + channels.**
Populate `Reach` from `connections[]` and `channels[]` (label = connector/
channel name; kind = `api`/`channel`; access/scope from the connection where
available).
- Given an agent with zero connections and channels, then the reach section
  renders an explicit "Reaches nothing outside itself" state.
- Given a connection exists, then its target and (if present) auth provider are
  shown in plain language.

**P0-3 — Autonomy from schedules. (Approval DROPPED — not exposed by eve.)**
- `Autonomy.consent` is `acts-on-its-own` for every schedule: eve schedules
  fire unattended, and the human-in-the-loop (tool `approval`) is **not exposed
  by any eve artifact** in 0.15.5 (verified live). We therefore do **not** render
  per-tool approval/consent at all, rather than render a value we can't trust.
- ~~Capability gains an approval signal~~ — removed. If a future eve version
  exposes approval in the compiled manifest, reintroduce it here.

**P0-4 — Plain-language capability card + agent-level reach.**
For each capability render: human label (from slug), description, and what it
accepts (summarized from `inputSchema` — field names + types, not raw JSON).
**No approval state** (not available). Reach is rendered **once at the agent
level** (not per card): list each connection's name, protocol, and url. eve does
**not** declare a connection's read/write access or auth state in the compiled
manifest, so we show protocol + url and leave access unstated rather than
inventing it.
- Given a tool with an input schema, then required inputs are listed in plain
  language ("needs: a since-timestamp").
- Given the agent has connections, then a "What it can reach" section lists them
  with protocol and url; given none, it states the agent reaches nothing external.

**P0-5 — Provenance + honesty.**
Every rendered fact links to its source (`logicalPath`) and is labelled as
verified-from-build. Nothing is inferred silently; if a value is unknown, say
"not declared" rather than guessing.

### Nice-to-Have (P1)

- **P1-1 — Declared-vs-actual drift flag.** Where a tool's source statically
  references a connection/`fetch`/host not present in its resolved
  `connections`, flag "touches something not in its declared reach." Advisory.
- **P1-2 — Reach rollup.** An agent-level summary: "Touches: Gmail (read),
  Slack (write). Acts on its own: 1 schedule. Needs approval: 2 of 5 tools."
- **P1-3 — Map portrait signals to the real manifest** (reach density from real
  connection count, autonomy weight from real autonomous schedules) so the face
  reflects verified facts, not annotation counts.

### Future Considerations (P2)

- **P2-1 — Runtime attestation** against `/observe` traces (declared vs actually
  invoked).
- **P2-2 — Shareable read-only manifest** for a non-builder approver.
- **P2-3 — Framework-agnostic manifest** via an abstract manifest interface, so
  non-eve agents can populate it.

## Design Decisions (resolved defaults — flag if you disagree)

- **Extraction source (RESOLVED by LIVE run on Node 24, 2026-06-27):** the
  authoritative source is **`.eve/compile/compiled-agent-manifest.json`**,
  written by `eve build`. It needs no running server and carries the
  decision-grade facts: tool name/description/inputSchema, connection
  name/description/protocol/url, schedule cron/markdown/hasRun, skills,
  subagents. Two earlier candidates were ruled out by running them:
  - `eve info --json` (CLI) returns a **slim** shape — tools/skills as bare name
    strings, no schemas. Not enough.
  - `GET /eve/v1/info` (running agent) returns the rich `AgentInfoResponse` but
    **does not expose approval or getToken-auth** — `requiresApproval` and
    `hasAuthorization` read `false` even for `always()`-gated tools with real
    `getToken` auth (function-valued fields don't survive serialization), in
    both `eve start` and `eve dev`.
  Source-file regex is retained only for human niceties (labels), never trust.
- **Build dependency:** the manifest requires a successful `eve build`. The
  portrait's trust claims are only shown for built state; unbuilt shows a prompt
  to build. This is acceptable because deploy already builds.
- **`eveAdapter.ts` stays the swap point** but its job changes from "regex
  source" to "map eve's manifest." The `AgentModel` gains `approval` on
  `Capability` and keeps `Reach`/`Autonomy` but sourced differently.
- **Examples rewritten to real eve shape.** The beacon/ledger/margaux examples
  currently use invented fields; they must be rebuilt as valid eve agents (real
  `defineTool`/`defineSchedule`, real `connect(...)` connections) so the manifest
  has truthful input. Ties into the open "replace placeholder agent" thread.

## Success Metrics

**Leading**
- 100% of rendered trust facts (reach, approval, autonomy) trace to a manifest
  field — verified by a test asserting no trust fact originates from source
  regex. Measured at release.
- On a real eve agent with connections, the reach section is non-empty and
  matches the connections in the compiled manifest (round-trip test).

**Lagging**
- Dogfooding: a reviewer can correctly answer "what can this agent touch, and
  what does it do unattended?" from the page alone (target 8/10 unmoderated).
- At least one case where the drift flag (P1) catches a tool reaching something
  it didn't declare.

## Open Questions

- ~~**(eng)** Does the manifest expose tool `approval`?~~ **RESOLVED by live
  run (Node 24):** No. The compiled manifest omits it; `/eve/v1/info` has a
  `requiresApproval` field but it reads `false` even for `always()`-gated tools
  (the function doesn't serialize), in both `eve start` and `eve dev`. Approval
  is **dropped** from the manifest until eve exposes it. Same for connection
  auth (`hasAuthorization` only reflects `vercelConnect`, not `getToken`).
- ~~**(eng)** Can we attribute a connection to a specific tool?~~ **RESOLVED:**
  No — connections are agent-level only. Reach is an agent-level section, not a
  per-card field. *(P0-4 updated accordingly.)*
- **(future)** If a later eve version serializes tool approval into the compiled
  manifest, reintroduce the consent signal (model field + portrait badge + the
  diff's "no longer asks for approval" escalation, which is currently removed).
- **(eng)** How reliable is static drift detection (P1) given tools can build
  hosts dynamically? Likely best-effort with a clear "advisory" label.
- **(eng)** `eve info --json` requires Node 24 and a resolvable agent; confirm it
  runs cleanly in the deploy/build flow (the dev sandbox here is Node 22, so the
  spike read eve's serialization source directly rather than executing).
- **(product)** For a `run`-handler schedule, what's the right consent label
  when it neither has markdown nor an explicit approval? Default to
  "acts-on-its-own" (conservative/striking) and refine.

## Timeline / Phasing

1. **Phase 1 (P0):** manifest reader + model changes + honest capability cards.
   Rewrite one example agent to real eve shape (with a connection + an approval)
   to prove the pipeline on truthful input.
2. **Phase 2 (P1):** drift flag, reach rollup, portrait signals from real data.
3. **Phase 3 (P2):** runtime attestation, shareable view, framework-agnostic
   interface.

Dependency: blocks/feeds `diff-on-deploy.md` — both diff and gate should run on
this manifest, so land P0 here first.

## Addendum — Consent from the sidecar (2026-07)

Goal 2 asks the portrait to show, per capability, *whether it needs approval to
run*. eve still does not serialize `approval` into the compiled manifest (checked
against 0.15.5 and 0.25.2), so it cannot be sourced the way tools/reach/schedules
are. Rather than drop the goal or fake verification, consent is read from a
build-stable sidecar:

```
agent/.aletheia/consent.json
{ "gated": { "request_refund": "charges the customer's payment method" } }
```

Rules:

- **Not verified.** Consent is always rendered as *source-declared*, never
  *verified from build*. The honesty contract is intact: the manifest remains the
  only source of verified facts.
- **Two readers, one fact.** The app reads the sidecar (and, as a convenience,
  parses an `approval:` field from tool source); the CLI/PR-check reads the
  sidecar only, because it is the portable, build-stable record.
- **The seam.** `applyManifest` overlays sidecar consent onto the manifest-verified
  capability, matched by logical path — verified existence + declared consent.
- **Gating the gate.** `capabilityDiff` treats *removing* a gate from an existing
  tool as elevated (authority expanded); adding one is routine.
- **Forward path.** If a future eve serializes approval, `manifestAdapter` sets
  `consent` directly and the label flips to verified with no other change.
