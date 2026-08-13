import fs from "node:fs/promises";
import path from "node:path";
import { parseCapabilitySnapshot, type CapabilitySnapshot } from "../parser/capabilityDiff";

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
  const dest = snapshotPath(agentRoot);
  let raw: string;
  try {
    raw = await fs.readFile(dest, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${dest} is malformed JSON`);
  }
  return parseCapabilitySnapshot(parsed, dest);
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
