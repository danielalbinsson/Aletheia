import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { defineAgent } from "eve";

// Reference agent — real eve shape. eve discovers tools, skills, connections,
// and schedules by directory convention; there is no `name` or `tools` list.
// Identity is the package / folder name. Copy this folder into `agent/` to run
// it.

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export default defineAgent({
  model: openrouter("anthropic/claude-sonnet-4"),
  modelContextWindowTokens: 200_000,
  build: {
    externalDependencies: ["@openrouter/ai-sdk-provider"],
  },
});
