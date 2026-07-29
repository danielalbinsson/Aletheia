import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { CompiledManifest } from "../parser/manifestAdapter";
import type { CapabilitySnapshot } from "../parser/capabilityDiff";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const binPath = path.join(repoRoot, "bin", "aletheia.mjs");

const manifest: CompiledManifest = {
  config: {
    name: "fixture-bot",
    model: { id: "openrouter/anthropic/claude-sonnet-4" },
    description: "passport smoke fixture",
  },
  tools: [
    { name: "draft-reply", description: "Write and send a reply.", logicalPath: "tools/draft-reply.ts" },
    { name: "search-docs", description: "Search docs.", logicalPath: "tools/search-docs.ts" },
  ],
  skills: [],
  connections: [
    { connectionName: "slack", description: "Posts to Slack", protocol: "mcp", url: "https://mcp.slack.com", logicalPath: "connections/slack.ts" },
  ],
  channels: [],
  schedules: [],
  subagents: [],
  disabledFrameworkTools: ["bash", "write_file"],
};

const baseline: CapabilitySnapshot = {
  capturedAt: "2026-07-26T00:00:00.000Z",
  name: "fixture-bot",
  mind: { model: "openrouter/anthropic/claude-sonnet-4" },
  capabilities: [
    { source: "tools/draft-reply.ts", label: "Draft reply", consent: "asks-first" },
    { source: "tools/search-docs.ts", label: "Search docs" },
  ],
  reach: [{ label: "slack", kind: "api", detail: "MCP · https://mcp.slack.com" }],
  autonomy: [],
  subagents: [],
  restrictions: [
    { tool: "bash", label: "run shell commands" },
    { tool: "write_file", label: "write files" },
  ],
};

describe("aletheia passport (CLI)", () => {
  let agentRoot: string;

  beforeAll(async () => {
    await execFileAsync("pnpm", ["--dir", path.join(repoRoot, "packages/aletheia-cli"), "build"], {
      cwd: repoRoot,
      env: process.env,
    });
    await fs.copyFile(path.join(repoRoot, "packages/aletheia-cli/bin/aletheia.mjs"), binPath);
    await fs.chmod(binPath, 0o755);
  }, 60_000);

  beforeEach(async () => {
    agentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-passport-"));
    await fs.mkdir(path.join(agentRoot, ".eve/compile"), { recursive: true });
    await fs.mkdir(path.join(agentRoot, "agent/.aletheia"), { recursive: true });
    await fs.mkdir(path.join(agentRoot, ".aletheia"), { recursive: true });
    await fs.writeFile(
      path.join(agentRoot, ".eve/compile/compiled-agent-manifest.json"),
      JSON.stringify(manifest, null, 2)
    );
    await fs.writeFile(
      path.join(agentRoot, "agent/.aletheia/consent.json"),
      JSON.stringify({ gated: { "draft-reply": "Customer-facing send." } })
    );
    await fs.writeFile(
      path.join(agentRoot, ".aletheia/policy.json"),
      JSON.stringify({ failOn: "elevated", rules: [] })
    );
    await fs.writeFile(
      path.join(agentRoot, "agent/.aletheia/deployed-capabilities.json"),
      JSON.stringify(baseline, null, 2)
    );
  });

  afterEach(async () => {
    await fs.rm(agentRoot, { recursive: true, force: true });
  });

  async function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [binPath, ...args], {
        cwd: agentRoot,
        env: process.env,
        maxBuffer: 2 * 1024 * 1024,
      });
      return { code: 0, stdout, stderr };
    } catch (err) {
      const e = err as { status?: number; code?: number | string; stdout?: string; stderr?: string };
      return {
        code: typeof e.status === "number" ? e.status : Number(e.code) || 1,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? String(err),
      };
    }
  }

  it("exits 0 and certifies a fully compliant agent", async () => {
    const { code, stdout } = await runCli([
      "passport",
      "--no-build",
      "--format",
      "json",
      "--baseline",
      "file:agent/.aletheia/deployed-capabilities.json",
    ]);
    expect(code).toBe(0);
    const passport = JSON.parse(stdout) as { certified: boolean; stamp: string; failures: number };
    expect(passport.certified).toBe(true);
    expect(passport.stamp).toBe("Kit Certified");
    expect(passport.failures).toBe(0);
  });

  it("exits 1 and refuses the stamp when policy and baseline are missing", async () => {
    await fs.rm(path.join(agentRoot, ".aletheia/policy.json"));
    await fs.rm(path.join(agentRoot, "agent/.aletheia/deployed-capabilities.json"));

    const { code, stdout } = await runCli([
      "passport",
      "--no-build",
      "--format",
      "json",
      "--baseline",
      "file:agent/.aletheia/deployed-capabilities.json",
    ]);
    expect(code).toBe(1);
    const passport = JSON.parse(stdout) as {
      certified: boolean;
      stamp: string;
      checks: { id: string; status: string }[];
    };
    expect(passport.certified).toBe(false);
    expect(passport.stamp).toBe("Not certified");
    const failing = passport.checks.filter((c) => c.status === "fail").map((c) => c.id);
    expect(failing).toContain("policy-present");
    expect(failing).toContain("ci-diff-green");
  });

  it("generates the passport markdown rather than requiring it to be hand-authored", async () => {
    const { code, stdout } = await runCli([
      "passport",
      "--no-build",
      "--baseline",
      "file:agent/.aletheia/deployed-capabilities.json",
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("# Capability passport — fixture-bot");
    expect(stdout).toContain("Do not edit by hand — regenerate.");
    expect(stdout).toContain("Kit Certified checklist");
    // Facts come from the manifest, not from prose someone typed.
    expect(stdout).toContain("Draft reply (**asks first**)");
    expect(stdout).toContain("run shell commands (`bash` disabled)");
  });
});
