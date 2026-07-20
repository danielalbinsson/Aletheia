# Aletheia — see what an agent can do

*Aletheia (ἀλήθεια): truth as unconcealment — bringing what is hidden into the open.*

You cloned an eve agent you didn't write. Before you run it, you'd like to know:
what can it touch? What does it do on its own? What does it ask permission for?
What is it *forbidden* from doing? Today the only way to answer that is to read
the source.

**Aletheia reads it for you.** Point it at any [eve](https://eve.dev) agent and it
renders a **self-portrait** — a first-person page where the agent lays out its
capabilities, its reach into the outside world, the things it does unprompted,
and the powers it has given up — plus a **capability review** that shows how that
authority has changed over time. It never runs the agent, never edits it, never
deploys it. It only makes it legible.

Not a dashboard. Not a flowchart. A portrait you can trust.

## The honesty contract — the core idea

A trust tool that lies is worse than none. So Aletheia is built around one rule:
**it never presents a guess as a fact.** Every claim carries its provenance.

- **Verified from build.** When the agent has a compiled manifest
  (`.eve/compile/compiled-agent-manifest.json`, written by `eve build`), the
  portrait reads eve's own record: tool names, descriptions and input schemas;
  the connections and channels it reaches, with protocol and URL; the schedules
  by which it acts on its own; the framework tools it has **disabled** (verifiable
  "cannots"); and, for orchestrators, each **subagent** it delegates to, recursed
  from the nested manifests. Labelled *verified from build*.
- **From source.** Without a manifest — which is the common case for an agent you
  just cloned — Aletheia falls back to a tolerant read of `agent/` and labels it
  *from source — build to verify*.

This is the point, not a limitation. Aletheia shows what it can prove and clearly
marks what it can't. It will not manufacture the false confidence it exists to
prevent — so where eve doesn't expose something (per-tool **approval**, a
connection's **read/write**), Aletheia refuses to render it as verified, even
though it easily could.

**Consent, honestly.** Approval is decision-grade but eve doesn't serialize it
(still true as of 0.25.2). Rather than fake it or drop it, Aletheia reads it from
a build-stable sidecar, `agent/.aletheia/consent.json`, and always renders a gated
tool as **asks first** *source-declared* — never build-verified. An `approval:`
gate found in tool source that isn't mirrored in the sidecar is reported as
**drift**, not shown as fact. If a future eve serializes approval, the same field
simply flips to verified.

## Capability review — trust over time

The novel part isn't the picture; it's the **diff**. Agents change, and the
question that matters is *did this version give itself more power?*

The `/review` page — and the headless `aletheia diff` — compare what the agent
can do, reach, and do unprompted against a baseline, and lead with authority, not
line counts. New external reach, a new acts-on-its-own schedule, a new delegation,
a lifted restriction, a removed approval gate, a model swap, or a system-prompt
change are flagged **"needs your attention."** Routine changes pass quietly.

New reach is ranked by **blast radius** — payments, secrets & identity,
infrastructure and data stores rank *high*; communications, repos and
docs/calendar rank *medium* — so the review says "now reaches payments," not
"+1 connection." A repo can tune this with `.aletheia/policy.json`:

```json
{
  "failOn": "elevated",
  "rules": [
    { "category": "customer records", "severity": "high", "pattern": "zendesk|intercom" }
  ]
}
```

## Use it

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # parser, diff, discovery, and honesty-contract unit tests
pnpm build      # static portrait bundle in dist/
```

In the app, click **Browse folder…** and point Aletheia at a directory (e.g.
`~/Documents`). It scans for eve agents — any folder with `agent/agent.ts` — and
lets you switch between them from the **Agent** dropdown. Pick one and its
portrait and capability review render for that agent.

You can also pin a default workspace with `ALETHEIA_WORKSPACE` in `.env.local`:

```bash
ALETHEIA_WORKSPACE=/path/to/some/eve-agent
```

Verified facts require a compiled manifest, so an agent shows the *from source*
view until it's been built (`eve build`, which needs **Node 24+**) in its own
project. Aletheia never builds it for you — inspection stays read-only.

| Route | What it shows |
| ----- | ------------- |
| `/` | The agent's self-portrait |
| `/review` | Capability review — how its authority changed |

## Capability review in CI (`aletheia diff`)

The same review runs headless, so it can land on a **pull request** — automatic,
shareable, and blocking, the way a Vercel preview made deploys feel safe. It
builds the agent (in CI, where its toolchain lives), diffs the compiled manifest
against a committed baseline, and posts a single sticky comment carrying the
diff and the agent's portrait.

```bash
pnpm build:cli                       # bundle bin/aletheia.mjs
aletheia diff --baseline git:main    # exit 0 = ok, 1 = authority expanded, 2 = error
```

The shipped GitHub Action (`.github/workflows/capability-review.yml`) fails a
required check when authority expands; acknowledge an intended change with the
`capability-change-ack` label to merge.

## How it works

```
agent/                       the eve agent (the input)
.eve/compile/                eve build output — the source of verified facts
  └─ compiled-agent-manifest.json

src/
  ├─ model.ts                the AgentModel everything renders from
  ├─ parser/
  │   ├─ eveAdapter.ts       source read — the pre-build fallback
  │   ├─ manifestAdapter.ts  ★ maps eve's compiled manifest → verified facts
  │   ├─ sourceScan.ts       comment-safe detection of restrictions + consent drift
  │   ├─ capabilityDiff.ts   snapshot + diff (reach, autonomy, restrictions, mind)
  │   ├─ consequence.ts      classifies reach by blast radius
  │   └─ policy.ts           reads .aletheia/policy.json
  ├─ server/                 read-only Vite dev middleware
  │   ├─ projectApiPlugin.ts    /api/project + /api/workspaces (read only)
  │   ├─ workspaceRegistry.ts   scan a folder for eve agents
  │   └─ nativeFolderPicker.ts  the OS "choose folder" dialog
  ├─ cli/                    `aletheia diff` — the headless PR check
  ├─ portrait/               meaning → visual variables → the ASCII portrait
  ├─ store/ProjectStore.tsx  overlays verified facts onto the source model
  └─ pages/                  the portrait + the capability review
```

`manifestAdapter.ts` is the single point of contact with eve's manifest format
(and it recurses into nested subagent manifests); `eveAdapter.ts` is the
source-read fallback. Nothing downstream of the `AgentModel` needs to change.

### The portrait

A lit relief bust rendered in monospace glyphs — light strokes surfacing from the
dark, the literal meaning of *aletheia*. Fully deterministic: the same agent
always renders the same face.

| Agent property | Visual variable |
| --- | --- |
| reach (what it touches, across the whole tree) | presence + width of its aura |
| autonomy (acts unprompted) | weight + grounded shoulders |
| range (breadth of capability, incl. subagents) | surface complexity |
| domain (personality motif) | accent glyph + texture + highlight color |
| a hash of its definition | the seed (same agent, same face) |

## What's deliberately out

Aletheia inspects agents; it does not operate them. Running, editing, building,
deploying, and live trace-viewing were removed on purpose — that's the job of
the eve CLI and the Vercel dev environment, and dragging them in only added
runtime dependencies (sandboxes, Node versions, credentials) that have nothing to
do with *understanding* an agent. The full-IDE version lives on the
`archive/full-ide` branch.

Also out, on principle: **approval/read-write as a verified fact** (eve doesn't
expose it), and anything Aletheia would have to guess at.

---

Built by [Daniel Albinsson](mailto:daniel.albinsson@forefront.se) as a study in
**agent legibility** — designing how humans understand and trust the agents they
delegate to.
