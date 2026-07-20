// eveObservability: read eve's compiled manifest into Aletheia's verified trust
// facts. Read-only and server-free — no running agent, no eve process. This is
// the authoritative source for verified capabilities (see manifestAdapter for
// why the compiled manifest, not `eve info` or the /eve/v1/info endpoint).

import fs from "node:fs/promises";
import path from "node:path";
import {
  mapManifest,
  manifestRestrictionWarning,
  type CompiledManifest,
  type ManifestFacts,
} from "../parser/manifestAdapter";

export interface EveManifestResult {
  ok: boolean;
  /** True when a compiled manifest was found and mapped. */
  built: boolean;
  facts?: ManifestFacts;
  /** Non-fatal integrity warnings from mapping (e.g. missing restriction field). */
  warnings?: string[];
  error?: string;
}

/**
 * Read eve's compiled manifest (written by `eve build`) and map it into the
 * AgentModel's verified trust facts. `built: false` means the agent hasn't been
 * built yet; callers fall back to the source-parsed model.
 */
export async function runEveManifest(workspaceRoot: string): Promise<EveManifestResult> {
  const manifestPath = path.join(
    workspaceRoot,
    ".eve/compile/compiled-agent-manifest.json"
  );
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath, "utf8")) as CompiledManifest;
    const warning = manifestRestrictionWarning(raw);
    return {
      ok: true,
      built: true,
      facts: mapManifest(raw),
      ...(warning ? { warnings: [warning] } : {}),
    };
  } catch {
    return {
      ok: false,
      built: false,
      error: "No compiled manifest found. Build the agent first.",
    };
  }
}
