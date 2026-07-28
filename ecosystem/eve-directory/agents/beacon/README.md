# Beacon

Customer-support [eve](https://eve.dev) agent: search docs, draft replies (with
approval), route hard tickets, and watch SLA. Reaches Zendesk, Intercom, and
Slack (MCP).

**Inspect before you run.** This listing is an Aletheia blueprint — point
[Aletheia](https://github.com/danielalbinsson/Aletheia) at the installed `agent/`
(or use this folder as `ALETHEIA_WORKSPACE`) to see the self-portrait and
capability review before `eve dev` / deploy.

```bash
npx skills add danielalbinsson/Aletheia --skill aletheia-eve-trust
# or CLI capability gate:
npx @danielalbinsson/aletheia-cli diff --baseline git:main
```

## Layout

```text
beacon/
├── agent/
│   ├── agent.ts
│   ├── instructions.md
│   ├── tools/          draft-reply (approval), route-ticket, search-docs
│   ├── connections/    zendesk, intercom, slack
│   ├── schedules/      sla-watch
│   └── skills/tone/
├── evals/
└── SETUP.md
```

## Run

```bash
pnpm install   # or npm install
pnpm dev
```

See `SETUP.md` for env vars. Tool bodies are stubs — swap in real APIs.

## License

MIT · Daniel Albinsson
