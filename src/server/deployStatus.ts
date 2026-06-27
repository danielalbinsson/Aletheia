import fs from "node:fs/promises";
import path from "node:path";

export interface DeployLinkStatus {
  linked: boolean;
  projectId?: string;
  projectName?: string;
  orgId?: string;
}

export async function readDeployLinkStatus(
  workspaceRoot: string
): Promise<DeployLinkStatus> {
  const vercelPath = path.join(workspaceRoot, ".vercel/project.json");
  try {
    const raw = JSON.parse(await fs.readFile(vercelPath, "utf8")) as {
      projectId?: string;
      projectName?: string;
      orgId?: string;
    };
    if (!raw.projectId) {
      return { linked: false };
    }
    return {
      linked: true,
      projectId: raw.projectId,
      projectName: raw.projectName,
      orgId: raw.orgId,
    };
  } catch {
    return { linked: false };
  }
}
