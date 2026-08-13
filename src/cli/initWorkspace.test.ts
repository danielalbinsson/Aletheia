import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CONSENT_REL } from "./cliCore";
import {
  assertEveWorkspace,
  INIT_CONSENT_JSON,
  INIT_POLICY_JSON,
  POLICY_REL,
  WORKFLOW_REL,
  initWorkflowYaml,
  writeInitFiles,
} from "./initWorkspace";

const execFileAsync = promisify(execFile);

describe("aletheia init sidecars", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-init-"));
    await fs.mkdir(path.join(root, "agent"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("accepts an agent/ directory even without agent.ts", async () => {
    await expect(assertEveWorkspace(root)).resolves.toBeUndefined();
  });

  it("requires agent/", async () => {
    await fs.rm(path.join(root, "agent"), { recursive: true, force: true });
    await expect(assertEveWorkspace(root)).rejects.toThrow(/missing agent\//);
  });

  it("writes policy, consent, and a thin Action wrapper", async () => {
    await assertEveWorkspace(root);
    const result = await writeInitFiles(root, { force: false });
    expect(result.written.sort()).toEqual([POLICY_REL, CONSENT_REL, WORKFLOW_REL].sort());
    expect(result.kept).toEqual([]);

    expect(await fs.readFile(path.join(root, POLICY_REL), "utf8")).toBe(INIT_POLICY_JSON);
    expect(JSON.parse(INIT_POLICY_JSON)).toEqual({ failOn: "elevated", rules: [] });

    expect(await fs.readFile(path.join(root, CONSENT_REL), "utf8")).toBe(INIT_CONSENT_JSON);
    expect(JSON.parse(INIT_CONSENT_JSON)).toEqual({ gated: {} });

    const workflow = await fs.readFile(path.join(root, WORKFLOW_REL), "utf8");
    expect(workflow).toContain(
      "uses: danielalbinsson/Aletheia/.github/actions/capability-review@"
    );
    expect(workflow).not.toContain("@main");
    expect(workflow).not.toContain("npx");
    expect(workflow).toContain("baseline: git:origin/${{ github.base_ref }}");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("types: [opened, synchronize, reopened, labeled, unlabeled]");
    expect(workflow).not.toContain("bin/aletheia.mjs");
    expect(workflow).not.toContain("paths:");
  });

  it("pins an immutable SHA when --action-ref is provided", () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const yaml = initWorkflowYaml({ actionRef: sha, agentDirRel: "examples/ledger" });
    expect(yaml).toContain(
      `uses: danielalbinsson/Aletheia/.github/actions/capability-review@${sha}`
    );
    expect(yaml).toContain("agent-dir: examples/ledger");
    expect(yaml).not.toContain("@main");
  });

  it("writes the workflow at the git root for a nested agent-dir", async () => {
    await execFileAsync("git", ["init"], { cwd: root });
    const nested = path.join(root, "examples", "ledger");
    await fs.mkdir(path.join(nested, "agent"), { recursive: true });
    const result = await writeInitFiles(nested, { force: false });
    expect(result.written).toContain(WORKFLOW_REL);
    expect(await fs.readFile(path.join(root, WORKFLOW_REL), "utf8")).toContain(
      "agent-dir: examples/ledger"
    );
    expect(await fs.readFile(path.join(nested, POLICY_REL), "utf8")).toBe(INIT_POLICY_JSON);
  });

  it("second run without --force is a no-op", async () => {
    await writeInitFiles(root, { force: false });
    const customPolicy = `${JSON.stringify({ failOn: "never", rules: [{ category: "x", severity: "high", pattern: "x" }] }, null, 2)}\n`;
    await fs.writeFile(path.join(root, POLICY_REL), customPolicy);

    const second = await writeInitFiles(root, { force: false });
    expect(second.written).toEqual([]);
    expect(second.kept.sort()).toEqual([POLICY_REL, CONSENT_REL, WORKFLOW_REL].sort());
    expect(await fs.readFile(path.join(root, POLICY_REL), "utf8")).toBe(customPolicy);
  });

  it("writes only the files that are missing", async () => {
    await fs.mkdir(path.join(root, ".aletheia"), { recursive: true });
    const custom = `${JSON.stringify({ failOn: "never", rules: [] }, null, 2)}\n`;
    await fs.writeFile(path.join(root, POLICY_REL), custom);

    const result = await writeInitFiles(root, { force: false });
    expect(result.kept).toEqual([POLICY_REL]);
    expect(result.written.sort()).toEqual([CONSENT_REL, WORKFLOW_REL].sort());
    expect(await fs.readFile(path.join(root, POLICY_REL), "utf8")).toBe(custom);
  });

  it("--force overwrites existing sidecars", async () => {
    await writeInitFiles(root, { force: false });
    await fs.writeFile(path.join(root, POLICY_REL), "{}\n");
    await fs.writeFile(path.join(root, CONSENT_REL), '{"gated":{"x":"y"}}\n');

    const forced = await writeInitFiles(root, { force: true });
    expect(forced.written.sort()).toEqual([POLICY_REL, CONSENT_REL, WORKFLOW_REL].sort());
    expect(forced.kept).toEqual([]);
    expect(await fs.readFile(path.join(root, POLICY_REL), "utf8")).toBe(INIT_POLICY_JSON);
    expect(await fs.readFile(path.join(root, CONSENT_REL), "utf8")).toBe(INIT_CONSENT_JSON);
  });
});
