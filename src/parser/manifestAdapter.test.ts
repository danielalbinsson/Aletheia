import { describe, it, expect } from "vitest";
import {
  mapManifest,
  applyManifest,
  summarizeInputs,
  manifestRestrictionWarning,
  sandboxPortraitLine,
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

  it("does not invent extra compiled fields when they are absent", () => {
    expect(facts.sandbox).toBeUndefined();
    expect(facts.delegation).toBeUndefined();
    expect(facts.reach.find((r) => r.label === "intercom")?.detail).toBe(
      "OPENAPI · https://api.intercom.io",
    );
    expect(facts.reach.find((r) => r.label === "intercom")?.access).toBeUndefined();
    expect(JSON.stringify(facts)).not.toMatch(/oauth/i);
    expect(JSON.stringify(facts)).not.toMatch(/evals/i);
    expect(JSON.stringify(facts)).not.toMatch(/env var/i);
  });
});

describe("mapManifest extra compiled fields (eve 0.18.2)", () => {
  it("maps subagentEdges to named parent→child delegation", () => {
    const f = mapManifest({
      config: { name: "design-qa-agent" },
      subagents: [
        {
          nodeId: "sub:a11y",
          name: "a11y-auditor",
          agent: { config: { name: "a11y-auditor" } },
        },
      ],
      subagentEdges: [{ parentNodeId: "__root__", childNodeId: "sub:a11y" }],
    });
    expect(f.delegation).toEqual([
      { parent: "design-qa-agent", child: "A11y auditor", parentId: "__root__", childId: "sub:a11y" },
    ]);
  });

  it("keeps compiled node ids when a subagent has no nodeId to resolve", () => {
    const f = mapManifest({
      subagentEdges: [{ parentNodeId: "__root__", childNodeId: "missing" }],
    });
    expect(f.delegation).toEqual([{ parent: "root", child: "missing", parentId: "__root__", childId: "missing" }]);
  });

  it("treats an explicit empty subagentEdges list as a verified empty graph", () => {
    expect(mapManifest({ subagentEdges: [] }).delegation).toEqual([]);
  });

  it("maps sandbox object as present and workspace count, not scores", () => {
    const f = mapManifest({
      sandbox: { logicalPath: "sandbox.ts", backendName: "native" },
      sandboxWorkspaces: [{ logicalPath: "sandbox/workspace" }, { logicalPath: "sandbox/other" }],
    });
    expect(f.sandbox).toEqual({ present: true, workspaceCount: 2 });
    expect(sandboxPortraitLine(f.sandbox!)).toBe(
      "An authored sandbox is configured. 2 sandbox workspace folders.",
    );
  });

  it("maps sandbox: null as present: false", () => {
    const f = mapManifest({ sandbox: null, sandboxWorkspaces: [] });
    expect(f.sandbox).toEqual({ present: false, workspaceCount: 0 });
    expect(sandboxPortraitLine(f.sandbox!)).toContain("No authored sandbox is configured.");
  });

  it("puts channel adapterKind on reach detail and skips disabled routes", () => {
    const f = mapManifest({
      channels: [
        { name: "eve", kind: "channel", adapterKind: "http" },
        { name: "slack", kind: "channel", adapterKind: "slack", logicalPath: "channels/slack.ts" },
        { name: "old-hook", kind: "disabled", logicalPath: "channels/old-hook.ts" },
      ],
    });
    expect(f.reach).toEqual([{ label: "slack", kind: "channel", detail: "slack", id: "channels/slack.ts" }]);
  });

  it("leaves channel detail unset when adapterKind is absent", () => {
    const f = mapManifest({
      channels: [{ name: "slack", logicalPath: "channels/slack.ts" }],
    });
    expect(f.reach).toEqual([{ label: "slack", kind: "channel", id: "channels/slack.ts" }]);
  });

  it("appends vercelConnect.connector and does not invent OAuth scopes or read/write", () => {
    const f = mapManifest({
      connections: [
        {
          connectionName: "linear",
          protocol: "mcp",
          url: "https://mcp.linear.app",
          vercelConnect: { connector: "oauth/mcp-linear-app" },
        },
      ],
    });
    const linear = f.reach[0];
    expect(linear.access).toBeUndefined();
    expect(linear.detail).toBe("MCP · https://mcp.linear.app · Vercel Connect (oauth/mcp-linear-app)");
    expect(linear.detail).not.toMatch(/scope/i);
    expect(linear.detail).not.toMatch(/read-write|read\/write/i);
  });

  it("ignores evals and required-env keys that eve does not serialize on the compiled manifest", () => {
    const withUnknown = {
      tools: [{ name: "ping", description: "" }],
      evals: [{ name: "accuracy", score: 0.99 }],
      requiredEnv: ["OPENAI_API_KEY"],
    } as CompiledManifest & { evals: unknown; requiredEnv: unknown };
    const f = mapManifest(withUnknown);
    expect(f).not.toHaveProperty("evals");
    expect(f).not.toHaveProperty("requiredEnv");
    expect(f.sandbox).toBeUndefined();
    expect(JSON.stringify(f)).not.toMatch(/OPENAI_API_KEY/);
    expect(JSON.stringify(f)).not.toMatch(/accuracy/);
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

  it("overlays verified sandbox and delegation from the manifest", () => {
    const merged = applyManifest(
      base,
      mapManifest({
        sandbox: { logicalPath: "sandbox.ts" },
        subagents: [{ nodeId: "sub:a", name: "auditor" }],
        subagentEdges: [{ parentNodeId: "__root__", childNodeId: "sub:a" }],
      }),
    );
    expect(merged.sandbox).toEqual({ present: true });
    expect(merged.delegation).toEqual([{ parent: "root", child: "Auditor", parentId: "__root__", childId: "sub:a" }]);
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
