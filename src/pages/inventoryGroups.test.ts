import { describe, expect, it } from "vitest";
import {
  delegateDisplayName,
  executeAndReachHeading,
  groupCapabilities,
  isDelegateCap,
  isWriteOrShellCap,
} from "./inventoryGroups";

describe("inventoryGroups", () => {
  it("splits delegates from write/shell using origin and known slugs", () => {
    const grouped = groupCapabilities([
      { label: "Delegates to A11y Auditor", origin: "subagent", source: "subagents/a11y/agent.ts" },
      { label: "Bash", origin: "tool", source: "tools/bash.ts" },
      { label: "Write file", origin: "tool", source: "tools/write_file.ts" },
      { label: "Search docs", origin: "tool", source: "tools/search-docs.ts" },
    ]);
    expect(grouped.delegates.map((c) => c.label)).toEqual(["Delegates to A11y Auditor"]);
    expect(grouped.writeShell.map((c) => c.label)).toEqual(["Bash", "Write file"]);
    expect(grouped.other.map((c) => c.label)).toEqual(["Search docs"]);
  });

  it("treats snapshot rows without origin as delegates when the label says so", () => {
    expect(isDelegateCap({ label: "Delegates to Heuristic Critic", source: "subagents/h.ts" })).toBe(
      true
    );
    expect(isWriteOrShellCap({ label: "Edit file", source: "edit_file" })).toBe(true);
    expect(isWriteOrShellCap({ label: "Search docs", source: "tools/search-docs.ts" })).toBe(false);
  });

  it("strips the Delegates to prefix for display under that heading", () => {
    expect(delegateDisplayName("Delegates to A11y Auditor")).toBe("A11y Auditor");
  });

  it("names the execute list from what is actually present", () => {
    expect(executeAndReachHeading(2, 2)).toBe("Write, shell, and reach");
    expect(executeAndReachHeading(1, 0)).toBe("Write and shell");
    expect(executeAndReachHeading(0, 1)).toBe("Reach");
  });
});
