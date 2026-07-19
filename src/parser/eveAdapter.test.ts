import { describe, it, expect } from "vitest";
import { parseAgent } from "./eveAdapter";
import type { RawProject } from "./loadProject";

function raw(files: Record<string, string>): RawProject {
  return { id: "t", files: { "agent.ts": "", "instructions.md": "# Bot\nHi.", ...files } };
}

describe("eveAdapter consent (source-declared approval)", () => {
  it("marks a tool asks-first from an approval: field in source", () => {
    const m = parseAgent(
      raw({
        "tools/refund.ts": `import { always } from "eve/tools/approval";
export default defineTool({ description: "Refund an order", approval: always() });`,
      }),
    );
    const c = m.capabilities.find((x) => x.source === "tools/refund.ts");
    expect(c?.consent).toBe("asks-first");
    expect(c?.consentReason).toBeUndefined();
  });

  it("adds the human reason from the consent sidecar", () => {
    const m = parseAgent(
      raw({
        "tools/refund.ts": `export default defineTool({ description: "Refund an order" });`,
        ".aletheia/consent.json": JSON.stringify({
          gated: { refund: "charges the customer's card" },
        }),
      }),
    );
    const c = m.capabilities.find((x) => x.source === "tools/refund.ts");
    expect(c?.consent).toBe("asks-first");
    expect(c?.consentReason).toBe("charges the customer's card");
  });

  it("leaves ungated tools without consent", () => {
    const m = parseAgent(
      raw({ "tools/lookup.ts": `export default defineTool({ description: "Look up an order" });` }),
    );
    expect(m.capabilities.find((x) => x.source === "tools/lookup.ts")?.consent).toBeUndefined();
  });

  it("ignores a malformed sidecar rather than throwing", () => {
    const m = parseAgent(
      raw({
        "tools/refund.ts": `export default defineTool({ description: "Refund" });`,
        ".aletheia/consent.json": "{ not valid json",
      }),
    );
    expect(m.capabilities.find((x) => x.source === "tools/refund.ts")?.consent).toBeUndefined();
  });
});
