import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { defineAgent } from "eve";

// Reference agent — real eve shape. Tools, skills, connections, schedules, and
// subagents are discovered by directory convention; identity is the folder
// name, so there is no `name` or `tools` list. Copy into `agent/` to run.

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export default defineAgent({
  model: openrouter("anthropic/claude-opus-4"),
  modelContextWindowTokens: 200_000,
  build: {
    externalDependencies: ["@openrouter/ai-sdk-provider"],
  },
});
