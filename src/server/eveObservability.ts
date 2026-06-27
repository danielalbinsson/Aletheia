import fs from "node:fs/promises";
import path from "node:path";
import type { EveDiagnostic } from "./eveBuild";
import { runEveCommand } from "./eveCli";
import { mapAgentInfo, type AgentInfo, type AgentInfoFacts } from "../parser/eveInfoAdapter";

export interface EveInfoSnapshot {
  ok: boolean;
  raw?: unknown;
  stdout: string;
  stderr: string;
}

function parseDiagnosticsJson(raw: unknown): EveDiagnostic[] {
  if (!raw || typeof raw !== "object") return [];
  const entries = Array.isArray(raw)
    ? raw
    : "entries" in raw && Array.isArray((raw as { entries: unknown }).entries)
      ? (raw as { entries: unknown[] }).entries
      : "diagnostics" in raw && Array.isArray((raw as { diagnostics: unknown }).diagnostics)
        ? (raw as { diagnostics: unknown[] }).diagnostics
        : [];

  return entries
    .map((entry): EveDiagnostic | null => {
      if (!entry || typeof entry !== "object") return null;
      const e = entry as Record<string, unknown>;
      const severity = e.severity;
      if (severity !== "error" && severity !== "warning" && severity !== "info") {
        return null;
      }
      const message = typeof e.message === "string" ? e.message : String(e.message ?? "");
      return {
        severity,
        message,
        sourcePath:
          typeof e.sourcePath === "string"
            ? e.sourcePath
            : typeof e.path === "string"
              ? e.path
              : undefined,
        code: typeof e.code === "string" ? e.code : undefined,
      };
    })
    .filter((d): d is EveDiagnostic => d !== null);
}

export async function readEveDiagnostics(workspaceRoot: string): Promise<EveDiagnostic[]> {
  const diagPath = path.join(workspaceRoot, ".eve/discovery/diagnostics.json");
  try {
    const raw = JSON.parse(await fs.readFile(diagPath, "utf8")) as unknown;
    return parseDiagnosticsJson(raw);
  } catch {
    return [];
  }
}

export async function readDiscoveryManifest(workspaceRoot: string): Promise<unknown | null> {
  const manifestPath = path.join(workspaceRoot, ".eve/discovery/agent-discovery-manifest.json");
  try {
    return JSON.parse(await fs.readFile(manifestPath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export async function runEveInfo(workspaceRoot: string): Promise<EveInfoSnapshot> {
  const result = await runEveCommand(workspaceRoot, ["info", "--json"]);
  if (!result.ok) {
    return { ok: false, stdout: result.stdout, stderr: result.stderr };
  }

  try {
    const raw = JSON.parse(result.stdout) as unknown;
    return { ok: true, raw, stdout: result.stdout, stderr: result.stderr };
  } catch {
    return { ok: false, stdout: result.stdout, stderr: result.stderr || "Invalid JSON from eve info" };
  }
}

export interface EveManifestResult {
  ok: boolean;
  /** True when eve info resolved a built agent and facts were mapped. */
  built: boolean;
  facts?: AgentInfoFacts;
  error?: string;
}

/**
 * Run `eve info --json` and map it into the AgentModel's verified trust facts.
 * `built: false` means eve could not resolve the agent (usually: not built yet,
 * or wrong Node version) — callers should fall back to the source-parsed model.
 */
export async function runEveManifest(workspaceRoot: string): Promise<EveManifestResult> {
  const info = await runEveInfo(workspaceRoot);
  if (!info.ok || info.raw == null) {
    return {
      ok: false,
      built: false,
      error: info.stderr || "eve info did not return a manifest",
    };
  }
  return { ok: true, built: true, facts: mapAgentInfo(info.raw as AgentInfo) };
}

export interface VercelObservabilityLinks {
  linked: boolean;
  projectId?: string;
  projectName?: string;
  agentRunsHint: string;
  projectUrl?: string;
}

export function buildVercelObservabilityLinks(link: {
  linked: boolean;
  projectId?: string;
  projectName?: string;
  orgId?: string;
}): VercelObservabilityLinks {
  if (!link.linked) {
    return {
      linked: false,
      agentRunsHint: "Link the project with `pnpm exec eve link`, then deploy to Vercel.",
    };
  }

  const projectUrl = link.projectName
    ? `https://vercel.com/dashboard?project=${encodeURIComponent(link.projectName)}`
    : link.projectId
      ? `https://vercel.com/dashboard`
      : undefined;

  return {
    linked: true,
    projectId: link.projectId,
    projectName: link.projectName,
    projectUrl,
    agentRunsHint:
      "In the Vercel dashboard, open this project → Observability → Agent Runs to browse production sessions and traces.",
  };
}
