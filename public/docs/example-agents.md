# Example eve agents (blueprints)

Aletheia ships inspectable [eve](https://eve.dev) agents you can point the tool at. Treat them as **blueprints to read before you run**, not as opaque demos.

## In this repository

| Agent | Path | Role |
| --- | --- | --- |
| design-qa (bundled) | `agent/` | Orchestrator: delegates to specialist subagents; reaches GitHub over MCP |
| Beacon | `examples/beacon/` | Support-style agent with connections, schedules, skills |
| Ledger | `examples/ledger/` | Finance-style agent with bank/QuickBooks reach, night reconcile, auditor subagent |

Copy an example into `agent/` (or set `ALETHEIA_WORKSPACE`) to inspect or run under eve.

## Gallery narratives

Human-readable gallery copy (with portrait screenshots): [GALLERY.md](https://raw.githubusercontent.com/danielalbinsson/Aletheia/main/GALLERY.md)

Also referenced: support-bot, code-reviewer, research-assistant — example shapes for capability storytelling.

## Related

- Live design-qa sibling repo: https://github.com/danielalbinsson/design-qa-agent
- Official eve templates: https://vercel.com/templates/eve
- eve project layout: https://eve.dev/docs/reference/project-layout

## How to inspect

```bash
pnpm install && pnpm dev
# Browse folder → pick examples/beacon or examples/ledger
```

Or:

```bash
ALETHEIA_WORKSPACE=/absolute/path/to/Aletheia/examples/beacon pnpm dev
```

Prefer **verified from build** after `eve build` in that example directory when you need decision-grade facts.

## Sitemap

See the full [sitemap](/sitemap.md) for all pages.
