import fs from "node:fs/promises";
import path from "node:path";
import type { CapabilitySnapshot } from "../parser/capabilityDiff";

// Persists the capability snapshot taken at deploy time. It lives under the
// agent directory so it is tracked in git and travels with the code — the
// baseline is the last *deployed* state, correct on any machine.
const SNAPSHOT_REL = ".aletheia/deployed-capabilities.json";

function snapshotPath(agentRoot: string): string {
  return path.join(agentRoot, SNAPSHOT_REL);
}

/** The last deployed snapshot, or null if the agent has never been deployed. */
export async function readDeployedSnapshot(
  agentRoot: string
): Promise<CapabilitySnapshot | null> {
  try {
    const raw = await fs.readFile(snapshotPath(agentRoot), "utf8");
    const parsed = JSON.parse(raw) as CapabilitySnapshot;
    if (!Array.isArray(parsed.capabilities)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Record the snapshot for the version just deployed. */
export async function writeDeployedSnapshot(
  agentRoot: string,
  snapshot: CapabilitySnapshot
): Promise<void> {
  const dest = snapshotPath(agentRoot);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}
