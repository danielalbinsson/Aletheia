import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { defineAgent } from "eve";

// A local subagent is itself an agent package — a folder under `subagents/`
// with its own agent.ts, instructions, and tools, discovered recursively.
// Ledger delegates entry review to it.

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export default defineAgent({
  // A subagent must describe itself so the parent knows when to delegate.
  description:
    "Reviews posted journal entries and confirms each traces back to a source transaction.",
  model: openrouter("anthropic/claude-opus-4"),
  modelContextWindowTokens: 200_000,
  build: {
    externalDependencies: ["@openrouter/ai-sdk-provider"],
  },
});
