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

**P0-3 — Consent from approval + schedule kind.**
- Capability gains an `approval` signal (`always` | `once` | `never` | `none`)
  read from the tool definition.
- `Autonomy.consent` is derived: a `markdown` schedule ⇒ `acts-on-its-own`; a
  `run` schedule ⇒ classify by whether it requires approval / acts as the agent.
  No hand-written `consent` strings.
- Given a tool with `approval: always`, then the capability is marked "asks
  before acting"; given `never`/absent, "acts without asking".

**P0-4 — Plain-language capability card + agent-level reach.**
For each capability render: human label (from slug), description, what it
accepts (summarized from `inputSchema` — field names + types, not raw JSON), and
its approval state (`requiresApproval`). Reach is rendered **once at the agent
level** (not per card), since eve exposes connections agent-wide with no
tool binding — list each connection's name, protocol, url, and whether it's
authenticated (`hasAuthorization`).
- Given a tool with an input schema, then required inputs are listed in plain
  language ("needs: a since-timestamp").
- Given the agent has connections, then a "What it can reach" section lists them
  with protocol and auth state; given none, it states the agent reaches nothing
  external.

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

- **Extraction source (RESOLVED by spike, 2026-06-27):** `eve info --json`
  (the `AgentInfoResponse`) is authoritative — Aletheia *already* calls it via
  `runEveInfo`. It is the resolved/runtime view and is the only one that carries
  approval. The static `agent-discovery-manifest.json` does **not** (its
  builder hardcodes `requiresApproval: false`), and `.eve/agent-summary.json`
  (the Vercel CDN summary) is too slim (name/description/path only). So: map the
  `eve info --json` response; source-file regex is retained only for human
  niceties (humanized labels), never for trust facts.
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

- ~~**(eng)** Does the manifest expose tool `approval`?~~ **RESOLVED (spike):**
  Yes, but only as a **boolean** — `requiresApproval` on tools, `hasApproval` on
  connections (`approval !== undefined`). The mode (`always`/`once`/`never`) is
  a runtime function and does not serialize, so P0-3 surfaces *whether* a gate
  exists, not which kind. **Caveat:** `never()` is still a defined function, so a
  tool gated with `never()` reads as `requiresApproval: true`. Acceptable for v1
  (presence ≈ "author thought about approval"); note it in the UI copy.
- ~~**(eng)** Can we attribute a connection to a specific tool?~~ **RESOLVED
  (spike):** No. Connections are exposed at the **agent level** only; there is no
  tool→connection binding (connection operations are dynamic, via
  `connection_search`). So P0-4 shows touch/reach as an **agent-level rollup**,
  not per-capability. Reach moves out of the per-tool card. *(P0-4 updated
  accordingly — see Requirements.)*
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
