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
const trackedBin = path.join(repoRoot, "packages", "aletheia-cli", "bin", "aletheia.mjs");
const actionBin = path.join(repoRoot, ".github", "actions", "capability-review", "aletheia.mjs");
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
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-cli-rebuild-"));
    const out = path.join(tmp, "aletheia.mjs");
    const cliPkg = path.join(repoRoot, "packages", "aletheia-cli");
    try {
      await execFileAsync(
        "pnpm",
        [
          "exec",
          "esbuild",
          "../../src/cli/aletheia.ts",
          "--bundle",
          "--platform=node",
          "--format=esm",
          "--target=node24",
          `--outfile=${out}`,
        ],
        { cwd: cliPkg, env: process.env }
      );
      const rebuiltRaw = await fs.readFile(out, "utf8");
      const rebuilt = Buffer.from(rebuiltRaw.replace(/[ \t]+$/gm, ""));
      const tracked = await fs.readFile(trackedBin);
      expect(rebuilt.equals(tracked), "packages/aletheia-cli/bin/aletheia.mjs is stale — run pnpm --dir packages/aletheia-cli build").toBe(true);
      const actionCopy = await fs.readFile(actionBin);
      expect(actionCopy.equals(tracked), ".github/actions/capability-review/aletheia.mjs is stale — rebuild the CLI").toBe(true);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
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
      const { stdout, stderr } = await execFileAsync(process.execPath, [trackedBin, ...args], {
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
    expect(stderr).toContain("usage:");
    expect(stderr).toContain("aletheia diff");
    expect(stderr).toContain("aletheia snapshot");
    expect(stderr).toContain("aletheia init");
  });

  it("maps unknown flags and malformed baselines to exit 2", async () => {
    const unknown = await runCli(["diff", "--no-build", "--explode"]);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toMatch(/unknown flag/);

    const force = await runCli(["diff", "--no-build", "--force"]);
    expect(force.code).toBe(2);
    expect(force.stderr).toMatch(/only valid with aletheia init/);

    const badFile = path.join(agentRoot, "bad-baseline.json");
    await fs.writeFile(badFile, "{ not json");
    const malformed = await runCli([
      "diff",
      "--no-build",
      "--baseline",
      `file:${badFile}`,
    ]);
    expect(malformed.code).toBe(2);
    expect(malformed.stderr).toMatch(/malformed baseline JSON/);
  });

  it("exits 0 with no authority changes against the file baseline", async () => {
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
    expect(report.headline).toMatch(/No authority changes/i);
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
    expect(stdout).toContain("aletheia snapshot");
    expect(stdout).toContain("agent/.aletheia/deployed-capabilities.json");
  });

  it("--no-build snapshot writes deployed-capabilities.json matching the fixture", async () => {
    const dest = path.join(agentRoot, "agent/.aletheia/deployed-capabilities.json");
    await fs.rm(dest);
    const { code, stdout } = await runCli(["snapshot", "--no-build"]);
    expect(code).toBe(0);
    const snap = JSON.parse(await fs.readFile(dest, "utf8")) as CapabilitySnapshot;
    expect(snap.capabilities).toEqual([
      {
        source: "tools/draft-reply.ts",
        label: "Draft reply",
        consent: "asks-first",
      },
      { source: "tools/search-docs.ts", label: "Search docs" },
    ]);
    expect(snap.reach).toEqual([
      { label: "slack", kind: "api", detail: "MCP · https://mcp.slack.com", id: "connections/slack.ts" },
    ]);
    expect(snap.restrictions).toEqual([
      { tool: "bash", label: "run shell commands" },
      { tool: "write_file", label: "write files" },
    ]);
    expect(stdout).toContain("commit this file so the next `aletheia diff` uses it as baseline.");
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

  it("init --no-snapshot writes sidecars; second run is a no-op without --force", async () => {
    const fresh = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-init-smoke-"));
    try {
      await fs.mkdir(path.join(fresh, "agent"), { recursive: true });
      await fs.writeFile(path.join(fresh, "agent/agent.ts"), "export default {};\n");

      const first = await execFileAsync(process.execPath, [trackedBin, "init", "--no-snapshot"], {
        cwd: fresh,
        env: process.env,
      });
      expect(first.stdout).toContain("wrote .aletheia/policy.json");
      expect(first.stdout).toContain("wrote agent/.aletheia/consent.json");
      expect(first.stdout).toContain("wrote .github/workflows/capability-review.yml");
      expect(first.stdout).toContain("does not run or deploy the agent");
      expect(first.stdout).toContain("skipped snapshot (--no-snapshot)");

      const policy = JSON.parse(
        await fs.readFile(path.join(fresh, ".aletheia/policy.json"), "utf8")
      ) as { failOn: string; rules: unknown[] };
      expect(policy).toEqual({ failOn: "elevated", rules: [] });
      const consent = JSON.parse(
        await fs.readFile(path.join(fresh, "agent/.aletheia/consent.json"), "utf8")
      ) as { gated: Record<string, string> };
      expect(consent).toEqual({ gated: {} });
      const workflow = await fs.readFile(
        path.join(fresh, ".github/workflows/capability-review.yml"),
        "utf8"
      );
      expect(workflow).toContain("danielalbinsson/Aletheia/.github/actions/capability-review@");
      expect(workflow).toContain("git:origin/${{ github.base_ref }}");
      expect(workflow).toContain("pnpm install --frozen-lockfile");
      expect(workflow).not.toContain("@main");

      const custom = '{"failOn":"never","rules":[]}\n';
      await fs.writeFile(path.join(fresh, ".aletheia/policy.json"), custom);
      const second = await execFileAsync(process.execPath, [trackedBin, "init", "--no-snapshot"], {
        cwd: fresh,
        env: process.env,
      });
      expect(second.stdout).toContain("kept .aletheia/policy.json");
      expect(second.stdout).toContain("kept agent/.aletheia/consent.json");
      expect(second.stdout).toContain("kept .github/workflows/capability-review.yml");
      expect(second.stdout).not.toMatch(/^wrote /m);
      expect(await fs.readFile(path.join(fresh, ".aletheia/policy.json"), "utf8")).toBe(custom);

      const noBuild = await execFileAsync(process.execPath, [trackedBin, "init", "--no-build"], {
        cwd: fresh,
        env: process.env,
      });
      expect(noBuild.stdout).toContain("skipped snapshot (--no-build)");
    } finally {
      await fs.rm(fresh, { recursive: true, force: true });
    }
  });

  it("init without agent/ exits 2", async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-init-empty-"));
    try {
      let code = 0;
      let stderr = "";
      try {
        await execFileAsync(process.execPath, [trackedBin, "init", "--no-snapshot"], {
          cwd: empty,
          env: process.env,
        });
      } catch (err) {
        const e = err as { status?: number; code?: number | string; stderr?: string };
        code =
          typeof e.status === "number"
            ? e.status
            : typeof e.code === "number"
              ? e.code
              : 1;
        stderr = e.stderr ?? String(err);
      }
      expect(code).toBe(2);
      expect(stderr).toMatch(/missing agent\//);
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });
});
