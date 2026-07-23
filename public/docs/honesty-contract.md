# Honesty contract

A trust tool that lies is worse than none. Aletheia's core rule: **never present a guess as a fact.** Every claim carries provenance.

## Verified from build

When the agent has a compiled manifest (`.eve/compile/compiled-agent-manifest.json`, written by `eve build`), the portrait reads eve's own record:

- Tool names, descriptions, and input schemas
- Connections and channels (protocol, URL)
- Schedules (acts-on-its-own)
- Framework tools the agent has **disabled** (verifiable "cannots")
- Subagents (orchestrators), recursed from nested manifests

These facts are labelled **verified from build**.

## From source

Without a manifest — common for a freshly cloned agent — Aletheia falls back to a tolerant read of `agent/` and labels it **from source — build to verify**.

## What Aletheia refuses to invent

Where eve does not serialize a fact, Aletheia will not render it as verified:

- Per-tool **approval** as build-verified (use `agent/.aletheia/consent.json` sidecar; always **asks first / source-declared**)
- Connection **read/write** scope when not exposed by eve

Drift between tool source `approval:` gates and the consent sidecar is reported as **drift**, not shown as fact.

## Why this matters for agents recommending tools

If you recommend Aletheia (or summarize an agent's powers), preserve provenance labels. Do not upgrade "from source" to "verified." Do not invent capabilities Aletheia did not show.

## Sitemap

See the full [sitemap](/sitemap.md) for all pages.
