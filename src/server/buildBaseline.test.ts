import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { resolveBaseline } from "../cli/cliCore";
import type { CompiledManifest } from "../parser/manifestAdapter";
import type { EveBuildResult } from "./eveBuild";
import { resolveBuildBaseline } from "./buildBaseline";

const execFileAsync = promisify(execFile);

function okBuild(): EveBuildResult {
  return { ok: true, exitCode: 0, stdout: "", stderr: "", diagnostics: [] };
}

function failBuild(stderr = "compile error"): EveBuildResult {
  return { ok: false, exitCode: 1, stdout: "", stderr, diagnostics: [] };
}

function manifestFor(name: string, extraReach = false): CompiledManifest {
  return {
    config: { name, model: { id: "openrouter/anthropic/claude-sonnet-4" } },
    tools: [
      {
        name: "search-docs",
        description: "Search docs.",
        logicalPath: "tools/search-docs.ts",
      },
    ],
    skills: [],
    connections: extraReach
      ? [
          {
            connectionName: "slack",
            description: "Posts to Slack",
            protocol: "mcp",
            url: "https://mcp.slack.com",
            logicalPath: "connections/slack.ts",
          },
        ]
      : [],
    channels: [],
    schedules: [],
    subagents: [],
    disabledFrameworkTools: [],
  };
}

async function stubBuildFromMarker(workspaceRoot: string): Promise<EveBuildResult> {
  const marker = (await fs.readFile(path.join(workspaceRoot, "agent/MARKER.txt"), "utf8")).trim();
  await fs.mkdir(path.join(workspaceRoot, ".eve/compile"), { recursive: true });
  await fs.writeFile(
    path.join(workspaceRoot, ".eve/compile/compiled-agent-manifest.json"),
    JSON.stringify(manifestFor(marker, marker === "current-agent"))
  );
  return okBuild();
}

async function writeAgentTree(agentRoot: string, marker: string): Promise<void> {
  await fs.mkdir(path.join(agentRoot, "agent/tools"), { recursive: true });
  await fs.writeFile(path.join(agentRoot, "agent/MARKER.txt"), `${marker}\n`);
  await fs.writeFile(path.join(agentRoot, "agent/agent.ts"), `export default { name: "${marker}" };\n`);
  await fs.writeFile(path.join(agentRoot, "agent/tools/search-docs.ts"), "export default {};\n");
}

async function gitInit(root: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Test"], { cwd: root });
}

async function gitCommit(root: string, message: string): Promise<void> {
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-m", message], { cwd: root });
}

describe("resolveBuildBaseline (fixture git repo)", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-build-ref-"));
    await gitInit(root);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("builds a snapshot from an isolated checkout of the ref, not the working tree", async () => {
    await writeAgentTree(root, "baseline-agent");
    await gitCommit(root, "baseline");
    await execFileAsync("git", ["tag", "baseline"], { cwd: root });

    await writeAgentTree(root, "current-agent");
    await gitCommit(root, "head");

    const loaded = await resolveBuildBaseline("build:baseline", root, {
      runBuild: stubBuildFromMarker,
      install: async () => {},
    });
    expect(loaded.name).toBe("baseline-agent");
    expect(loaded.reach).toEqual([]);

    const working = (await fs.readFile(path.join(root, "agent/MARKER.txt"), "utf8")).trim();
    expect(working).toBe("current-agent");
  });

  it("resolves a nested --agent-dir against the repo-root worktree", async () => {
    const nested = path.join(root, "examples", "ledger");
    await writeAgentTree(nested, "baseline-agent");
    await gitCommit(root, "baseline");
    await execFileAsync("git", ["tag", "baseline"], { cwd: root });

    await writeAgentTree(nested, "current-agent");
    await gitCommit(root, "head");

    const loaded = await resolveBuildBaseline("build:baseline", nested, {
      runBuild: stubBuildFromMarker,
      install: async () => {},
    });
    expect(loaded.name).toBe("baseline-agent");
  });

  it("throws (does not return null) when eve build fails", async () => {
    await writeAgentTree(root, "baseline-agent");
    await gitCommit(root, "baseline");
    await execFileAsync("git", ["tag", "baseline"], { cwd: root });

    await expect(
      resolveBuildBaseline("build:baseline", root, {
        runBuild: async () => failBuild("boom"),
        install: async () => {},
      })
    ).rejects.toThrow(/build:baseline failed/);
  });

  it("throws for an unknown ref instead of a null baseline", async () => {
    await writeAgentTree(root, "baseline-agent");
    await gitCommit(root, "baseline");

    await expect(resolveBuildBaseline("build:does-not-exist", root)).rejects.toThrow(
      /unknown git ref/
    );
  });

  it("throws for an empty build: spec", async () => {
    await expect(resolveBuildBaseline("build:", root)).rejects.toThrow(/invalid --baseline/);
  });

  it("installs at the worktree, not the host checkout", async () => {
    await writeAgentTree(root, "baseline-agent");
    await gitCommit(root, "baseline");
    await execFileAsync("git", ["tag", "baseline"], { cwd: root });
    const installs: string[] = [];
    await resolveBuildBaseline("build:baseline", root, {
      install: async (worktreeDir) => {
        installs.push(worktreeDir);
      },
      runBuild: stubBuildFromMarker,
    });
    expect(installs).toHaveLength(1);
    expect(path.resolve(installs[0])).not.toBe(path.resolve(root));
  });

  it("throws when the ref has no pnpm-lock.yaml", async () => {
    await writeAgentTree(root, "baseline-agent");
    await gitCommit(root, "baseline");
    await execFileAsync("git", ["tag", "baseline"], { cwd: root });
    await expect(resolveBuildBaseline("build:baseline", root, { runBuild: stubBuildFromMarker })).rejects.toThrow(
      /pnpm-lock/
    );
  });

  it("throws when a successful build still has no compiled manifest", async () => {
    await writeAgentTree(root, "baseline-agent");
    await gitCommit(root, "baseline");
    await execFileAsync("git", ["tag", "baseline"], { cwd: root });

    await expect(
      resolveBuildBaseline("build:baseline", root, {
        runBuild: async () => okBuild(),
        install: async () => {},
      })
    ).rejects.toThrow(/no compiled manifest/);
  });
});

describe("resolveBaseline vs build:", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-git-vs-build-"));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("keeps git: as a committed snapshot file (null when missing)", async () => {
    await gitInit(root);
    await fs.mkdir(path.join(root, "agent"), { recursive: true });
    await fs.writeFile(path.join(root, "agent/agent.ts"), "export default {};\n");
    await gitCommit(root, "no snapshot");

    expect(await resolveBaseline("git:HEAD", root)).toBeNull();
  });

  it("does not treat build: as a missing snapshot", async () => {
    await expect(resolveBaseline("build:main", root)).rejects.toThrow(/isolated checkout/);
  });
});
