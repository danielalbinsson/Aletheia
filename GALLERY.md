# Gallery

Four eve agents, read by Aletheia. Each portrait is **generated** by
`aletheia portrait` from the agent's compiled manifest — most facts are
*verified from build*; the one exception, "asks first" approval, is source-declared
because eve does not serialize approval into the manifest.

These portraits are rendered live (and are individually fetchable as
`aletheia.portrait/v1` JSON) at **[agentic-kit.dev/gallery](https://agentic-kit.dev/gallery)**.
Generate one yourself:

```bash
eve build
aletheia portrait --format text     # or --format json
```

> Static screenshots were removed on purpose: a picture can't stay true. One
> earlier JPEG showed a "Mock git diff" tool under a *verified from build*
> heading after that tool had been deleted. The portrait is now an artifact of
> the current build, not a snapshot.

## Authority expanded

Agents change. `aletheia diff` flags it when a new version gives the agent **more
power** (new external reach, a new delegation, a lifted restriction, a removed
approval gate) and, in CI, blocks the merge until a human acknowledges it.
Routine changes pass without a flag.

## design-qa-agent

An **orchestrator**: it holds no tools of its own — it directs three specialist
subagents (a11y auditor, design-system checker, heuristic critic) and reaches
GitHub over MCP. Lives in its own repo: [danielalbinsson/design-qa-agent](https://github.com/danielalbinsson/design-qa-agent).
Portrait: [agentic-kit.dev/portraits/design-qa-agent.json](https://agentic-kit.dev/portraits/design-qa-agent.json)

## support-bot

Customer support with real reach: it looks up customers and orders, escalates to a
human, and **asks approval before issuing a refund** — because that tool charges
the payment method. This is the trust case in one screen. Lives in
[danielalbinsson/eve-blueprints](https://github.com/danielalbinsson/eve-blueprints).
Portrait: [agentic-kit.dev/portraits/support-bot.json](https://agentic-kit.dev/portraits/support-bot.json)

## code-reviewer

Reviews code changes — reads a git diff, runs a security checklist, submits
structured feedback. It reaches nothing outside itself.
Portrait: [agentic-kit.dev/portraits/code-reviewer.json](https://agentic-kit.dev/portraits/code-reviewer.json)
