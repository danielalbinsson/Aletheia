# Capability passport — Beacon

**Agent:** Beacon (support-style Eve blueprint)  
**Stamp:** Kit Certified reference (Agentic Kit)  
**Inspect with:** [Aletheia](https://github.com/danielalbinsson/Aletheia)

## What I can do

- Search help-center / internal docs
- Draft and send customer replies (**asks first**)
- Route hard or sensitive tickets to a human (**asks first**)
- Apply tone skill for warm, plain replies

## What I can touch

- Intercom
- Slack
- Zendesk

## What I do on my own

- Every 15 minutes: check open tickets and warn Slack about SLA risk

## What I cannot / will not do alone

- Run shell commands (`bash` disabled)
- Write files (`write_file` disabled)
- Send a customer reply without approval
- Escalate to a human without approval
- Reach payment systems (not in this blueprint)

## How to verify

```bash
cd examples/beacon
pnpm install && eve build
npx @danielalbinsson/aletheia-cli diff --baseline file:agent/.aletheia/deployed-capabilities.json
```

## Provenance note

Facts labelled **verified from build** require a compiled Eve manifest. Consent
reasons come from `agent/.aletheia/consent.json` (source-declared). This passport
is hand-authored to match the portrait until `aletheia passport` ships (Phase 2).
Not a security audit.
