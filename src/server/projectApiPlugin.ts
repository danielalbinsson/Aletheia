// projectApiPlugin: the dev-server API behind Aletheia's inspection UI. It is
// READ-ONLY by design — it reads an agent's source and compiled manifest and
// never runs, edits, builds, or deploys the agent. Endpoints:
//   GET  /api/workspaces            list default + discovered agents
//   POST /api/workspaces/pick       native folder picker → scan
//   POST /api/workspaces/scan       scan a folder for agents
//   POST /api/workspaces/active     switch which agent is inspected
//   GET  /api/project               the inspected agent's source files
//   GET  /api/project/manifest      verified facts from the compiled manifest
//   GET  /api/project/review        capability diff vs the last deployed snapshot

import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { readDeployedSnapshot } from "./capabilitySnapshot";
import { snapshotFromFacts, diffSnapshots } from "../parser/capabilityDiff";
import { parsePolicy, type Policy } from "../parser/policy";
import { runEveManifest } from "./eveObservability";
import {
  discoverAgents,
  expandHome,
  isEveWorkspace,
  loadState,
  readAgentName,
  saveState,
  type DiscoveredAgent,
} from "./workspaceRegistry";
import { pickFolder } from "./nativeFolderPicker";

async function readPolicy(workspaceRoot: string): Promise<Policy> {
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(workspaceRoot, ".aletheia/policy.json"), "utf8")
    );
    return parsePolicy(raw);
  } catch {
    return { rules: [] };
  }
}

export interface ProjectApiBody {
  id: string;
  files: Record<string, string>;
}

function field(src: string, key: string): string | undefined {
  const m = src.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`));
  return m?.[1]?.trim() || undefined;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "agent"
  );
}

function deriveProjectId(files: Record<string, string>): string {
  const name = field(files["agent.ts"] ?? "", "name");
  return name ? slugify(name) : "agent";
}

/** Read an agent/ directory's .ts/.md files into a flat map (read-only). */
async function readProjectDir(agentDir: string): Promise<ProjectApiBody> {
  const files: Record<string, string> = {};

  async function walk(dir: string, prefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (/\.(ts|md)$/.test(entry.name)) {
        files[rel] = await fs.readFile(full, "utf8");
      }
    }
  }

  try {
    await fs.access(agentDir);
    await walk(agentDir, "");
  } catch {
    return { id: "agent", files: {} };
  }

  return { id: deriveProjectId(files), files };
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

export function projectApiPlugin(agentRoot: string, workspaceRoot: string): Plugin {
  // Which agent is being inspected. Defaults to the boot workspace but can be
  // pointed at any discovered agent. Everything here is read-only.
  let hydrated = false;
  let scanRoot: string | undefined;
  let activePath: string | undefined; // undefined = the default/boot workspace

  async function hydrate(): Promise<void> {
    if (hydrated) return;
    const s = await loadState();
    scanRoot = s.scanRoot;
    activePath = s.activePath;
    hydrated = true;
  }

  const currentActive = (): string => activePath ?? workspaceRoot;

  /** Roots for the inspected workspace (falls back to boot if active is gone). */
  async function inspectRoots(): Promise<{ workspaceRoot: string; agentRoot: string }> {
    await hydrate();
    const target = activePath;
    if (target && target !== workspaceRoot && (await isEveWorkspace(target))) {
      return { workspaceRoot: target, agentRoot: path.join(target, "agent") };
    }
    return { workspaceRoot, agentRoot };
  }

  /** The boot/default agent plus any agents discovered under the scan root. */
  async function listAgents(): Promise<DiscoveredAgent[]> {
    await hydrate();
    const list: DiscoveredAgent[] = [
      { path: workspaceRoot, name: await readAgentName(workspaceRoot), isDefault: true },
    ];
    if (scanRoot) {
      for (const a of await discoverAgents(scanRoot)) {
        if (a.path !== workspaceRoot) list.push(a);
      }
    }
    return list;
  }

  const workspacesPayload = async () => ({
    scanRoot,
    activePath: currentActive(),
    defaultPath: workspaceRoot,
    agents: await listAgents(),
  });

  return {
    name: "aletheia-project-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();

        const url = new URL(req.url, "http://localhost");
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts[0] !== "api") return next();

        const method = req.method ?? "GET";

        try {
          // ── Workspaces: list / scan / switch the inspected agent ──────────
          if (parts[1] === "workspaces") {
            if (!parts[2] && method === "GET") {
              return sendJson(res, 200, await workspacesPayload());
            }
            if (parts[2] === "pick" && method === "POST") {
              const picked = await pickFolder();
              if (picked.error) return sendJson(res, 400, { error: picked.error });
              if (picked.canceled || !picked.path) {
                return sendJson(res, 200, { canceled: true });
              }
              scanRoot = path.resolve(expandHome(picked.path));
              await saveState({ scanRoot, activePath });
              return sendJson(res, 200, await workspacesPayload());
            }
            if (parts[2] === "scan" && method === "POST") {
              const body = (await readJsonBody(req)) as { root?: string };
              if (!body.root) return sendJson(res, 400, { error: "root is required" });
              const root = path.resolve(expandHome(body.root));
              try {
                if (!(await fs.stat(root)).isDirectory()) throw new Error("not a dir");
              } catch {
                return sendJson(res, 400, { error: `Not a directory: ${root}` });
              }
              scanRoot = root;
              await saveState({ scanRoot, activePath });
              return sendJson(res, 200, await workspacesPayload());
            }
            if (parts[2] === "active" && method === "POST") {
              const body = (await readJsonBody(req)) as { path?: string };
              const target = body.path ? path.resolve(expandHome(body.path)) : workspaceRoot;
              // Only the default or a discovered agent may be activated — this
              // keeps the browser from pointing the file reader at any path.
              const agents = await listAgents();
              const known = agents.some((a) => a.path === target);
              if (!known || !(await isEveWorkspace(target))) {
                return sendJson(res, 400, {
                  error: `Not a known eve agent workspace: ${target}`,
                });
              }
              activePath = target === workspaceRoot ? undefined : target;
              await saveState({ scanRoot, activePath });
              return sendJson(res, 200, { activePath: currentActive() });
            }
            return sendJson(res, 405, { error: "Method not allowed" });
          }

          if (parts[1] !== "project") return next();

          const sub = parts[2];
          const { workspaceRoot: inspectWorkspace, agentRoot: inspectAgent } =
            await inspectRoots();

          // The inspected agent's source files.
          if (!sub && method === "GET") {
            const project = await readProjectDir(inspectAgent);
            if (Object.keys(project.files).length === 0) {
              return sendJson(res, 404, { error: "No agent/ found in this workspace" });
            }
            return sendJson(res, 200, project);
          }

          // Verified facts from the compiled manifest (if the agent was built).
          if (sub === "manifest" && method === "GET") {
            return sendJson(res, 200, await runEveManifest(inspectWorkspace));
          }

          // Capability review: diff the built manifest against the last deployed
          // snapshot. Read-only — surfaces how the agent's authority changed.
          if (sub === "review" && method === "GET") {
            const manifest = await runEveManifest(inspectWorkspace);
            if (!manifest.built || !manifest.facts) {
              return sendJson(res, 200, {
                ok: false,
                built: false,
                error:
                  manifest.error ??
                  "This agent has no compiled manifest — build it (in its own project) to review verified capability changes.",
              });
            }
            const prev = await readDeployedSnapshot(inspectAgent);
            const current = snapshotFromFacts(manifest.facts);
            const policy = await readPolicy(inspectWorkspace);
            return sendJson(res, 200, {
              ok: true,
              built: true,
              hadBaseline: prev !== null,
              diff: diffSnapshots(prev, current, { rules: policy.rules }),
              current,
            });
          }

          return sendJson(res, 405, { error: "Method not allowed" });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Internal error";
          return sendJson(res, 500, { error: message });
        }
      });
    },
  };
}
