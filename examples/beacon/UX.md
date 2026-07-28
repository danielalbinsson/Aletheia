# Beacon — UX lifecycle (Agentic UX)

## Before

- State intent before sending a customer reply or routing to a human.
- Approval-gated tools (`draft-reply`, `route-ticket`) pause for confirmation.
- Portrait + consent sidecar make “asks first” visible before `eve dev`.

## While

- SLA watch schedule narrates open-ticket risk to Slack on a cron.
- Doc search runs without approval; replies and handoffs do not.
- Progress should surface as named steps (lookup → draft → send / route).

## After

- Capability baseline in `agent/.aletheia/deployed-capabilities.json` (includes bash/write_file cannots).
- In the Aletheia monorepo, the root capability-review workflow runs the Beacon matrix job; the copy under `.github/workflows/` is the standalone-repo template.
- PRs that add connections, schedules, or lift gates fail CI until `capability-change-ack`.
- Stakeholder share-out: [PASSPORT.md](./PASSPORT.md).
