import { describe, it, expect } from "vitest";
import { parseAgent, detectConsentDrift } from "./eveAdapter";
import type { RawProject } from "./loadProject";

function raw(files: Record<string, string>): RawProject {
  return { id: "t", files: { "agent.ts": "", "instructions.md": "# Bot\nHi.", ...files } };
}

describe("eveAdapter consent (sidecar is the single source of truth)", () => {
  it("does NOT mark asks-first from source approval alone — that is drift, not fact", () => {
    const project = raw({
      "tools/refund.ts": `import { always } from "eve/tools/approval";
export default defineTool({ description: "Refund an order", approval: always() });`,
    });
    const m = parseAgent(project);
    const c = m.capabilities.find((x) => x.source === "tools/refund.ts");
    // Not rendered as a verified/declared consent fact...
    expect(c?.consent).toBeUndefined();
    // ...but surfaced as drift so the author mirrors it into the sidecar.
    expect(detectConsentDrift(project)).toEqual(["refund"]);
  });

  it("marks asks-first with the human reason from the consent sidecar", () => {
    const project = raw({
      "tools/refund.ts": `import { always } from "eve/tools/approval";
export default defineTool({ description: "Refund an order", approval: always() });`,
      ".aletheia/consent.json": JSON.stringify({
        gated: { refund: "charges the customer's card" },
      }),
    });
    const m = parseAgent(project);
    const c = m.capabilities.find((x) => x.source === "tools/refund.ts");
    expect(c?.consent).toBe("asks-first");
    expect(c?.consentReason).toBe("charges the customer's card");
    // Mirrored in the sidecar → no drift.
    expect(detectConsentDrift(project)).toEqual([]);
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

  it("does not treat the word 'approval' in a description as a gate", () => {
    const project = raw({
      "tools/note.ts": `export default defineTool({ description: "Log an approval: from a manager" });`,
    });
    expect(detectConsentDrift(project)).toEqual([]);
    expect(parseAgent(project).capabilities.find((x) => x.source === "tools/note.ts")?.consent)
      .toBeUndefined();
  });
});
