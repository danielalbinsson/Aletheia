# Set up Ledger

## 1. Install and inspect

```bash
pnpm install
# Recommended: inspect with Aletheia before enabling bank/QuickBooks tokens
pnpm info
```

## 2. Model credentials

`agent/agent.ts` and the auditor subagent use AI Gateway model ids. Configure
Gateway credentials for your eve host (Vercel OIDC or `AI_GATEWAY_API_KEY`).

## 3. Connection tokens

Copy `.env.example` → `.env.local`:

| Variable | Used by |
| --- | --- |
| `BANK_API_KEY` | `agent/connections/bank.ts` |
| `QUICKBOOKS_TOKEN` | `agent/connections/quickbooks.ts` |
| `SLACK_BOT_TOKEN` | `agent/connections/slack.ts` |

OpenAPI `spec` / `baseUrl` values point at example hosts — replace with your
real bank and QuickBooks endpoints before production.

## 4. Run

```bash
pnpm dev
```

Try: “Pull last night's transactions and reconcile them.” Schedules are
root-only; trigger via eve's schedule dispatch in dev when iterating.

## 5. Verify

```bash
pnpm eval
```

After install: [Eve Directory — after you install](https://www.evedirectory.com/docs/after-you-install).
