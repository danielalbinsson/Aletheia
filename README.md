# Aletheia — see your agent

*Aletheia (ἀλήθεια): truth as unconcealment — bringing what is hidden into the open.*

Aletheia reads an [eve](https://eve.dev) agent's directory and renders it as a
**self-portrait**: a generated visual likeness plus a first-person page where the
agent presents who it is, what it can do, what it can touch, and when it acts on
its own.

Not a dashboard. Not a flowchart. A portrait.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in dist/
```

`preview.html` in the repo root is a no-server static snapshot — open it in a
browser to see the three example agents without running anything.

## How it works

The whole thing is read-first. **The files are the truth**; Aletheia adds taste
on top, it never becomes a builder or an editor.

```
agents/<name>/        a real eve agent directory (the input)
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
  │   ├─ loadAgents.ts   reads /agents at build time (import.meta.glob)
  │   └─ eveAdapter.ts   ★ THE SWAP POINT — the only code that knows the eve format
  ├─ portrait/
  │   ├─ signals.ts      meaning → visual variables (the core mapping)
  │   └─ portrait.ts     the lit-relief ASCII portrait generator
  └─ components/         the Self-Portrait page
```

### The portrait

A lit relief bust rendered in monospace glyphs. On the near-black page the light
strokes surface from the dark — the literal meaning of *aletheia*. It is fully
deterministic: the same agent always renders the same face, and two agents with
different purposes look different.

The meaning → visual mapping (`src/portrait/signals.ts`):

| Agent property        | Visual variable            |
| --------------------- | -------------------------- |
| reach (what it touches) | presence + width of its aura |
| autonomy (acts unprompted) | weight + grounded shoulders |
| range (breadth of capability) | surface complexity |
| domain (personality motif) | accent glyph + texture + highlight color |
| a hash of its definition | the seed (same agent, same face) |

## Plugging in a real eve agent

Drop a real agent directory under `agents/`. If the on-disk format differs from
the examples here, adjust the extractors in **`src/parser/eveAdapter.ts`** — that
file is the single point of contact with the eve format. Nothing downstream of
the `AgentModel` needs to change.

## What's deliberately out (v1)

Editing from the UI, the full system canvas, richer/generative portraits, and
live run/trace data. v1 is the read-only, still-stunning version.
