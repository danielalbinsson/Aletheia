# Aletheia — see what an agent can do

*Aletheia (ἀλήθεια): truth as unconcealment — bringing what is hidden into the open.*

[![Agent skill](https://img.shields.io/badge/skill-aletheia--eve--trust-111)](./skills/aletheia-eve-trust/SKILL.md)
[![llms.txt](https://img.shields.io/badge/llms.txt-ready-111)](./public/llms.txt)
[![AGENTS.md](https://img.shields.io/badge/AGENTS.md-ready-111)](./AGENTS.md)

You cloned an eve (Vercel) agent you didn't write. Before you run it, you'd like to know:
what can it touch? What does it do on its own? What does it ask permission for?
What is it *forbidden* from doing? Today the only way to answer that is to read
the source.

**Aletheia reads it for you.** Point it at any [eve](https://eve.dev) agent and it
renders a **self-portrait** — a first-person page where the agent lays out its
capabilities, its reach into the outside world, the things it does unprompted,
and the powers it has given up — plus an **authority diff** that shows how that
authority has changed over time. It never runs the agent, never edits it, never
deploys it. It only makes it legible.

Product shell + Kit Certified gallery: **[agentic-kit.dev](https://agentic-kit.dev)**
(golden path, CI docs, paid [Capability Review](https://agentic-kit.dev/review)).

**Stamped example:** [Design QA Agent](https://github.com/danielalbinsson/design-qa-agent)
— multi-agent design QA. Portrait and passport on the kit gallery; lifecycle
rationale in [Agentic UX](https://agentic-ux.com); copyable siblings in
[eve-blueprints](https://github.com/danielalbinsson/eve-blueprints).

**For AI agents:** start at [`public/llms.txt`](./public/llms.txt) or
[`AGENTS.md`](./AGENTS.md). Install the skill:

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
```

## Quickstart — for eve builders

Default path: run the CLI **in your eve agent directory**. Aletheia runs on your
machine and reads agents off disk (a browser alone can't — see
[Why it runs locally](#why-it-runs-locally)).

```bash
npx @danielalbinsson/aletheia-cli portrait
npx @danielalbinsson/aletheia-cli diff --baseline git:main
npx @danielalbinsson/aletheia-cli snapshot   # after intentional expansion; commit the file
```

Exit `0` = ok, `1` = authority expanded, `2` = error. After an intentional
expansion: GitHub label `capability-change-ack`, then `snapshot` and commit
`agent/.aletheia/deployed-capabilities.json` on the same PR.

### Visual inspector

Clone this repo for the Browse-folder UI:

```bash
git clone https://github.com/danielalbinsson/Aletheia.git
cd Aletheia
pnpm install
pnpm dev            # → http://localhost:5173
```

Then in the app, click **Browse folder…** and pick a directory (e.g.
`~/Documents`, or wherever your eve projects live). Aletheia scans it for eve
agents — any folder containing `agent/agent.ts` — and lists them in the **Agent**
dropdown. Pick one; its portrait and authority diff render for that agent.
That's the whole loop.

Prefer a fixed target? Set `ALETHEIA_WORKSPACE` in `.env.local`:

```bash
ALETHEIA_WORKSPACE=/path/to/your/eve-agent
```

**Requirements:** Node 24+ and pnpm. Node 24 is eve's minimum — it's only needed
to *build* an agent (`eve build`) so its facts read *verified from build*; until
then Aletheia shows the honest *from source* view. Browsing in the web UI is
read-only: it never builds, runs, edits, or deploys your agent. The CLI
(`diff`, `portrait`, `passport`, `snapshot`) is the part that builds — see
[Authority diff in CI](#authority-diff-in-ci-aletheia-diff).

| Route | What it shows |
| ----- | ------------- |
| `/` | About — what Aletheia is and how to use it |
| `/portrait` | The agent's self-portrait |
| `/review` | Authority diff — how its authority changed |
| `/gallery` | Example agents read by Aletheia |
| `/manifesto` | The POV behind the project |
| `/privacy` | Privacy note |

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

## Authority diff: trust over time

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

## Authority diff in CI (`aletheia diff`)

The same review runs headless, so it can land on a **pull request** — automatic,
shareable, and blocking, the way a Vercel preview made deploys feel safe. It
builds the agent (in CI, where its toolchain lives), diffs the compiled manifest
against a committed baseline, and posts a single sticky comment carrying the
diff and the agent's portrait.

```bash
# published package
npx @danielalbinsson/aletheia-cli diff --baseline git:main
# exit 0 = ok, 1 = authority expanded, 2 = error

# from this repo (dev)
pnpm build:cli
./bin/aletheia.mjs diff --baseline git:main
```

The shipped GitHub Action (`.github/workflows/capability-review.yml`) fails a
required check when authority expands. Acknowledge an intended change with the
`capability-change-ack` label, then run `aletheia snapshot` and commit
`agent/.aletheia/deployed-capabilities.json` on the same PR.

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
  └─ pages/                  the portrait + the authority diff
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

## Deploy the showcase

The manifesto, gallery, and a demo portrait are fully static, so the showcase can
be hosted:

```bash
pnpm build          # → dist/ (includes public/ agent-readability files)
```

A `vercel.json` is included (SPA rewrites so `/portrait`, `/manifesto`, `/gallery`,
`/review`, and `/privacy` resolve on refresh, while `/llms.txt`, `/AGENTS.md`,
`/sitemap.md`, and `/docs/*.md` stay as plain text). Deploy with the Vercel CLI or
by connecting the repo. The hosted portrait shows the bundled
[design-qa-agent](https://github.com/danielalbinsson/design-qa-agent) *from source*
— verified facts and the live "point at any agent" inspection only run locally
(next).

After deploy, verify agent surfaces:

```bash
curl -I https://YOUR_DOMAIN/llms.txt
curl -I https://YOUR_DOMAIN/AGENTS.md
```

**GitHub topics to set** (helps registry and agent search): `eve`, `vercel-eve`,
`ai-agent`, `agent-skills`, `agent-legibility`, `capability-review`, `aletheia`.

## Why it runs locally

The interactive inspector isn't hosted, by design. Running `pnpm dev` starts a
small Node server on your machine that does the filesystem work — reading
`agent/`, the compiled manifest, and opening the folder picker — and the page is
its UI. A deployed website is only the browser half, and browsers deliberately
sandbox away raw filesystem access (any site could otherwise read your disk). So
"point Aletheia at a local folder" needs a program running on your machine —
which is exactly what the local dev server is. The hosted site is the showcase;
the tool runs where your agents live.

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

Built by [Daniel Albinsson](https://danielalbinsson.com). Author of the
[Agentic UX](https://agentic-ux.com) framework and [Agentic Kit](https://agentic-kit.dev)
(Inspect · Gate · Stamp for eve agents). [Hire / consult](https://agentic-ux.com/hire) ·
[Capability Review](https://agentic-kit.dev/review) ·
[daniel.Albinsson@pm.me](mailto:daniel.Albinsson@pm.me)
