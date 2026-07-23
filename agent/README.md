# design-qa-agent (bundled)

Orchestrator eve agent shipped inside Aletheia for the showcase portrait. It
holds no leaf tools of its own — it delegates to specialist subagents and reaches
GitHub over MCP.

**Inspect with Aletheia** (this repo):

```bash
pnpm install && pnpm dev
# Agent dropdown → the bundled agent (or ALETHEIA_WORKSPACE pointing here)
```

Sibling live repo: https://github.com/danielalbinsson/design-qa-agent

Trust skill for coding agents:

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
```
