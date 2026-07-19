import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  isEveWorkspace,
  readAgentName,
  discoverAgents,
  expandHome,
} from "./workspaceRegistry";

let root: string;

async function makeAgent(dir: string, name?: string) {
  await fs.mkdir(path.join(dir, "agent"), { recursive: true });
  const body = name ? `defineAgent({ name: "${name}" })` : `defineAgent({})`;
  await fs.writeFile(path.join(dir, "agent", "agent.ts"), body, "utf8");
}

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "aletheia-ws-"));
  // Two real agents at different depths.
  await makeAgent(path.join(root, "alpha"), "Alpha Bot");
  await makeAgent(path.join(root, "nested", "beta")); // no name → folder name
  // A non-agent folder and skip-listed dirs that should be ignored.
  await fs.mkdir(path.join(root, "not-an-agent", "src"), { recursive: true });
  await makeAgent(path.join(root, "node_modules", "pkg")); // skipped
  await makeAgent(path.join(root, ".hidden", "gamma")); // hidden → skipped
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("isEveWorkspace", () => {
  it("true only when agent/agent.ts exists", async () => {
    expect(await isEveWorkspace(path.join(root, "alpha"))).toBe(true);
    expect(await isEveWorkspace(path.join(root, "not-an-agent"))).toBe(false);
  });
});

describe("readAgentName", () => {
  it("prefers the declared name, falls back to folder name", async () => {
    expect(await readAgentName(path.join(root, "alpha"))).toBe("Alpha Bot");
    expect(await readAgentName(path.join(root, "nested", "beta"))).toBe("beta");
  });
});

describe("discoverAgents", () => {
  it("finds agents at depth, skipping node_modules and hidden dirs", async () => {
    const found = await discoverAgents(root);
    const names = found.map((a) => a.name).sort();
    expect(names).toEqual(["Alpha Bot", "beta"]);
    // Nothing from node_modules or .hidden.
    expect(found.some((a) => a.path.includes("node_modules"))).toBe(false);
    expect(found.some((a) => a.path.includes(".hidden"))).toBe(false);
  });

  it("does not recurse into an agent workspace", async () => {
    // agent/ under alpha must not be reported as its own workspace.
    const found = await discoverAgents(path.join(root, "alpha"));
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe(path.join(root, "alpha"));
  });

  it("respects the depth cap", async () => {
    expect(await discoverAgents(root, 0)).toEqual([]); // agents are 1+ deep
  });
});

describe("expandHome", () => {
  it("expands a leading ~", () => {
    expect(expandHome("~")).toBe(os.homedir());
    expect(expandHome("~/x")).toBe(path.join(os.homedir(), "x"));
    expect(expandHome("/abs/path")).toBe("/abs/path");
  });
});
