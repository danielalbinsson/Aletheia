# Capability passport — design-qa (bundled)

**Agent:** design-qa orchestrator (verified build name: `aletheia` from package)  
**Stamp:** Kit Certified reference (Agentic Kit)  
**Repo:** bundled at `agent/` in [Aletheia](https://github.com/danielalbinsson/Aletheia)

## What I can do

- Orchestrate specialist subagents for design QA
- Reach GitHub (MCP) for review context

## Subagents

- A11y auditor
- Design system checker
- Heuristic critic

## What I do on my own

- No root-level acts-on-its-own schedule (verified from build)

## What I cannot

- Run shell commands (`bash` disabled)
- Write files (`write_file` disabled)
- Hold leaf tools on the root agent — work is delegated
- Invent approval semantics Aletheia cannot verify from the build

## How to verify

```bash
# from Aletheia repo root (Node 24+)
eve build
npx @danielalbinsson/aletheia-cli diff --baseline file:agent/.aletheia/deployed-capabilities.json
```

## Provenance note

Prefer **verified from build** facts. This passport is hand-authored to match the
portrait until `aletheia passport` ships (Phase 2). Not a security audit.
See https://agentic-kit.dev/docs/disclaimer
