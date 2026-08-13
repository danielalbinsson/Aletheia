import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  applyConsent,
  driftWarnings,
  gitSnapshotRelPath,
  parseArgs,
  resolveBaseline,
  SNAPSHOT_REL,
} from "./cliCore";
import type { ManifestFacts } from "../parser/manifestAdapter";
import type { CapabilitySnapshot } from "../parser/capabilityDiff";

const execFileAsync = promisify(execFile);

const baseFacts: ManifestFacts = {
  capabilities: [
    {
      label: "Draft reply",
      detail: "",
      origin: "tool",
      source: "tools/draft-reply.ts",
    },
    {
      label: "Search docs",
      detail: "",
      origin: "tool",
      source: "tools/search-docs.ts",
    },
  ],
  reach: [],
  autonomy: [],
  restrictions: [],
  subagents: [],
};

describe("parseArgs", () => {
  it("defaults to file baseline, elevated fail-on, and build on", () => {
    const o = parseArgs([], "/tmp/agent");
    expect(o.baseline).toBe(`file:${SNAPSHOT_REL}`);
    expect(o.failOn).toBe("elevated");
    expect(o.failOnExplicit).toBe(false);
    expect(o.build).toBe(true);
    expect(o.format).toBe("markdown");
    expect(o.agentDir).toBe("/tmp/agent");
  });

  it("parses flags", () => {
    const o = parseArgs(
      [
        "--baseline",
        "git:main",
        "--format",
        "json",
        "--fail-on",
        "never",
        "--no-build",
        "--out",
        "diff.md",
        "--agent-dir",
        "examples/ledger",
      ],
      "/repo"
    );
    expect(o.baseline).toBe("git:main");
    expect(o.format).toBe("json");
    expect(o.failOn).toBe("never");
    expect(o.failOnExplicit).toBe(true);
    expect(o.build).toBe(false);
    expect(o.out).toBe("diff.md");
    expect(o.agentDir).toBe(path.resolve("/repo", "examples/ledger"));
  });
});

describe("applyConsent", () => {
  it("marks gated tools as asks-first with the sidecar reason", () => {
    const next = applyConsent(baseFacts, {
      "draft-reply": "Customer-facing send — irreversible.",
    });
    expect(next.capabilities[0].consent).toBe("asks-first");
    expect(next.capabilities[0].consentReason).toBe("Customer-facing send — irreversible.");
    expect(next.capabilities[1].consent).toBeUndefined();
  });

  it("is a no-op when the gated map is empty", () => {
    expect(applyConsent(baseFacts, {})).toEqual(baseFacts);
  });
});

describe("driftWarnings", () => {
  it("returns [] when nothing drifted", () => {
    expect(driftWarnings([])).toEqual([]);
  });

  it("names drifted tools and the consent sidecar path", () => {
    const w = driftWarnings(["draft-reply", "route-ticket"]);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("`draft-reply`");
    expect(w[0]).toContain("`route-ticket`");
    expect(w[0]).toContain("agent/.aletheia/consent.json");
  });
});

describe("gitSnapshotRelPath", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-cli-git-"));
    await execFileAsync("git", ["init"], { cwd: root });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: root });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("returns agent-relative path at repo root", async () => {
    const agent = root;
    expect(await gitSnapshotRelPath(agent)).toBe(SNAPSHOT_REL);
  });

  it("prefixes nested agent dirs from the git toplevel", async () => {
    const nested = path.join(root, "examples", "ledger");
    await fs.mkdir(nested, { recursive: true });
    expect(await gitSnapshotRelPath(nested)).toBe(
      "examples/ledger/agent/.aletheia/deployed-capabilities.json"
    );
  });
});

describe("resolveBaseline", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-cli-base-"));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("loads a file: baseline", async () => {
    const snap: CapabilitySnapshot = {
      capturedAt: "2026-07-26T00:00:00.000Z",
      name: "fixture",
      capabilities: [],
      reach: [],
      autonomy: [],
      subagents: [],
      restrictions: [],
    };
    const file = path.join(root, "baseline.json");
    await fs.writeFile(file, JSON.stringify(snap));
    const loaded = await resolveBaseline(`file:${file}`, root);
    expect(loaded?.name).toBe("fixture");
  });

  it("returns null for a missing file baseline", async () => {
    expect(await resolveBaseline("file:missing.json", root)).toBeNull();
  });

  it("loads a git: baseline from a nested agent path", async () => {
    await execFileAsync("git", ["init"], { cwd: root });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: root });

    const nested = path.join(root, "examples", "ledger");
    const snapPath = path.join(nested, SNAPSHOT_REL);
    await fs.mkdir(path.dirname(snapPath), { recursive: true });
    const snap: CapabilitySnapshot = {
      capturedAt: "2026-07-26T00:00:00.000Z",
      name: "ledger",
      capabilities: [{ source: "tools/search-docs.ts", label: "Search docs" }],
      reach: [],
      autonomy: [],
      subagents: [],
      restrictions: [],
    };
    await fs.writeFile(snapPath, JSON.stringify(snap));
    await execFileAsync("git", ["add", "."], { cwd: root });
    await execFileAsync("git", ["commit", "-m", "baseline"], { cwd: root });

    const loaded = await resolveBaseline("git:HEAD", nested);
    expect(loaded?.name).toBe("ledger");
    expect(loaded?.capabilities[0]?.label).toBe("Search docs");
  });

  it("rejects unsupported baseline schemes", async () => {
    await expect(resolveBaseline("url:https://example.com", root)).rejects.toThrow(/Unsupported/);
  });
});
