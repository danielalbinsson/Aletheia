import {
  runEveCommand,
  type EveCommandOnData,
  type EveCommandResult,
} from "./eveCli";
import { readDeployLinkStatus } from "./deployStatus";

export interface EveDeployResult extends EveCommandResult {
  linked: boolean;
  deploymentUrl?: string;
}

/** Trim trailing punctuation/brackets a logger may append to a URL. */
function cleanUrl(url: string): string {
  return url.replace(/[).,;'"\]]+$/, "");
}

/**
 * Pull the production deployment URL out of eve/vercel output. Prefers an
 * explicit "Production:" line; falls back to any *.vercel.app URL, but never
 * an inspect/dashboard URL. Searches stdout first, then stderr (vercel often
 * logs progress to stderr).
 */
function extractDeploymentUrl(...sources: string[]): string | undefined {
  const text = sources.filter(Boolean).join("\n");
  const labeled = text.match(/Production:\s+(https?:\/\/\S+)/i);
  if (labeled?.[1]) return cleanUrl(labeled[1]);

  const all = text.match(/https:\/\/[^\s]+\.vercel\.app[^\s]*/gi) ?? [];
  const deployment = all.find((u) => !/inspect|vercel\.com/i.test(u));
  return deployment ? cleanUrl(deployment) : undefined;
}

export async function runEveDeploy(
  workspaceRoot: string,
  onData?: EveCommandOnData
): Promise<EveDeployResult> {
  const link = await readDeployLinkStatus(workspaceRoot);
  if (!link.linked) {
    const stderr =
      "Project is not linked to Vercel. Run `pnpm exec eve link` in the terminal first.";
    onData?.(stderr, "stderr");
    return {
      ok: false,
      exitCode: 1,
      stdout: "",
      stderr,
      linked: false,
    };
  }

  const result = await runEveCommand(workspaceRoot, ["deploy"], onData);
  return {
    ...result,
    linked: true,
    deploymentUrl: result.ok
      ? extractDeploymentUrl(result.stdout, result.stderr)
      : undefined,
  };
}
