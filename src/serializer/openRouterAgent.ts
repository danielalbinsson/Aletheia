/** OpenRouter model id shown in the editor (e.g. anthropic/claude-sonnet-4). */
export const DEFAULT_OPENROUTER_MODEL_ID = "anthropic/claude-sonnet-4";

/** Context window for compaction when using a direct provider. */
export const DEFAULT_MODEL_CONTEXT_WINDOW = 200_000;

export function extractOpenRouterModelId(agentTs: string): string {
  const fromConst = agentTs.match(/MODEL_ID\s*=\s*["'`]([^"'`]+)["'`]/);
  if (fromConst?.[1]) return fromConst[1];

  const fromCall = agentTs.match(/openrouter\(\s*MODEL_ID\s*\)|openrouter\(\s*["'`]([^"'`]+)["'`]/);
  if (fromCall?.[1]) return fromCall[1];

  const legacy = agentTs.match(/model\s*:\s*["'`]([^"'`]+)["'`]/);
  if (legacy?.[1] && !legacy[1].includes("(")) return legacy[1];

  return DEFAULT_OPENROUTER_MODEL_ID;
}

export function buildOpenRouterAgentTs(modelId: string): string {
  return `import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { defineAgent } from "eve";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

/** OpenRouter model id — see https://openrouter.ai/models */
const MODEL_ID = "${modelId.replace(/"/g, '\\"')}";

export default defineAgent({
  model: openrouter(MODEL_ID),
  modelContextWindowTokens: ${DEFAULT_MODEL_CONTEXT_WINDOW},
  build: {
    externalDependencies: ["@openrouter/ai-sdk-provider"],
  },
});
`;
}

export function setOpenRouterModelId(agentTs: string, modelId: string): string {
  if (agentTs.includes("createOpenRouter")) {
    return agentTs.replace(
      /MODEL_ID\s*=\s*["'`][^"'`]*["'`]/,
      `MODEL_ID = "${modelId.replace(/"/g, '\\"')}"`
    );
  }
  return buildOpenRouterAgentTs(modelId);
}
