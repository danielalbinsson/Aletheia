import fs from "node:fs/promises";
import path from "node:path";

export interface ModelCredentialStatus {
  configured: boolean;
  provider: "openrouter" | "gateway";
  source?: "env.local" | "env" | "process";
  hint: string;
}

const OPENROUTER_HINT =
  "Add `OPENROUTER_API_KEY` to `.env.local` (from https://openrouter.ai/keys), then restart the local agent.";

const GATEWAY_HINT =
  "Or use Vercel AI Gateway: run `pnpm exec eve link` or set `AI_GATEWAY_API_KEY` in `.env.local`.";

function fileHasOpenRouterKey(content: string): boolean {
  return /^\s*OPENROUTER_API_KEY\s*=\s*\S+/m.test(content);
}

function fileHasGatewayCredentials(content: string): boolean {
  return (
    /^\s*AI_GATEWAY_API_KEY\s*=\s*\S+/m.test(content) ||
    /^\s*VERCEL_OIDC_TOKEN\s*=\s*\S+/m.test(content)
  );
}

export async function readModelCredentialStatus(
  workspaceRoot: string
): Promise<ModelCredentialStatus> {
  for (const rel of [".env.local", ".env"] as const) {
    try {
      const content = await fs.readFile(path.join(workspaceRoot, rel), "utf8");
      if (fileHasOpenRouterKey(content)) {
        return {
          configured: true,
          provider: "openrouter",
          source: rel === ".env.local" ? "env.local" : "env",
          hint: "",
        };
      }
      if (fileHasGatewayCredentials(content)) {
        return {
          configured: true,
          provider: "gateway",
          source: rel === ".env.local" ? "env.local" : "env",
          hint: "",
        };
      }
    } catch {
      // file missing
    }
  }

  if (process.env.OPENROUTER_API_KEY?.trim()) {
    return { configured: true, provider: "openrouter", source: "process", hint: "" };
  }
  if (process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim()) {
    return { configured: true, provider: "gateway", source: "process", hint: "" };
  }

  return {
    configured: false,
    provider: "openrouter",
    hint: `${OPENROUTER_HINT} ${GATEWAY_HINT}`,
  };
}
