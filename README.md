# Aletheia — see your agent

*Aletheia (ἀλήθεια): truth as unconcealment — bringing what is hidden into the open.*

Aletheia is an IDE for a single [eve](https://eve.dev) agent workspace. It reads
`agent/` and renders a **self-portrait**: a generated visual likeness plus a
first-person page where the agent presents who it is, what it can do, what it
can touch, and when it acts on its own.

Not a dashboard. Not a flowchart. A portrait.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:5173 — portrait + editor API
pnpm build      # static bundle in dist/ (read-only)
pnpm test       # serializer round-trip tests
```

## Workspace layout

One deployable eve project per workspace:

```
Aletheia/
├── agent/              # the eve agent (canonical layout)
│   ├── agent.ts
│   ├── instructions.md
│   ├── tools/
│   ├── skills/
│   ├── channels/
│   ├── schedules/
│   └── subagents/
├── examples/           # reference agents (not loaded by the app)
│   ├── beacon/
│   └── ledger/
└── src/                # Aletheia IDE UI
```

The workspace is an eve project. Requires **Node.js 24+** for `eve build`.

```bash
pnpm build:agent   # compile agent/ → .eve/ + .output/ (requires Node 24)
```

In the editor (`/edit`), use **eve build** after saving to validate the agent against
the real eve compiler. Diagnostics appear inline; details also land in
`.eve/discovery/diagnostics.json`.

Deploy (Node 24):

```bash
pnpm build:agent
pnpm exec eve link    # once — interactive Vercel link
pnpm exec eve deploy  # or use Run & deploy in the UI
```

See [eve deployment docs](https://eve.dev/docs/guides/deployment).

## Run & deploy (dev only)

At `/run`, Aletheia can:

- **Start local agent** — runs `eve build` then `eve start`, proxies `/eve` through Vite
- **Test chat** — send messages to the local eve HTTP API
- **Deploy** — runs `eve deploy` when the project is linked to Vercel

Link once from the terminal (`pnpm exec eve link`); deploy can then run from the UI.

## Editing (dev only)

With `pnpm dev`, Aletheia exposes a local API that reads and writes `agent/` on
disk. **The files are the truth** — the portrait always reflects what's on disk.

| Route | What it does |
| ----- | ------------ |
| `/` | Agent self-portrait |
| `/init` | Scaffold a new `agent/` project |
| `/edit` | Full editor with live preview |
| `/run` | Local `eve dev`, test chat, and deploy |
| `/observe` | Session traces, discovery diagnostics, Vercel Agent Runs link |

**API routes** (dev server only):

| Method | Route | Behavior |
| ------ | ----- | -------- |
| GET | `/api/project` | Return `{ id, files }` for `agent/` |
| PUT | `/api/project` | Replace all files in `agent/` |
| POST | `/api/project/init` | Create `agent/` from scaffold (if empty) |
| POST | `/api/project/build` | Run `eve build` and return diagnostics |
| GET | `/api/project/dev/status` | Local dev server health |
| POST | `/api/project/dev/start` | Build and start local agent (`eve start`) |
| POST | `/api/project/dev/stop` | Stop local dev server |
| GET | `/api/project/deploy/status` | Vercel link status from `.vercel/project.json` |
| POST | `/api/project/deploy` | Run `eve deploy` |
| GET | `/api/project/observability/snapshot` | Diagnostics, `eve info --json`, Vercel links |

## Observability

At `/observe`:

- **Session traces** — NDJSON event timeline from test chat (tool calls, turns, failures). Replay any session id against a running local agent.
- **Discovery** — diagnostics from `.eve/discovery/` and a summary from `eve info --json`.
- **Production** — link to the Vercel dashboard for **Agent Runs** (team feature; browse sessions after deploy).

Test chat on `/run` automatically tracks sessions for the trace viewer.

### Model credentials (required for chat)

The agent uses **OpenRouter** via `@openrouter/ai-sdk-provider`. Set your key in `.env.local`:

```bash
cp .env.example .env.local
# OPENROUTER_API_KEY=… from https://openrouter.ai/keys
```

Change the model id in the editor (Identity → Model) or in `agent/agent.ts` (`MODEL_ID`).
Browse models at [openrouter.ai/models](https://openrouter.ai/models).

Restart the local agent after adding credentials.

If chat fails with **guardrail / data policy** errors, your OpenRouter account is blocking the model. Either:

1. Open [openrouter.ai/settings/privacy](https://openrouter.ai/settings/privacy) and allow the providers/models you need (disable strict Zero Data Retention if you are testing), or
2. Switch `MODEL_ID` to a model that matches your policy — e.g. `anthropic/claude-sonnet-4` or `google/gemini-2.5-flash`.

## How it works

```
agent/                  the eve agent directory (the input)
  ├─ agent.ts           name, model, what files it wires together
  ├─ instructions.md    its intent, in its own voice → the first-person intro
  ├─ tools/*.ts         what it can do  +  what it can touch (reach: {...})
  ├─ skills/*/SKILL.md   more of what it can do
  ├─ channels/*.ts      what it can touch
  ├─ subagents/*.ts     who it delegates to
  └─ schedules/*.ts     when it acts on its own (consent: acts-on-its-own | asks-first)

src/
  ├─ model.ts            the structured AgentModel everything renders from
  ├─ parser/
  │   ├─ loadProject.ts  reads agent/ at build time (import.meta.glob)
  │   └─ eveAdapter.ts   ★ THE SWAP POINT — the only code that knows the eve format
  ├─ serializer/
  │   └─ eveSerializer.ts  inverse adapter — creates/updates eve files from edits
  ├─ server/
  │   └─ projectApiPlugin.ts  Vite dev middleware — writes agent/ on disk
  ├─ store/
  │   └─ ProjectStore.tsx  runtime project state + draft editing
  ├─ portrait/
  │   ├─ signals.ts      meaning → visual variables (the core mapping)
  │   └─ portrait.ts     the lit-relief ASCII portrait generator
  └─ components/         the Self-Portrait page + editor
```

### The portrait

A lit relief bust rendered in monospace glyphs. On the near-black page the light
strokes surface from the dark — the literal meaning of *aletheia*. It is fully
deterministic: the same agent always renders the same face.

The meaning → visual mapping (`src/portrait/signals.ts`):

| Agent property        | Visual variable            |
| --------------------- | -------------------------- |
| reach (what it touches) | presence + width of its aura |
| autonomy (acts unprompted) | weight + grounded shoulders |
| range (breadth of capability) | surface complexity |
| domain (personality motif) | accent glyph + texture + highlight color |
| a hash of its definition | the seed (same agent, same face) |

## Plugging in a real eve agent

Replace or edit files under `agent/`. If the on-disk format differs from the
default, adjust the extractors in **`src/parser/eveAdapter.ts`** — that file is
the single point of contact with the eve format. Nothing downstream of the
`AgentModel` needs to change.

## What's deliberately out

Embedded Vercel Agent Runs UI (use the Vercel dashboard), and `eve link` from the UI (interactive only — use the terminal). Production `pnpm build` bundles `agent/` at compile time — no filesystem writes or runtime controls.
