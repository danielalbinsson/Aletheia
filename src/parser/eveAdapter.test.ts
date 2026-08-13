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

describe("eveAdapter from-source reach (no invented access or @reach)", () => {
  it("lists channels from filename and name/label without defaulting access to read", () => {
    const m = parseAgent(
      raw({
        "channels/slack.ts": `export default defineChannel({ name: "slack" });`,
      }),
    );
    expect(m.reach).toEqual([{ label: "slack", kind: "channel", id: "channels/slack.ts" }]);
    expect(m.reach[0]?.access).toBeUndefined();
  });

  it("does not take access from a channel source field", () => {
    const m = parseAgent(
      raw({
        "channels/mail.ts": `export default defineChannel({ name: "mail", access: "read" });`,
      }),
    );
    expect(m.reach[0]?.access).toBeUndefined();
  });

  it("lists connections from filename without inventing access", () => {
    const m = parseAgent(
      raw({
        "connections/github.ts": `export default defineMcpClientConnection({ description: "GitHub" });`,
      }),
    );
    expect(m.reach).toEqual([{ label: "github", kind: "api", id: "connections/github.ts" }]);
    expect(m.reach[0]?.access).toBeUndefined();
  });

  it("ignores @reach comments and reach: {} blocks on tools", () => {
    const m = parseAgent(
      raw({
        "tools/refund.ts": `// @reach label: Stripe | kind: api | access: read-write
export default defineTool({
  description: "Refund",
  reach: { label: "Stripe", kind: "api", access: "read-write" },
});`,
      }),
    );
    expect(m.reach).toEqual([]);
  });
});

describe("eveAdapter from-source schedules (consent is unknown)", () => {
  it("omits consent rather than defaulting to asks-first", () => {
    const m = parseAgent(
      raw({
        "schedules/nightly.ts": `export default defineSchedule({
  cron: "0 2 * * *",
  markdown: "Reconcile the days entries.",
});`,
      }),
    );
    expect(m.autonomy).toHaveLength(1);
    expect(m.autonomy[0]?.consent).toBeUndefined();
    expect(m.autonomy[0]?.does).toBe("Reconcile the days entries.");
  });

  it("ignores Aletheia-only @consent / consent: fields", () => {
    const m = parseAgent(
      raw({
        "schedules/watch.ts": `// @consent asks-first
export default defineSchedule({
  cron: "*/15 * * * *",
  markdown: "Watch SLAs.",
  consent: "asks-first",
});`,
      }),
    );
    expect(m.autonomy[0]?.consent).toBeUndefined();
  });

  it("parses markdown schedules from frontmatter cron and body", () => {
    const m = parseAgent(
      raw({
        "schedules/cleanup.md": `---
cron: 0 3 * * *
---
Delete expired drafts.
`,
      }),
    );
    expect(m.autonomy).toHaveLength(1);
    expect(m.autonomy[0]?.when).toContain("0 3 * * *");
    expect(m.autonomy[0]?.does).toContain("Delete expired drafts");
    expect(m.autonomy[0]?.consent).toBeUndefined();
  });
});

describe("eveAdapter from-source subagents and channels", () => {
  it("does not treat nested subagent tools as additional delegations", () => {
    const m = parseAgent(
      raw({
        "subagents/auditor/agent.ts": `export default defineAgent({ name: "auditor", description: "Audits." });`,
        "subagents/auditor/tools/run-axe.ts": `export default defineTool({ name: "run_axe", description: "Run axe" });`,
      }),
    );
    expect(m.subagents.map((s) => s.name)).toEqual(["Auditor"]);
    expect(m.capabilities.filter((c) => c.origin === "subagent")).toHaveLength(1);
    expect(m.capabilities.some((c) => c.source.includes("run-axe"))).toBe(false);
  });

  it("skips disableRoute() channels and uses path identity, not username", () => {
    const m = parseAgent(
      raw({
        "channels/slack.ts": `export default defineChannel({ username: "bot-user" });`,
        "channels/old-hook.ts": `export default disableRoute();`,
      }),
    );
    expect(m.reach).toEqual([{ label: "slack", kind: "channel", id: "channels/slack.ts" }]);
  });
});
