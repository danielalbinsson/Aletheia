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
const pkgJsonPath = path.join(repoRoot, "packages", "aletheia-cli", "package.json");

const fixtureManifest: CompiledManifest = {
  config: {
    name: "fixture-bot",
    model: { id: "openrouter/anthropic/claude-sonnet-4" },
    description: "CLI smoke fixture",
  },
  tools: [
    {
      name: "draft-reply",
      description: "Write and send a reply.",
      logicalPath: "tools/draft-reply.ts",
    },
    {
      name: "search-docs",
      description: "Search docs.",
      logicalPath: "tools/search-docs.ts",
    },
  ],
  skills: [],
  connections: [
    {
      connectionName: "slack",
      description: "Posts to Slack",
      protocol: "mcp",
      url: "https://mcp.slack.com",
      logicalPath: "connections/slack.ts",
    },
  ],
  channels: [],
  schedules: [],
  subagents: [],
  disabledFrameworkTools: ["bash", "write_file"],
};

describe("npm package contract (@danielalbinsson/aletheia-cli)", () => {
  it("publishes under the scoped name with both bins", async () => {
    const pkg = JSON.parse(await fs.readFile(pkgJsonPath, "utf8")) as {
      name: string;
      bin: Record<string, string>;
      files: string[];
    };
    expect(pkg.name).toBe("@danielalbinsson/aletheia-cli");
    expect(pkg.bin.aletheia).toBe("bin/aletheia.mjs");
    expect(pkg.bin["aletheia-cli"]).toBe("bin/aletheia.mjs");
    expect(pkg.files).toContain("bin");
  });
});

describe("aletheia CLI smoke", () => {
  let agentRoot: string;

  beforeAll(async () => {
    // Ensure the bundled bin matches current sources (includes cliCore).
    await execFileAsync("pnpm", ["--dir", path.join(repoRoot, "packages/aletheia-cli"), "build"], {
      cwd: repoRoot,
      env: process.env,
    });
    await fs.copyFile(
      path.join(repoRoot, "packages/aletheia-cli/bin/aletheia.mjs"),
      binPath
    );
    await fs.chmod(binPath, 0o755);
  }, 60_000);

  beforeEach(async () => {
    agentRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-cli-smoke-"));
    await fs.mkdir(path.join(agentRoot, ".eve/compile"), { recursive: true });
    await fs.mkdir(path.join(agentRoot, "agent/.aletheia"), { recursive: true });
    await fs.mkdir(path.join(agentRoot, "agent/tools"), { recursive: true });
    await fs.mkdir(path.join(agentRoot, ".aletheia"), { recursive: true });

    await fs.writeFile(
      path.join(agentRoot, ".eve/compile/compiled-agent-manifest.json"),
      JSON.stringify(fixtureManifest, null, 2)
    );
    await fs.writeFile(
      path.join(agentRoot, "agent/.aletheia/consent.json"),
      JSON.stringify({
        gated: { "draft-reply": "Customer-facing send — irreversible." },
      })
    );
    await fs.writeFile(
      path.join(agentRoot, ".aletheia/policy.json"),
      JSON.stringify({ failOn: "elevated", rules: [] })
    );
    await fs.writeFile(
      path.join(agentRoot, "agent/tools/draft-reply.ts"),
      `import { always } from "eve/tools/approval";\nexport default { approval: always() };\n`
    );
    await fs.writeFile(
      path.join(agentRoot, "agent/tools/search-docs.ts"),
      `export default {};\n`
    );

    const baseline: CapabilitySnapshot = {
      capturedAt: "2026-07-26T00:00:00.000Z",
      name: "fixture-bot",
      mind: { model: "openrouter/anthropic/claude-sonnet-4" },
      capabilities: [
        {
          source: "tools/draft-reply.ts",
          label: "Draft reply",
          consent: "asks-first",
        },
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
      const e = err as NodeJS.ErrnoException & {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        status?: number;
      };
      return {
        code: typeof e.status === "number" ? e.status : Number(e.code) || 1,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? String(err),
      };
    }
  }

  it("prints usage and exits 0 with no command", async () => {
    const { code, stderr } = await runCli([]);
    expect(code).toBe(0);
    expect(stderr).toContain("usage: aletheia diff");
  });

  it("exits 0 with no capability changes against the file baseline", async () => {
    const out = path.join(agentRoot, "diff.json");
    const { code, stdout } = await runCli([
      "diff",
      "--no-build",
      "--format",
      "json",
      "--fail-on",
      "elevated",
      "--baseline",
      "file:agent/.aletheia/deployed-capabilities.json",
      "--out",
      out,
    ]);
    expect(code).toBe(0);
    const report = JSON.parse(await fs.readFile(out, "utf8")) as {
      failing: boolean;
      headline: string;
      current: CapabilitySnapshot;
    };
    expect(report.failing).toBe(false);
    expect(report.headline).toMatch(/No capability changes/i);
    expect(report.current.restrictions?.map((r) => r.tool)).toEqual(["bash", "write_file"]);
    expect(stdout).toBe("");
  });

  it("exits 1 when authority expands (new high-blast reach)", async () => {
    const expanded = structuredClone(fixtureManifest);
    expanded.connections = [
      ...(expanded.connections ?? []),
      {
        connectionName: "stripe",
        description: "Payments",
        protocol: "openapi",
        url: "https://api.stripe.com",
        logicalPath: "connections/stripe.ts",
      },
    ];
    await fs.writeFile(
      path.join(agentRoot, ".eve/compile/compiled-agent-manifest.json"),
      JSON.stringify(expanded, null, 2)
    );

    const { code, stdout } = await runCli([
      "diff",
      "--no-build",
      "--format",
      "markdown",
      "--fail-on",
      "elevated",
      "--baseline",
      "file:agent/.aletheia/deployed-capabilities.json",
    ]);
    expect(code).toBe(1);
    expect(stdout).toContain("Authority expanded");
    expect(stdout).toContain("stripe");
  });

  it("exits 2 when there is no compiled manifest", async () => {
    await fs.rm(path.join(agentRoot, ".eve/compile/compiled-agent-manifest.json"));
    const { code, stderr } = await runCli([
      "diff",
      "--no-build",
      "--baseline",
      "file:agent/.aletheia/deployed-capabilities.json",
    ]);
    expect(code).toBe(2);
    expect(stderr).toMatch(/no compiled manifest/i);
  });
});
