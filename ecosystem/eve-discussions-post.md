# Discussion post — vercel/eve (draft)

**Title:** Aletheia — inspect what an eve agent can do before you run it

**Category:** Show and tell / General

---

## What

[Aletheia](https://github.com/danielalbinsson/Aletheia) is a local-first **trust /
legibility** tool for eve agents. Point it at any agent directory and it renders:

1. A **self-portrait** — first-person view of capabilities, reach, schedules, and
   restrictions
2. A **capability review** — authority diff over time (and `aletheia diff` for PRs)

It never runs, edits, or deploys the agent. Honesty contract: never present a
guess as a fact — every claim is **verified from build** or labelled **from source**.

## Why

Cloning someone else's eve agent today means reading the source to learn what it
can touch. Aletheia makes that legible in a minute — the same way a Vercel
preview made deploys feel safe, capability review makes authority expansion
explicit before merge.

## Try it

```bash
git clone https://github.com/danielalbinsson/Aletheia.git
cd Aletheia && pnpm install && pnpm dev
# Browse folder → pick examples/beacon or examples/ledger
```

Coding agents:

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
```

CI gate (after publish):

```bash
npx @aletheia/cli diff --baseline git:main
```

Agent index: https://raw.githubusercontent.com/danielalbinsson/Aletheia/main/public/llms.txt

## Blueprints

We're submitting **Beacon** (support) and **Ledger** (finance + auditor subagent)
to Eve Directory / Evex as inspectable blueprints — each README tells you to
run Aletheia before enabling real credentials.

Feedback welcome — especially on what eve should serialize next so approval /
read-write can become build-verified instead of source-declared.
