import { defineAgent } from "eve";

export default defineAgent({
  name: "Ledger",
  model: "claude-opus-4",
  description:
    "A bookkeeping agent that reconciles transactions, flags anomalies, and closes the books each month.",
  instructions: "./instructions.md",
  tools: [
    "./tools/fetch-transactions.ts",
    "./tools/categorize.ts",
    "./tools/reconcile.ts",
    "./tools/post-entry.ts",
    "./tools/flag-anomaly.ts",
  ],
  skills: ["./skills/month-close", "./skills/anomaly-rules"],
  channels: ["./channels/bank.ts", "./channels/accounting.ts", "./channels/slack.ts"],
  subagents: ["./subagents/auditor.ts"],
  schedules: ["./schedules/nightly-reconcile.ts", "./schedules/month-close.ts"],
});
