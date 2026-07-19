import { describe, it, expect } from "vitest";
import {
  mapManifest,
  applyManifest,
  summarizeInputs,
  manifestRestrictionWarning,
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
  disabledFrameworkTools: ["bash", "write_file"],
};

describe("mapManifest", () => {
  const facts = mapManifest(manifest);

  it("maps the model id from config", () => {
    expect(facts.runsOn).toBe("openrouter/anthropic/claude-sonnet-4");
  });

  it("captures the behavior levers (model + instructions hash) as mind", () => {
    expect(facts.mind?.model).toBe("openrouter/anthropic/claude-sonnet-4");
    const withInstr = mapManifest({ ...manifest, instructions: { markdown: "# Beacon\nBe kind." } });
    const changed = mapManifest({ ...manifest, instructions: { markdown: "# Beacon\nBe ruthless." } });
    expect(withInstr.mind?.instructionsHash).toBeDefined();
    expect(withInstr.mind?.instructionsHash).not.toBe(changed.mind?.instructionsHash);
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

  it("recurses into nested subagent manifests for model, tools, and reach", () => {
    const orchestrator: CompiledManifest = {
      config: { name: "design-qa-agent", model: { id: "openrouter/anthropic/claude-sonnet-4.6" } },
      tools: [],
      connections: [
        { connectionName: "github", description: "PR metadata", protocol: "openapi", url: "https://api.github.com" },
      ],
      subagents: [
        {
          name: "a11y-auditor",
          description: "Runs axe-core audits.",
          agent: {
            config: { name: "a11y-auditor", description: "Runs axe-core audits.", model: { id: "openrouter/anthropic/claude-3.5-haiku" } },
            tools: [{ name: "run_axe", description: "Run an accessibility audit.", logicalPath: "tools/run-axe.ts" }],
            connections: [],
          },
        },
      ],
    };
    const f = mapManifest(orchestrator);
    // Root owns nothing; the subagent carries the real surface.
    expect(f.capabilities).toHaveLength(0);
    expect(f.subagents).toHaveLength(1);
    const sub = f.subagents[0];
    expect(sub.name).toBe("A11y auditor");
    expect(sub.runsOn).toBe("openrouter/anthropic/claude-3.5-haiku");
    expect(sub.capabilities.map((c) => c.label)).toContain("Run axe");
  });

  it("maps disabledFrameworkTools to plain-language restrictions", () => {
    expect(facts.restrictions).toEqual([
      { tool: "bash", label: "run shell commands" },
      { tool: "write_file", label: "write files" },
    ]);
  });

  it("humanizes an unknown disabled tool rather than dropping it", () => {
    const f = mapManifest({ disabledFrameworkTools: ["some_custom_tool"] });
    expect(f.restrictions).toEqual([
      { tool: "some_custom_tool", label: "some custom tool" },
    ]);
  });

  it("reports no restrictions when none are disabled", () => {
    expect(mapManifest({ tools: [] }).restrictions).toEqual([]);
  });

  it("falls back to the slim top-level subagent name when no nested manifest", () => {
    const f = mapManifest({ subagents: [{ name: "auditor" }] });
    expect(f.subagents).toEqual([
      { name: "Auditor", description: undefined, runsOn: undefined, capabilities: [], reach: [] },
    ]);
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
    restrictions: [],
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

  it("overlays verified restrictions onto the model", () => {
    const merged = applyManifest(base, mapManifest(manifest));
    expect(merged.restrictions.map((r) => r.tool)).toEqual(["bash", "write_file"]);
  });

  it("carries source-declared consent onto the matching verified capability", () => {
    const gatedBase: AgentModel = {
      ...base,
      capabilities: [
        {
          label: "Draft reply",
          detail: "",
          origin: "tool",
          source: "tools/draft-reply.ts",
          consent: "asks-first",
          consentReason: "sends a message to the customer",
        },
      ],
    };
    const merged = applyManifest(gatedBase, mapManifest(manifest));
    const draft = merged.capabilities.find((c) => c.source === "tools/draft-reply.ts");
    // Existence/label/schema stay manifest-verified; consent comes from source.
    expect(draft?.takes).toContain("conversationid");
    expect(draft?.consent).toBe("asks-first");
    expect(draft?.consentReason).toBe("sends a message to the customer");
    // Ungated verified tools are untouched.
    expect(
      merged.capabilities.find((c) => c.source === "tools/search-docs.ts")?.consent,
    ).toBeUndefined();
  });
});

describe("summarizeInputs", () => {
  it("returns undefined for empty/absent schema", () => {
    expect(summarizeInputs(undefined)).toBeUndefined();
    expect(summarizeInputs({ type: "object", properties: {} })).toBeUndefined();
  });
});

describe("manifestRestrictionWarning (silent-absence guard)", () => {
  it("warns when a manifest has tools but no disabledFrameworkTools field", () => {
    const m: CompiledManifest = { tools: [{ name: "bash", description: "" }] };
    expect(manifestRestrictionWarning(m)).toMatch(/restriction data may be missing/i);
  });

  it("no warning for an explicit empty list (a real 'nothing disabled' fact)", () => {
    const m: CompiledManifest = {
      tools: [{ name: "bash", description: "" }],
      disabledFrameworkTools: [],
    };
    expect(manifestRestrictionWarning(m)).toBeNull();
  });

  it("no warning when there are no tools at all", () => {
    expect(manifestRestrictionWarning({})).toBeNull();
  });
});
