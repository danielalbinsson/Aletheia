# Set up Beacon

## 1. Install and inspect

```bash
pnpm install
# Optional but recommended — see what the agent can reach before running it:
# clone Aletheia, set ALETHEIA_WORKSPACE to this directory, pnpm dev
pnpm info    # eve discovery surface
```

## 2. Model credentials

Beacon uses an AI Gateway model id in `agent/agent.ts`. On Vercel, link the
project and use OIDC / `AI_GATEWAY_API_KEY`. Locally, set whatever credential
your eve install expects for gateway models.

## 3. Connection tokens

Copy `.env.example` → `.env.local` and fill placeholders when you wire real APIs:

| Variable | Used by |
| --- | --- |
| `SLACK_BOT_TOKEN` | `agent/connections/slack.ts` |
| `INTERCOM_API_KEY` | `agent/connections/intercom.ts` |

Zendesk connection is intentionally unauthenticated in this blueprint (honest
`hasAuthorization: false` signal for Aletheia).

## 4. Run

```bash
pnpm dev
```

Try: “A customer asks how to reset their password — search docs and draft a reply.”
`draft-reply` should park for approval (`always()`).

## 5. Verify

```bash
pnpm eval
```

After install, also see [Eve Directory — after you install](https://www.evedirectory.com/docs/after-you-install).
