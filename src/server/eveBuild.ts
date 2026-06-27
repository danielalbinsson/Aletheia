import fs from "node:fs/promises";
import path from "node:path";
import { runEveCommand } from "./eveCli";

export interface EveDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  sourcePath?: string;
  code?: string;
}

export interface EveBuildResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  diagnostics: EveDiagnostic[];
  outputPath?: string;
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

async function readDiagnostics(workspaceRoot: string): Promise<EveDiagnostic[]> {
  const diagPath = path.join(workspaceRoot, ".eve/discovery/diagnostics.json");
  try {
    const raw = JSON.parse(await fs.readFile(diagPath, "utf8")) as unknown;
    return parseDiagnosticsJson(raw);
  } catch {
    return [];
  }
}

export async function runEveBuild(workspaceRoot: string): Promise<EveBuildResult> {
  const result = await runEveCommand(workspaceRoot, ["build"]);
  const diagnostics = await readDiagnostics(workspaceRoot);
  const outputMatch = result.stdout.match(/built output at (.+)$/m);

  return {
    ok: result.ok && !diagnostics.some((d) => d.severity === "error"),
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    diagnostics,
    outputPath: outputMatch?.[1]?.trim(),
  };
}
