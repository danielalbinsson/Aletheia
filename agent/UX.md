# design-qa-agent — UX lifecycle (Agentic UX)

Bundled orchestrator inside Aletheia. Sibling live repo:
https://github.com/danielalbinsson/design-qa-agent

## Before

- Portrait shows delegation to specialist subagents before any run.
- GitHub reach is visible as connection/MCP surface — inspect before credentials.
- No leaf tools on the root agent; authority is the graph of subagents.

## While

- Subagents (a11y-auditor, design-system-checker, heuristic-critic) run named specialist jobs.
- Orchestrator should narrate which specialist is active and why.

## After

- Capability baseline: `agent/.aletheia/deployed-capabilities.json` (includes bash/write_file cannots)
- Required check: root `.github/workflows/capability-review.yml` (design-qa matrix) + `capability-change-ack`
- Stakeholder share-out: [PASSPORT.md](./PASSPORT.md)
