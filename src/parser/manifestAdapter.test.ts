import { describe, it, expect } from "vitest";
import {
  mapManifest,
  applyManifest,
  summarizeInputs,
  type CompiledManifest,
} from "./manifestAdapter";
import type { AgentModel } from "../model";

// Mirrors the real .eve/compile/compiled-agent-manifest.json shape (verified
// live against eve 0.15.5 with the beacon example).
const manifest: CompiledManifest = {
  config: { model: { id: "openrouter/anthropic/claude-sonnet-4" }, description: "Support agent" },
  tools: [
    {
      name: "draft-reply",
      description: "Write and send a reply to the customer.",
      logicalPath: "tools/draft-reply.ts",
      inputSchema: {
        type: "object",
        properties: { conversationId: { type: "string" }, text: { type: "string" } },
        required: ["conversationId", "text"],
      },
    },
    { name: "search-docs", description: "Search the help center.", logicalPath: "tools/search-docs.ts" },
  ],
  skills: [{ name: "tone", description: "Match the house voice.", logicalPath: "skills/tone/SKILL.md" }],
  connections: [
    { connectionName: "intercom", description: "Customer messaging", protocol: "openapi", url: "https://api.intercom.io", logicalPath: "connections/intercom.ts" },
    { connectionName: "slack", description: "Posts to Slack", protocol: "mcp", url: "https://mcp.slack.com", logicalPath: "connections/slack.ts" },
  ],
  channels: [],
  schedules: [{ name: "sla-watch", cron: "*/15 * * * *", markdown: "Warn about SLA breaches.", hasRun: false }],
  subagents: [],
};

describe("mapManifest", () => {
  const facts = mapManifest(manifest);

  it("maps the model id from config", () => {
    expect(facts.runsOn).toBe("openrouter/anthropic/claude-sonnet-4");
  });

  it("maps tools and skills to capabilities (no approval field)", () => {
    const draft = facts.capabilities.find((c) => c.source === "tools/draft-reply.ts");
    expect(draft?.origin).toBe("tool");
    expect(draft).not.toHaveProperty("requiresApproval");
    const skill = facts.capabilities.find((c) => c.origin === "skill");
    expect(skill?.label).toBe("Tone");
  });

  it("summarizes input schema in plain language", () => {
    const draft = facts.capabilities.find((c) => c.source === "tools/draft-reply.ts");
    expect(draft?.takes).toContain("conversationid (string)");
  });

  it("maps connections to reach with protocol/url detail and no fabricated access", () => {
    const conn = facts.reach.find((r) => r.label === "intercom");
    expect(conn?.kind).toBe("api");
    expect(conn?.access).toBeUndefined();
    expect(conn?.detail).toBe("OPENAPI · https://api.intercom.io");
    expect(facts.reach.find((r) => r.label === "slack")?.detail).toContain("MCP");
  });

  it("dedupes channels by name and skips the built-in eve chat endpoint", () => {
    const f = mapManifest({
      channels: [
        { name: "eve", logicalPath: "channels/eve.ts" },
        { name: "eve", logicalPath: "channels/eve.ts" },
        { name: "eve", logicalPath: "channels/eve.ts" },
        { name: "slack", logicalPath: "channels/slack.ts" },
        { name: "slack", logicalPath: "channels/slack.ts" },
      ],
    });
    const channels = f.reach.filter((r) => r.kind === "channel");
    expect(channels.map((c) => c.label)).toEqual(["slack"]);
  });

  it("maps schedules to acts-on-its-own autonomy", () => {
    expect(facts.autonomy).toHaveLength(1);
    expect(facts.autonomy[0].consent).toBe("acts-on-its-own");
    expect(facts.autonomy[0].when).toContain("*/15");
  });
});

describe("applyManifest", () => {
  const base: AgentModel = {
    id: "beacon",
    name: "Beacon",
    runsOn: "old",
    intro: "Narrative intro.",
    essence: "Essence.",
    domain: [],
    motif: "hearth",
    theme: {} as AgentModel["theme"],
    capabilities: [{ label: "Old", detail: "", origin: "tool", source: "tools/old.ts" }],
    reach: [{ label: "Guess", kind: "data", access: "read" }],
    autonomy: [],
    subagents: [],
  };

  it("overlays trust facts, keeps narrative identity", () => {
    const merged = applyManifest(base, mapManifest(manifest));
    expect(merged.intro).toBe("Narrative intro.");
    expect(merged.motif).toBe("hearth");
    expect(merged.runsOn).toBe("openrouter/anthropic/claude-sonnet-4");
    expect(merged.reach.some((r) => r.label === "intercom")).toBe(true);
    expect(merged.reach.some((r) => r.label === "Guess")).toBe(false);
  });

  it("lets a verified-empty manifest overwrite guessed facts", () => {
    const merged = applyManifest(base, mapManifest({ tools: [], connections: [] }));
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
