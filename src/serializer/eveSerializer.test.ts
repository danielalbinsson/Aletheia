import { describe, it, expect } from "vitest";
import { parseAgent } from "../parser/eveAdapter";
import { loadRawProject } from "../parser/loadProject";
import {
  createBlankProject,
  updateAgentFile,
  updateIdentity,
  addEntity,
  rebuildAgentTs,
  validateProject,
} from "./eveSerializer";
import { DEFAULT_OPENROUTER_MODEL_ID } from "./openRouterAgent";

describe("eveSerializer", () => {
  it("creates a valid blank project", () => {
    const raw = createBlankProject({ name: "Test Agent" });
    const issues = validateProject(raw);
    expect(issues).toEqual([]);
    expect(raw.files["agent.ts"]).toContain("createOpenRouter");
    expect(raw.files["agent.ts"]).toContain(DEFAULT_OPENROUTER_MODEL_ID);
    expect(raw.files["tools/example.ts"]).toContain("defineTool");
    expect(raw.files["instructions.md"]).toContain("# Test Agent");
  });

  it("round-trips workspace identity fields", () => {
    const project = loadRawProject();
    expect(project).toBeTruthy();

    const updated = updateIdentity(project!, {
      name: "Margaux Updated",
    });
    const rebuilt = rebuildAgentTs(updated);
    const parsed = parseAgent(rebuilt);

    expect(parsed.name).toBe("Margaux Updated");
    expect(rebuilt.files["instructions.md"]).toContain("# Margaux Updated");
    expect(rebuilt.files["tools/read-inbox.ts"]).toBe(
      project!.files["tools/read-inbox.ts"]
    );
  });

  it("preserves tool file body on update", () => {
    const raw = createBlankProject();
    const customRun = `import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Custom tool.",
  inputSchema: z.object({ x: z.number() }),
  async execute({ x }) {
    return { x: x * 2 };
  },
});
`;
    const updated = updateAgentFile(raw, "tools/example.ts", customRun);
    expect(updated.files["tools/example.ts"]).toContain("x * 2");
    expect(updated.files["agent.ts"]).toContain("createOpenRouter");
  });

  it("adds entity files to the project", () => {
    let raw = createBlankProject();
    raw = addEntity(raw, "channels", "slack", "Slack");
    raw = addEntity(raw, "schedules", "daily-check");

    expect(raw.files["channels/slack.ts"]).toBeTruthy();
    expect(raw.files["schedules/daily-check.ts"]).toBeTruthy();
    expect(raw.files["channels/slack.ts"]).toContain("defineChannel");
  });
});
