import { describe, it, expect } from "vitest";
import {
  mapAgentInfo,
  applyAgentInfo,
  summarizeInputs,
  type AgentInfo,
} from "./eveInfoAdapter";
import type { AgentModel } from "../model";

// Mirrors the real `eve info --json` (AgentInfoResponse) shape for an agent
// with a connection, an approval-gated tool, a plain tool, a skill, and an
// autonomous schedule.
const sample: AgentInfo = {
  agent: { name: "Beacon", description: "Support agent", model: { id: "anthropic/claude-sonnet-4" } },
  tools: {
    authored: [
      {
        name: "draft-reply",
        description: "Write and send a reply to the customer.",
        logicalPath: "tools/draft-reply.ts",
        requiresApproval: true,
        inputSchema: {
          type: "object",
          properties: { text: { type: "string", description: "Reply body" } },
          required: ["text"],
        },
      },
      {
        name: "search-docs",
        description: "Search the help center.",
        logicalPath: "tools/search-docs.ts",
        requiresApproval: false,
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" }, limit: { type: "number" } },
          required: ["query"],
        },
      },
    ],
  },
  connections: [
    {
      connectionName: "intercom",
      description: "Customer messaging",
      protocol: "openapi",
      url: "https://api.intercom.io",
      hasAuthorization: true,
    },
  ],
  channels: { authored: [{ name: "slack", logicalPath: "channels/slack.ts" }] },
  schedules: [
    { name: "sla-watch", cron: "*/15 * * * *", markdown: "Warn about SLA breaches.", hasRun: false },
  ],
  skills: { static: [{ name: "tone", description: "Match the house voice." }] },
  subagents: { local: [{ name: "auditor" }] },
};

describe("mapAgentInfo", () => {
  const facts = mapAgentInfo(sample);

  it("carries identity from the agent block", () => {
    expect(facts.name).toBe("Beacon");
    expect(facts.runsOn).toBe("anthropic/claude-sonnet-4");
  });

  it("maps tools and skills to capabilities with approval booleans", () => {
    const draft = facts.capabilities.find((c) => c.source === "tools/draft-reply.ts");
    expect(draft?.requiresApproval).toBe(true);
    expect(draft?.origin).toBe("tool");

    const search = facts.capabilities.find((c) => c.source === "tools/search-docs.ts");
    expect(search?.requiresApproval).toBe(false);

    const skill = facts.capabilities.find((c) => c.origin === "skill");
    expect(skill?.label).toBe("Tone");
    // skills have no approval signal
    expect(skill?.requiresApproval).toBeUndefined();
  });

  it("summarizes input schema in plain language", () => {
    const search = facts.capabilities.find((c) => c.source === "tools/search-docs.ts");
    expect(search?.takes).toContain("query (string)");
    expect(search?.takes).toContain("limit (number) — optional");
  });

  it("maps connections + channels to agent-level reach", () => {
    const conn = facts.reach.find((r) => r.label === "intercom");
    expect(conn?.kind).toBe("api");
    expect(conn?.detail).toBe("OPENAPI · authenticated");

    const channel = facts.reach.find((r) => r.kind === "channel");
    expect(channel?.label).toBe("slack");
  });

  it("maps schedules to autonomy", () => {
    expect(facts.autonomy).toHaveLength(1);
    expect(facts.autonomy[0].consent).toBe("acts-on-its-own");
    expect(facts.autonomy[0].when).toContain("*/15");
  });

  it("maps subagents", () => {
    expect(facts.subagents).toEqual(["Auditor"]);
  });
});

describe("applyAgentInfo", () => {
  const base: AgentModel = {
    id: "beacon",
    name: "Base Name",
    runsOn: "old/model",
    intro: "I am the narrative intro.",
    essence: "Narrative essence.",
    domain: ["support"],
    motif: "hearth",
    theme: {} as AgentModel["theme"],
    capabilities: [{ label: "Old", detail: "", origin: "tool", source: "tools/old.ts" }],
    reach: [{ label: "Guess", kind: "data", access: "read" }],
    autonomy: [],
    subagents: [],
  };

  it("overlays trust facts but keeps narrative identity", () => {
    const merged = applyAgentInfo(base, mapAgentInfo(sample));
    // narrative stays from base
    expect(merged.intro).toBe("I am the narrative intro.");
    expect(merged.motif).toBe("hearth");
    // trust facts replaced by manifest
    expect(merged.name).toBe("Beacon");
    expect(merged.runsOn).toBe("anthropic/claude-sonnet-4");
    expect(merged.reach.some((r) => r.label === "intercom")).toBe(true);
    expect(merged.reach.some((r) => r.label === "Guess")).toBe(false);
  });

  it("lets a verified-empty manifest overwrite guessed facts", () => {
    const empty = mapAgentInfo({ agent: { name: "Quiet" } });
    const merged = applyAgentInfo(base, empty);
    expect(merged.reach).toEqual([]);
    expect(merged.capabilities).toEqual([]);
  });
});

describe("summarizeInputs", () => {
  it("returns undefined for empty/absent schema", () => {
    expect(summarizeInputs(undefined)).toBeUndefined();
    expect(summarizeInputs({ type: "object", properties: {} })).toBeUndefined();
  });
});
