# Gallery

Live portraits (fetchable JSON) are on **[agentic-kit.dev/gallery](https://agentic-kit.dev/gallery)**. The Aletheia SPA `/gallery` is screenshots, not live renders.

Generate one yourself:

```bash
eve build
aletheia portrait --format text     # or --format json
```

Most facts are *verified from build*; "asks first" is source-declared because eve does not serialize approval into the manifest.

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
