# Aletheia — see your agent

*Aletheia (ἀλήθεια): truth as unconcealment — bringing what is hidden into the open.*

Aletheia is a workbench for a single [eve](https://eve.dev) agent that doubles as
a **legibility layer**. It reads `agent/` and renders a **self-portrait**: a
generated visual likeness plus a first-person page where the agent presents who
it is, what it can do, what it can touch, and when it acts on its own — and,
once built, it shows those facts **as eve itself compiled them**, not as anyone
annotated them.

Not a dashboard. Not a flowchart. A portrait you can trust.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:5173 — portrait + editor + runtime API
pnpm build      # static bundle in dist/ (read-only)
pnpm test       # adapter, diff, and serializer unit tests
```

Working with the agent itself requires **Node.js 24+** (eve's minimum):

```bash
pnpm build:agent   # eve build → .eve/ + .output/
```

## Verified from build — the core idea

Aletheia shows trust facts from two sources, and is always honest about which:

- **Verified** — after `eve build`, the portrait reads eve's own
  `.eve/compile/compiled-agent-manifest.json`. These facts are exactly what the
  runtime resolved: tool names, descriptions, and input schemas; the
  connections and channels the agent reaches (with protocol and URL); and the
  schedules by which it acts on its own. Sections are labelled *verified from
  build*.
- **From source** — before a build (or without the dev server), it falls back to
  a tolerant source parse of `agent/`, labelled *from source — build to verify*.

What Aletheia **does not** claim: eve 0.15.5 does not expose per-tool **approval**
or a connection's **read/write** in any build artifact, so Aletheia does not
render them. Showing a consent badge we can't actually verify would manufacture
exactly the false confidence this project exists to prevent. Reach is shown as
the real systems and protocols; autonomy is shown from real schedules. (If a
future eve version serializes approval, the model and portrait have a clear seam
to reintroduce it — see `docs/specs/capability-manifest.md`.)

## Workspace layout

One deployable eve project per workspace:

```
Aletheia/
├── agent/              # the eve agent (the input)
│   ├── agent.ts        # model + build config (identity is path-derived)
│   ├── instructions.md # its intent, in its own voice → the first-person intro
│   ├── tools/          # what it can do      (defineTool)
│   ├── skills/         # more of what it can do
│   ├── connections/    # what it can reach   (defineOpenAPIConnection / MCP)
│   ├── schedules/      # when it acts on its own (defineSchedule)
│   └── subagents/      # who it delegates to (nested agent packages)
├── examples/           # reference agents in real eve shape (not loaded by the app)
│   ├── beacon/         # a support agent — connections + an autonomous schedule
│   └── ledger/         # a bookkeeping agent — subagent, nightly + monthly close
└── src/                # Aletheia UI + dev server
```

`agent/` is a real eve project: tools are `defineTool` (zod input schemas),
schedules are `defineSchedule`, external systems are `connections/` (each needs
a `description`), and a subagent is a nested agent package under
`subagents/<name>/`. `defineAgent` takes no tool/channel lists — eve discovers
everything by directory.

## Routes (dev only)

With `pnpm dev`, Aletheia exposes a local API that reads and writes `agent/` on
disk. **The files are the truth** — the portrait always reflects what's on disk.

| Route | What it does |
| ----- | ------------ |
| `/` | Agent self-portrait (verified once built) |
| `/init` | Scaffold a new `agent/` project |
| `/edit` | Full editor with live preview and inline `eve build` diagnostics |
| `/run` | Start the local agent, test chat, **review capability changes, and deploy** |
| `/observe` | Session traces, discovery diagnostics, Vercel Agent Runs link |

## Run, review & deploy

At `/run`, Aletheia can:

- **Start local agent** — runs `eve build` then `eve start`, proxies `/eve` through Vite.
- **Test chat** — send messages to the local eve HTTP API (sessions are tracked for the trace viewer).
- **Review capability changes** — before deploying, see a plain-language diff of
  what's changing about what the agent can do, touch, and decide, compared to the
  last deployed version. Changes that raise risk (new external reach, a new
  autonomous schedule, a new delegation) are escalated and must be acknowledged
  before deploy proceeds. First deploy shows the initial capabilities.
- **Deploy** — runs `eve deploy` (output streams live) when the project is linked
  to Vercel, then records a snapshot of what shipped.

The deploy baseline lives at `agent/.aletheia/deployed-capabilities.json` —
**tracked in git**, so the diff is correct on any machine. Link once from the
terminal (`pnpm exec eve link`); deploy can then run from the UI.

```bash
pnpm build:agent
pnpm exec eve link    # once — interactive Vercel link
pnpm exec eve deploy  # or use /run
```

See [eve deployment docs](https://eve.dev/docs/guides/deployment).

**API routes** (dev server only):

| Method | Route | Behavior |
| ------ | ----- | -------- |
| GET | `/api/project` | Return `{ id, files }` for `agent/` |
| PUT | `/api/project` | Replace all files in `agent/` |
| POST | `/api/project/init` | Create `agent/` from scaffold (if empty) |
| POST | `/api/project/build` | Run `eve build`, return diagnostics |
| GET | `/api/project/manifest` | Verified trust facts from the compiled manifest |
| GET | `/api/project/dev/status` | Local dev server health + model credentials |
| POST | `/api/project/dev/start` | Build and start the local agent (`eve start`) |
| POST | `/api/project/dev/stop` | Stop the local dev server |
| GET | `/api/project/deploy/status` | Vercel link status from `.vercel/project.json` |
| GET | `/api/project/deploy/diff` | Capability diff vs the last deployed snapshot |
| POST | `/api/project/deploy` | Run `eve deploy` (streams NDJSON), record snapshot |
| GET | `/api/project/observability/snapshot` | Diagnostics, `eve info`, Vercel links |

## Model credentials (required for chat)

The agent uses **OpenRouter** via `@openrouter/ai-sdk-provider`. Set your key in `.env.local`:

```bash
cp .env.example .env.local
# OPENROUTER_API_KEY=… from https://openrouter.ai/keys
```

Change the model id in the editor (Identity → Model) or in `agent/agent.ts`
(`MODEL_ID`). Browse models at [openrouter.ai/models](https://openrouter.ai/models).
Restart the local agent after adding credentials.

If chat fails with **guardrail / data policy** errors, your OpenRouter account is
blocking the model. Either allow the providers at
[openrouter.ai/settings/privacy](https://openrouter.ai/settings/privacy), or
switch `MODEL_ID` to a model that matches your policy (e.g.
`anthropic/claude-sonnet-4`).

## How it works

```
agent/                       the eve agent directory (the input)
.eve/compile/                eve build output — the source of verified facts
  └─ compiled-agent-manifest.json

src/
  ├─ model.ts                the structured AgentModel everything renders from
  ├─ parser/
  │   ├─ loadProject.ts      reads agent/ at build time (import.meta.glob)
  │   ├─ eveAdapter.ts       source parse — the pre-build fallback
  │   ├─ manifestAdapter.ts  ★ maps eve's compiled manifest → verified facts
  │   └─ capabilityDiff.ts   snapshot + diff for the deploy review gate
  ├─ serializer/
  │   └─ eveSerializer.ts    inverse adapter — writes eve files from edits
  ├─ server/                 Vite dev middleware: build, run, deploy, manifest
  │   ├─ projectApiPlugin.ts
  │   ├─ capabilitySnapshot.ts   reads/writes the deployed-capabilities snapshot
  │   └─ eve{Build,DevServer,Deploy,Observability,Cli}.ts
  ├─ store/ProjectStore.tsx  runtime state; overlays verified facts on the model
  ├─ portrait/               meaning → visual variables, and the ASCII portrait
  └─ components/             the self-portrait page + editor + /run + /observe
```

The flow: `loadProject`/`eveAdapter` give a source-parsed `AgentModel`
(narrative + a best-effort guess). When a compiled manifest exists,
`manifestAdapter` maps it and the store **overlays** its verified trust facts —
keeping the narrative identity (intro, motif, theme) from `instructions.md`.

### The portrait

A lit relief bust rendered in monospace glyphs. On the near-black page the light
strokes surface from the dark — the literal meaning of *aletheia*. It is fully
deterministic: the same agent always renders the same face.

| Agent property | Visual variable |
| --- | --- |
| reach (what it touches) | presence + width of its aura |
| autonomy (acts unprompted) | weight + grounded shoulders |
| range (breadth of capability) | surface complexity |
| domain (personality motif) | accent glyph + texture + highlight color |
| a hash of its definition | the seed (same agent, same face) |

## Plugging in a real eve agent

Replace or edit files under `agent/`, then build. The verified facts come from
eve's compiled manifest via **`src/parser/manifestAdapter.ts`** — that's the
single point of contact with the eve manifest format. The source-parse fallback
lives in `src/parser/eveAdapter.ts`. Nothing downstream of the `AgentModel`
needs to change.

## What's deliberately out

- **Approval / consent rendering** — eve doesn't expose it in any build artifact,
  so Aletheia doesn't fake it.
- **Embedded Vercel Agent Runs UI** — use the Vercel dashboard.
- **`eve link` from the UI** — interactive only; use the terminal.
- Production `pnpm build` bundles `agent/` at compile time — no filesystem writes
  or runtime controls.
```
