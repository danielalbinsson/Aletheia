# Passport export

Stakeholder one-pager for what an agent can do / touch / do alone / cannot do.

## `aletheia passport`

```bash
npx @danielalbinsson/aletheia-cli passport --format markdown
# or --format json
```

Scores the agent against the Kit Certified checklist (compiles, consent mirrors
gates, policy present, diff green vs baseline, restrictions visible) and emits a
passport generated from the build. Pass `--no-build` to skip `eve build`.

In-repo example: `agent/PASSPORT.md` (bundled design-qa). The support-bot
blueprint lives at https://github.com/danielalbinsson/eve-blueprints.

Product docs: https://agentic-kit.dev/docs/kit-certified
