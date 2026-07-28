import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const diffScript = path.join(repoRoot, "scripts/ci/capability-diff.sh");
const gateScript = path.join(repoRoot, "scripts/ci/capability-gate.sh");
const workflowDir = path.join(repoRoot, ".github/workflows");

type Run = { code: number; stdout: string; stderr: string };

async function runBash(script: string, opts: { args?: string[]; env?: Record<string, string> } = {}): Promise<Run> {
  try {
    const { stdout, stderr } = await execFileAsync("bash", [script, ...(opts.args ?? [])], {
      env: { ...process.env, ...opts.env },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number | string; status?: number; stdout?: string; stderr?: string };
    return {
      code: typeof e.status === "number" ? e.status : Number(e.code) || 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? String(err),
    };
  }
}

describe("capability gate decision", () => {
  it("passes when there is no capability change", async () => {
    const { code, stdout } = await runBash(gateScript, { env: { DIFF_EXIT: "0", ACK: "false", NAME: "design-qa" } });
    expect(code).toBe(0);
    expect(stdout).toMatch(/no capability change/i);
  });

  it("BLOCKS when authority expanded and there is no ack label", async () => {
    const { code, stderr } = await runBash(gateScript, { env: { DIFF_EXIT: "1", ACK: "false", NAME: "design-qa" } });
    expect(code).toBe(1);
    expect(stderr).toContain("Agent authority expanded");
    expect(stderr).toContain("capability-change-ack");
  });

  it("allows an acknowledged expansion", async () => {
    const { code, stdout } = await runBash(gateScript, { env: { DIFF_EXIT: "1", ACK: "true", NAME: "beacon" } });
    expect(code).toBe(0);
    expect(stdout).toMatch(/acknowledged/i);
  });

  // The original bug. `continue-on-error: true` plus an aborted exit-code
  // capture left this variable empty, and `[ "" = "1" ]` is false, so the gate
  // passed. Silence must never read as safety.
  it("fails CLOSED when no diff result was reported (regression: the gate that never gated)", async () => {
    const { code, stderr } = await runBash(gateScript, { env: { DIFF_EXIT: "", ACK: "false", NAME: "design-qa" } });
    expect(code).toBe(1);
    expect(stderr).toMatch(/failing closed/i);
  });

  it("fails closed when DIFF_EXIT is missing entirely", async () => {
    const { code, stderr } = await runBash(gateScript, { env: { ACK: "true", NAME: "design-qa" } });
    expect(code).toBe(1);
    expect(stderr).toMatch(/failing closed/i);
  });

  it("fails closed on a non-numeric result", async () => {
    const { code, stderr } = await runBash(gateScript, { env: { DIFF_EXIT: "boom", ACK: "true" } });
    expect(code).toBe(1);
    expect(stderr).toMatch(/unexpected capability-diff result/i);
  });

  it("blocks a tooling failure even when acknowledged", async () => {
    const { code, stderr } = await runBash(gateScript, { env: { DIFF_EXIT: "2", ACK: "true", NAME: "design-qa" } });
    expect(code).toBe(1);
    expect(stderr).toMatch(/failed to run/i);
  });
});

describe("capability diff exit-code capture", () => {
  async function withOutputFile<T>(fn: (outPath: string) => Promise<T>): Promise<T> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-gate-"));
    try {
      return await fn(path.join(dir, "github-output"));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  it("records exit=0 and succeeds", async () => {
    await withOutputFile(async (out) => {
      const { code } = await runBash(diffScript, { args: ["true"], env: { GITHUB_OUTPUT: out } });
      expect(code).toBe(0);
      expect(await fs.readFile(out, "utf8")).toContain("exit=0");
    });
  });

  // This is the assertion the old inline YAML could not satisfy: under `bash -e`
  // a non-zero exit aborted the step before the echo, so nothing was recorded.
  it("records exit=1 without aborting, so the gate can see it (regression)", async () => {
    await withOutputFile(async (out) => {
      const { code, stdout } = await runBash(diffScript, {
        args: ["bash", "-c", "exit 1"],
        env: { GITHUB_OUTPUT: out },
      });
      expect(code).toBe(0); // the gate decides, not this step
      expect(stdout).toContain("aletheia diff exited 1");
      expect(await fs.readFile(out, "utf8")).toContain("exit=1");
    });
  });

  it("propagates a tooling failure (exit 2) so the job fails loudly", async () => {
    await withOutputFile(async (out) => {
      const { code, stderr } = await runBash(diffScript, {
        args: ["bash", "-c", "exit 2"],
        env: { GITHUB_OUTPUT: out },
      });
      expect(code).toBe(2);
      expect(stderr).toMatch(/tooling failure/i);
      expect(await fs.readFile(out, "utf8")).toContain("exit=2");
    });
  });

  it("works with no GITHUB_OUTPUT set (local runs)", async () => {
    const { code, stdout } = await runBash(diffScript, { args: ["bash", "-c", "exit 1"] });
    expect(code).toBe(0);
    expect(stdout).toContain("aletheia diff exited 1");
  });
});

describe("workflow contract", () => {
  it("no workflow reintroduces the aborted exit-code capture", async () => {
    const files = (await fs.readdir(workflowDir)).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const yaml = await fs.readFile(path.join(workflowDir, file), "utf8");
      // `echo "exit=$?"` is only correct immediately after the command whose
      // status is wanted, which YAML `run:` blocks under `bash -e` never reach.
      expect(yaml, `${file} must capture the exit code via scripts/ci/capability-diff.sh`).not.toMatch(
        /echo\s+"exit=\$\?"/
      );
    }
  });

  it("the capability-review diff step does not swallow failures with continue-on-error", async () => {
    const yaml = await fs.readFile(path.join(workflowDir, "capability-review.yml"), "utf8");
    const diffStep = yaml.slice(yaml.indexOf("- name: Capability diff"), yaml.indexOf("- name: Post sticky comment"));
    expect(diffStep).not.toContain("continue-on-error");
  });

  it("the gate step delegates to the tested script", async () => {
    const yaml = await fs.readFile(path.join(workflowDir, "capability-review.yml"), "utf8");
    expect(yaml).toContain("scripts/ci/capability-gate.sh");
    expect(yaml).toContain("scripts/ci/capability-diff.sh");
  });
});
