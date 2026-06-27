import type { ChildProcess } from "node:child_process";
import { spawn, execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { eveBinPath } from "./eveCli";
import { runEveBuild } from "./eveBuild";

const execFileAsync = promisify(execFile);

export const EVE_DEV_PORT = 3199;

export type EveDevPhase = "stopped" | "starting" | "ready" | "failed";

export interface EveDevStatus {
  phase: EveDevPhase;
  /** @deprecated use phase */
  running: boolean;
  /** @deprecated use phase */
  ready: boolean;
  url: string | null;
  port: number;
  pid: number | null;
  error?: string;
  logTail?: string;
}

let devProcess: ChildProcess | null = null;
let devLog = "";
let spawnStartedAt = 0;
let lastFailureReason: string | undefined;

const FAILURE_PATTERNS = [
  /Dev worker failed/i,
  /worker init failed/i,
  /EADDRINUSE/i,
  /ERROR/i,
  /exited with code/i,
];

function appendLog(chunk: string) {
  devLog = `${devLog}${chunk}`.slice(-8000);
  for (const pattern of FAILURE_PATTERNS) {
    if (pattern.test(chunk)) {
      const line = chunk.split("\n").find((l) => pattern.test(l))?.trim();
      if (line) lastFailureReason = line;
    }
  }
}

async function isEveHealthy(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/eve/v1/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function localDevUrl(): string {
  return `http://127.0.0.1:${EVE_DEV_PORT}`;
}

async function killProcessOnPort(port: number): Promise<void> {
  try {
    const { stdout } = await execFileAsync("lsof", ["-ti", `:${port}`], {
      encoding: "utf8",
    });
    const pids = stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n) && n !== process.pid);

    await Promise.all(
      pids.map(
        (pid) =>
          new Promise<void>((resolve) => {
            try {
              process.kill(pid, "SIGTERM");
            } catch {
              // already gone
            }
            setTimeout(resolve, 500);
          })
      )
    );
  } catch {
    // port already free or lsof unavailable
  }
}

function buildStatus(healthy: boolean, url: string | null): EveDevStatus {
  const processAlive = devProcess !== null && !devProcess.killed;
  let phase: EveDevPhase = "stopped";

  if (healthy) {
    phase = "ready";
  } else if (lastFailureReason) {
    phase = "failed";
  } else if (processAlive) {
    phase = "starting";
  }

  const logTail = devLog.trim().split("\n").slice(-12).join("\n") || undefined;

  return {
    phase,
    running: phase === "starting" || phase === "ready",
    ready: phase === "ready",
    url: healthy ? url : null,
    port: EVE_DEV_PORT,
    pid: devProcess?.pid ?? null,
    error: phase === "failed" ? lastFailureReason : undefined,
    logTail,
  };
}

async function waitForReady(timeoutMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const url = localDevUrl();

  while (Date.now() < deadline) {
    if (lastFailureReason) return false;

    if (await isEveHealthy(url)) {
      return true;
    }

    if (
      spawnStartedAt > 0 &&
      Date.now() - spawnStartedAt > 45_000 &&
      devLog.includes("failed")
    ) {
      return false;
    }

    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function spawnEve(
  workspaceRoot: string,
  args: string[]
): ChildProcess {
  const eveBin = eveBinPath(workspaceRoot);
  const child = spawn(process.execPath, [eveBin, ...args], {
    cwd: workspaceRoot,
    env: process.env,
    detached: false,
  });

  child.stdout?.on("data", (chunk: Buffer) => appendLog(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => appendLog(chunk.toString()));

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      lastFailureReason =
        lastFailureReason ?? `eve process exited with code ${code}`;
    }
    if (devProcess?.pid === child.pid) {
      devProcess = null;
    }
  });

  return child;
}

export async function getEveDevStatus(_workspaceRoot: string): Promise<EveDevStatus> {
  const url = localDevUrl();
  const healthy = await isEveHealthy(url);
  if (healthy) {
    lastFailureReason = undefined;
  }
  return buildStatus(healthy, url);
}

export async function startEveDev(
  workspaceRoot: string
): Promise<{ ok: boolean; status: EveDevStatus; error?: string }> {
  const current = await getEveDevStatus(workspaceRoot);
  if (current.ready) {
    return { ok: true, status: current };
  }

  if (devProcess && !devProcess.killed) {
    const ready = await waitForReady(30_000);
    const status = await getEveDevStatus(workspaceRoot);
    return ready
      ? { ok: true, status }
      : {
          ok: false,
          status,
          error:
            status.error ??
            "Local agent is starting but not ready yet. See log below.",
        };
  }

  const url = localDevUrl();
  if (!(await isEveHealthy(url))) {
    await killProcessOnPort(EVE_DEV_PORT);
    await fs.rm(path.join(workspaceRoot, ".eve/dev-server-state.v1.json"), {
      force: true,
    });
  }

  devLog = "";
  lastFailureReason = undefined;
  spawnStartedAt = Date.now();

  appendLog("[aletheia] building agent…\n");
  const build = await runEveBuild(workspaceRoot);
  if (!build.ok) {
    const buildErr =
      build.diagnostics
        .filter((d) => d.severity === "error")
        .map((d) => `${d.sourcePath ?? "project"}: ${d.message}`)
        .join("; ") || "eve build failed";
    lastFailureReason = buildErr;
    appendLog(`${build.stderr}\n${build.stdout}\n`);
    const status = await getEveDevStatus(workspaceRoot);
    return {
      ok: false,
      status: { ...status, phase: "failed", error: buildErr },
      error: buildErr,
    };
  }

  appendLog("[aletheia] starting built agent (eve start)…\n");
  devProcess = spawnEve(workspaceRoot, [
    "start",
    "--host",
    "127.0.0.1",
    "--port",
    String(EVE_DEV_PORT),
  ]);

  const ready = await waitForReady();
  const status = await getEveDevStatus(workspaceRoot);

  if (!ready) {
    const error =
      status.error ??
      lastFailureReason ??
      "Timed out waiting for local agent. See log below or run `pnpm build:agent && pnpm exec eve start --host 127.0.0.1 --port 3199`.";
    return { ok: false, status: { ...status, phase: "failed", error }, error };
  }

  return { ok: true, status };
}

export async function stopEveDev(workspaceRoot: string): Promise<EveDevStatus> {
  if (devProcess && !devProcess.killed) {
    devProcess.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (!devProcess) return resolve();
      devProcess.once("exit", () => resolve());
      setTimeout(() => {
        if (devProcess && !devProcess.killed) {
          devProcess.kill("SIGKILL");
        }
        resolve();
      }, 3000);
    });
    devProcess = null;
  }

  await killProcessOnPort(EVE_DEV_PORT);

  await fs.rm(path.join(workspaceRoot, ".eve/dev-server-state.v1.json"), {
    force: true,
  });

  devLog = "";
  lastFailureReason = undefined;
  spawnStartedAt = 0;

  return getEveDevStatus(workspaceRoot);
}
