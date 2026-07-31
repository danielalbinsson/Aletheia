# Glossary — Aletheia / eve legibility

| Term | Meaning |
| --- | --- |
| **eve** | Filesystem-first framework for durable agents on Vercel (`agent/` directory convention). Docs: https://eve.dev |
| **Aletheia** | Local-first trust tool that inspects eve agents; does not run them |
| **Self-portrait** | First-person capability view rendered from an agent's definition |
| **Authority diff** | Diff of authority over time (reach, autonomy, restrictions, mind) |
| **Verified from build** | Fact taken from eve's compiled manifest after `eve build` |
| **From source** | Fact inferred by reading `agent/` without a compiled manifest |
| **Honesty contract** | Rule: never present a guess as a fact; always label provenance |
| **Consent sidecar** | `agent/.aletheia/consent.json` — source-declared approval gates |
| **Blast radius** | Severity ranking for new external reach (payments high, etc.) |
| **Authority expanded** | Diff outcome: the new version gives the agent more power |
| **Blueprint / example agent** | Inspectable eve agent under `examples/` or `agent/` — read before run |
| **`aletheia diff`** | Headless CLI gate for PRs / CI against a capability baseline |

## Sitemap

See the full [sitemap](/sitemap.md) for all pages.
