import { spawn } from "node:child_process";
import path from "node:path";

export interface EveCommandResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function eveBinPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "node_modules/eve/bin/eve.js");
}

/** Called with each output chunk as it arrives, for live log streaming. */
export type EveCommandOnData = (
  chunk: string,
  stream: "stdout" | "stderr"
) => void;

export function runEveCommand(
  workspaceRoot: string,
  args: string[],
  onData?: EveCommandOnData
): Promise<EveCommandResult> {
  const eveBin = eveBinPath(workspaceRoot);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [eveBin, ...args], {
      cwd: workspaceRoot,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      onData?.(text, "stdout");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      onData?.(text, "stderr");
    });

    child.on("close", (code) => {
      const exitCode = code ?? 1;
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout,
        stderr,
      });
    });
  });
}
