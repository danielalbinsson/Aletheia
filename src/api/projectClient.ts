import type { EveBuildResult } from "../server/eveBuild";
import type { EveDeployResult } from "../server/eveDeploy";
import type { DeployLinkStatus } from "../server/deployStatus";
import type { EveDevStatus } from "../server/eveDevServer";
import type { ModelCredentialStatus } from "../server/modelCredentials";
import type {
  EveInfoSnapshot,
  EveManifestResult,
  VercelObservabilityLinks,
} from "../server/eveObservability";
import type { EveDiagnostic } from "../server/eveBuild";
import type { RawProject } from "../parser/loadProject";

export interface ProjectErrorResponse {
  error: string;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & ProjectErrorResponse;
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body;
}

export async function fetchProject(): Promise<RawProject | null> {
  const res = await fetch("/api/project");
  if (res.status === 404) return null;
  return parseResponse<RawProject>(res);
}

export async function saveProject(project: RawProject): Promise<RawProject> {
  const res = await fetch("/api/project", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: project.files }),
  });
  return parseResponse<RawProject>(res);
}

export async function initProject(project: RawProject): Promise<RawProject> {
  const res = await fetch("/api/project/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: project.files }),
  });
  return parseResponse<RawProject>(res);
}

export async function fetchManifest(): Promise<EveManifestResult> {
  const res = await fetch("/api/project/manifest");
  return parseResponse<EveManifestResult>(res);
}

export async function buildProject(): Promise<EveBuildResult> {
  const res = await fetch("/api/project/build", { method: "POST" });
  const body = (await res.json()) as EveBuildResult & ProjectErrorResponse;
  if (!res.ok && !body.diagnostics) {
    throw new Error(body.error ?? `Build failed (${res.status})`);
  }
  return body;
}

export async function fetchDeployStatus(): Promise<DeployLinkStatus> {
  const res = await fetch("/api/project/deploy/status");
  return parseResponse<DeployLinkStatus>(res);
}

/**
 * Run `eve deploy`. The server streams NDJSON ({type:"log"} chunks then a
 * final {type:"result"}); `onLog` receives each chunk live. Falls back to a
 * plain JSON error body if the request fails before streaming starts.
 */
export async function deployProject(
  onLog?: (chunk: string) => void
): Promise<EveDeployResult> {
  const res = await fetch("/api/project/deploy", { method: "POST" });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as ProjectErrorResponse;
    throw new Error(body.error ?? `Deploy failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: EveDeployResult | null = null;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let event: { type?: string; data?: string; result?: EveDeployResult };
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (event.type === "log" && typeof event.data === "string") {
      onLog?.(event.data);
    } else if (event.type === "result" && event.result) {
      result = event.result;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      handleLine(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  if (buffer.trim()) handleLine(buffer);

  if (!result) {
    throw new Error("Deploy stream ended without a result.");
  }
  return result;
}

export async function fetchDevStatus(): Promise<
  EveDevStatus & { credentials?: ModelCredentialStatus }
> {
  const res = await fetch("/api/project/dev/status");
  return parseResponse<EveDevStatus & { credentials?: ModelCredentialStatus }>(res);
}

export async function startDevServer(): Promise<{
  ok: boolean;
  status: EveDevStatus;
  credentials?: ModelCredentialStatus;
  error?: string;
}> {
  const res = await fetch("/api/project/dev/start", { method: "POST" });
  return (await res.json()) as {
    ok: boolean;
    status: EveDevStatus;
    credentials?: ModelCredentialStatus;
    error?: string;
  };
}

export async function stopDevServer(): Promise<EveDevStatus> {
  const res = await fetch("/api/project/dev/stop", { method: "POST" });
  const body = (await res.json()) as { status: EveDevStatus };
  return body.status;
}

export interface ObservabilitySnapshot {
  diagnostics: EveDiagnostic[];
  info: EveInfoSnapshot;
  manifest: unknown | null;
  vercel: VercelObservabilityLinks;
}

export async function fetchObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
  const res = await fetch("/api/project/observability/snapshot");
  return parseResponse<ObservabilitySnapshot>(res);
}

export async function isProjectApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/project");
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export type {
  EveBuildResult,
  EveDeployResult,
  DeployLinkStatus,
  EveDevStatus,
  EveDiagnostic,
  EveInfoSnapshot,
  EveManifestResult,
  VercelObservabilityLinks,
  ModelCredentialStatus,
};
