import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { runEveBuild } from "./eveBuild";
import { readDeployLinkStatus } from "./deployStatus";
import { readModelCredentialStatus } from "./modelCredentials";
import { runEveDeploy } from "./eveDeploy";
import { readDeployedSnapshot, writeDeployedSnapshot } from "./capabilitySnapshot";
import { snapshotFromFacts, diffSnapshots } from "../parser/capabilityDiff";
import { parsePolicy, type Policy } from "../parser/policy";

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
import { getEveDevStatus, startEveDev, stopEveDev } from "./eveDevServer";
import {
  buildVercelObservabilityLinks,
  readDiscoveryManifest,
  readEveDiagnostics,
  runEveInfo,
  runEveManifest,
} from "./eveObservability";

const FILE_RE = /^[\w./-]+\.(ts|md)$/;

export interface ProjectApiBody {
  id: string;
  files: Record<string, string>;
}

function validateFiles(files: Record<string, string>): string | null {
  for (const rel of Object.keys(files)) {
    if (!FILE_RE.test(rel)) return `Invalid file path: ${rel}`;
    if (rel.includes("..")) return `Path traversal not allowed: ${rel}`;
  }
  return null;
}

function field(src: string, key: string): string | undefined {
  const m = src.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`));
  return m?.[1]?.trim() || undefined;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "agent";
}

function deriveProjectId(files: Record<string, string>): string {
  const name = field(files["agent.ts"] ?? "", "name");
  return name ? slugify(name) : "agent";
}

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

async function isProjectEmpty(agentDir: string): Promise<boolean> {
  try {
    const body = await readProjectDir(agentDir);
    return Object.keys(body.files).length === 0;
  } catch {
    return true;
  }
}

async function writeProjectDir(agentDir: string, files: Record<string, string>) {
  const tmpDir = `${agentDir}.tmp-${Date.now()}`;
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    for (const [rel, content] of Object.entries(files)) {
      const dest = path.join(tmpDir, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content, "utf8");
    }

    await fs.rm(agentDir, { recursive: true, force: true });
    await fs.rename(tmpDir, agentDir);
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    throw err;
  }
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
  return {
    name: "aletheia-project-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/project")) return next();

        const url = new URL(req.url, "http://localhost");
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts[0] !== "api" || parts[1] !== "project") return next();

        const method = req.method ?? "GET";
        const sub = parts[2];

        try {
          if (!sub && method === "GET") {
            const project = await readProjectDir(agentRoot);
            if (Object.keys(project.files).length === 0) {
              return sendJson(res, 404, { error: "Project not initialized" });
            }
            return sendJson(res, 200, project);
          }

          if (!sub && method === "PUT") {
            const body = (await readJsonBody(req)) as { files?: Record<string, string> };
            const fileErr = validateFiles(body.files ?? {});
            if (fileErr) return sendJson(res, 400, { error: fileErr });

            await writeProjectDir(agentRoot, body.files ?? {});
            const project = await readProjectDir(agentRoot);
            return sendJson(res, 200, project);
          }

          if (sub === "init" && method === "POST") {
            const body = (await readJsonBody(req)) as { files?: Record<string, string> };
            const fileErr = validateFiles(body.files ?? {});
            if (fileErr) return sendJson(res, 400, { error: fileErr });

            const empty = await isProjectEmpty(agentRoot);
            if (!empty) {
              return sendJson(res, 409, { error: "Project already exists" });
            }

            await writeProjectDir(agentRoot, body.files ?? {});
            const project = await readProjectDir(agentRoot);
            return sendJson(res, 201, project);
          }

          if (sub === "build" && method === "POST") {
            const result = await runEveBuild(workspaceRoot);
            return sendJson(res, result.ok ? 200 : 422, result);
          }

          if (sub === "manifest" && method === "GET") {
            const result = await runEveManifest(workspaceRoot);
            return sendJson(res, 200, result);
          }

          if (sub === "deploy" && parts[3] === "status" && method === "GET") {
            const status = await readDeployLinkStatus(workspaceRoot);
            return sendJson(res, 200, status);
          }

          if (sub === "deploy" && parts[3] === "diff" && method === "GET") {
            // Capability review: diff the current built manifest against the
            // last deployed snapshot. Drives the pre-deploy review gate.
            const manifest = await runEveManifest(workspaceRoot);
            if (!manifest.built || !manifest.facts) {
              return sendJson(res, 200, {
                ok: false,
                built: false,
                error: manifest.error ?? "Build the agent to review capability changes.",
              });
            }
            const prev = await readDeployedSnapshot(agentRoot);
            const current = snapshotFromFacts(manifest.facts);
            const policy = await readPolicy(workspaceRoot);
            return sendJson(res, 200, {
              ok: true,
              built: true,
              hadBaseline: prev !== null,
              diff: diffSnapshots(prev, current, { rules: policy.rules }),
              current,
            });
          }

          if (sub === "deploy" && method === "POST") {
            // Stream NDJSON: {type:"log",...} chunks as eve deploy runs, then a
            // final {type:"result", result}. Status is always 200 because the
            // body streams before the outcome is known; success is on the result.
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/x-ndjson");
            res.setHeader("Cache-Control", "no-cache");
            const writeEvent = (event: unknown) => {
              res.write(`${JSON.stringify(event)}\n`);
            };
            const result = await runEveDeploy(workspaceRoot, (data, stream) =>
              writeEvent({ type: "log", stream, data })
            );
            // On a successful deploy, record the capability snapshot so the
            // next deploy diffs against what actually shipped.
            if (result.ok) {
              try {
                const manifest = await runEveManifest(workspaceRoot);
                if (manifest.built && manifest.facts) {
                  await writeDeployedSnapshot(agentRoot, snapshotFromFacts(manifest.facts));
                  writeEvent({ type: "log", stream: "stdout", data: "\n[aletheia] recorded capability snapshot.\n" });
                }
              } catch {
                writeEvent({
                  type: "log",
                  stream: "stderr",
                  data: "\n[aletheia] deploy succeeded but capability snapshot could not be recorded.\n",
                });
              }
            }
            writeEvent({ type: "result", result });
            res.end();
            return;
          }

          if (sub === "dev" && parts[3] === "status" && method === "GET") {
            const [status, credentials] = await Promise.all([
              getEveDevStatus(workspaceRoot),
              readModelCredentialStatus(workspaceRoot),
            ]);
            return sendJson(res, 200, { ...status, credentials });
          }

          if (sub === "dev" && parts[3] === "start" && method === "POST") {
            const credentials = await readModelCredentialStatus(workspaceRoot);
            const result = await startEveDev(workspaceRoot);
            return sendJson(res, result.ok ? 200 : 503, {
              ...result,
              credentials,
            });
          }

          if (sub === "dev" && parts[3] === "stop" && method === "POST") {
            const status = await stopEveDev(workspaceRoot);
            return sendJson(res, 200, { ok: true, status });
          }

          if (sub === "observability" && parts[3] === "snapshot" && method === "GET") {
            const [diagnostics, info, link] = await Promise.all([
              readEveDiagnostics(workspaceRoot),
              runEveInfo(workspaceRoot),
              readDeployLinkStatus(workspaceRoot),
            ]);
            const manifest = await readDiscoveryManifest(workspaceRoot);
            return sendJson(res, 200, {
              diagnostics,
              info,
              manifest,
              vercel: buildVercelObservabilityLinks(link),
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
