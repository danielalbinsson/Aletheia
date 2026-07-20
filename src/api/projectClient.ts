// projectClient: browser-side calls to Aletheia's read-only inspection API.
// No edit/build/run/deploy — just read the agent, its verified facts, its
// capability review, and switch which agent is inspected.

import type { EveManifestResult } from "../server/eveObservability";
import type { RawProject } from "../parser/loadProject";
import type { CapabilityDiff, CapabilitySnapshot } from "../parser/capabilityDiff";

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

export async function fetchManifest(): Promise<EveManifestResult> {
  const res = await fetch("/api/project/manifest");
  return parseResponse<EveManifestResult>(res);
}

export interface CapabilityReviewResponse {
  ok: boolean;
  built: boolean;
  error?: string;
  hadBaseline?: boolean;
  diff?: CapabilityDiff;
  current?: CapabilitySnapshot;
}

/** Capability review: how the inspected agent's authority changed vs baseline. */
export async function fetchReview(): Promise<CapabilityReviewResponse> {
  const res = await fetch("/api/project/review");
  return parseResponse<CapabilityReviewResponse>(res);
}

export interface DiscoveredAgent {
  path: string;
  name: string;
  isDefault?: boolean;
}

export interface WorkspacesResponse {
  scanRoot?: string;
  activePath: string;
  defaultPath: string;
  agents: DiscoveredAgent[];
}

export async function fetchWorkspaces(): Promise<WorkspacesResponse> {
  const res = await fetch("/api/workspaces");
  return parseResponse<WorkspacesResponse>(res);
}

export async function scanWorkspaces(root: string): Promise<WorkspacesResponse> {
  const res = await fetch("/api/workspaces/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ root }),
  });
  return parseResponse<WorkspacesResponse>(res);
}

/** Open the OS folder picker (via the dev server) and scan the chosen folder. */
export async function pickWorkspaceFolder(): Promise<
  WorkspacesResponse | { canceled: true }
> {
  const res = await fetch("/api/workspaces/pick", { method: "POST" });
  return parseResponse<WorkspacesResponse | { canceled: true }>(res);
}

/** Switch which agent the portrait + capability review inspect. */
export async function setActiveWorkspace(path: string): Promise<{ activePath: string }> {
  const res = await fetch("/api/workspaces/active", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  return parseResponse<{ activePath: string }>(res);
}

export async function isProjectApiAvailable(): Promise<boolean> {
  // Only true when the dev-server API answers. On a static host the SPA rewrite
  // serves index.html for /api/project (HTTP 200 HTML), so we also require a
  // JSON content-type — otherwise the app would think the API exists and try to
  // parse HTML as project data.
  try {
    const res = await fetch("/api/project");
    const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
    return isJson && (res.ok || res.status === 404);
  } catch {
    return false;
  }
}

export type { EveManifestResult };
