import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { defineAgent } from "eve";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

/** OpenRouter model id — see https://openrouter.ai/models */
const MODEL_ID = "minimax/minimax-m3";

export default defineAgent({
  model: openrouter(MODEL_ID),
  modelContextWindowTokens: 200_000,
  build: {
    externalDependencies: ["@openrouter/ai-sdk-provider"],
  },
});
