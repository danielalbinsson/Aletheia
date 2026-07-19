import { describe, it, expect } from "vitest";
import {
  stripCodeComments,
  hasDisableTool,
  hasApprovalGate,
  consentDrift,
} from "./sourceScan";

describe("stripCodeComments", () => {
  it("removes line and block comments", () => {
    expect(stripCodeComments("a // b\nc")).toBe("a \nc");
    expect(stripCodeComments("a /* b\nc */ d")).toBe("a   d");
  });

  it("does not eat the // in a url string", () => {
    expect(stripCodeComments(`const u = "https://x.dev";`)).toContain("https://x.dev");
  });
});

describe("hasDisableTool", () => {
  it("detects a live disableTool() call", () => {
    expect(hasDisableTool(`export default disableTool("bash");`)).toBe(true);
  });

  it("ignores a commented-out disableTool()", () => {
    expect(hasDisableTool(`// disableTool("bash");`)).toBe(false);
    expect(hasDisableTool(`/* disableTool("bash") */`)).toBe(false);
  });
});

describe("hasApprovalGate", () => {
  it("detects the eve call form approval: always()", () => {
    expect(hasApprovalGate(`defineTool({ approval: always() })`)).toBe(true);
    expect(hasApprovalGate(`defineTool({ approval: requireApproval() })`)).toBe(true);
  });

  it("ignores the word approval in prose/descriptions", () => {
    expect(hasApprovalGate(`{ description: "needs manager approval: yes" }`)).toBe(false);
    expect(hasApprovalGate(`{ description: "approval workflow" }`)).toBe(false);
  });

  it("ignores a commented-out gate", () => {
    expect(hasApprovalGate(`// approval: always()`)).toBe(false);
  });
});

describe("consentDrift", () => {
  it("flags a source gate missing from the sidecar", () => {
    const sources = {
      refund: `defineTool({ approval: always() })`,
      lookup: `defineTool({})`,
    };
    expect(consentDrift(sources, {})).toEqual(["refund"]);
  });

  it("no drift when the gate is mirrored in the sidecar", () => {
    const sources = { refund: `defineTool({ approval: always() })` };
    expect(consentDrift(sources, { refund: "charges the card" })).toEqual([]);
  });

  it("returns a sorted list", () => {
    const sources = {
      zeta: `approval: always()`,
      alpha: `approval: always()`,
    };
    expect(consentDrift(sources, {})).toEqual(["alpha", "zeta"]);
  });
});
