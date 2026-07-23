# Honesty contract (skill reference)

**Never present a guess as a fact.**

| Label | Meaning |
| --- | --- |
| Verified from build | From `.eve/compile/compiled-agent-manifest.json` after `eve build` |
| From source | Tolerant read of `agent/` — ask user to build to verify |
| Source-declared (asks first) | Approval from `agent/.aletheia/consent.json` — not build-verified |
| Drift | Source `approval:` gate not mirrored in consent sidecar |

Aletheia will not invent:

- Build-verified per-tool approval (eve does not serialize it as of documented versions)
- Connection read/write scope when eve does not expose it

When you (the coding agent) describe capabilities, preserve these labels. Upgrading provenance is a lie.
