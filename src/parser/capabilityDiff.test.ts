import { describe, it, expect } from "vitest";
import {
  snapshotFromModel,
  snapshotFromFacts,
  diffSnapshots,
  type CapabilitySnapshot,
} from "./capabilityDiff";
import type { AgentModel } from "../model";

function model(over: Partial<AgentModel> = {}): AgentModel {
  return {
    id: "beacon",
    name: "Beacon",
    intro: "",
    essence: "",
    domain: [],
    motif: "hearth",
    theme: {} as AgentModel["theme"],
    capabilities: [],
    reach: [],
    autonomy: [],
    subagents: [],
    ...over,
  };
}

const base: CapabilitySnapshot = snapshotFromModel(
  model({
    capabilities: [
      { label: "Search docs", detail: "", origin: "tool", source: "tools/search-docs.ts" },
      { label: "Draft reply", detail: "", origin: "tool", source: "tools/draft-reply.ts" },
    ],
    reach: [{ label: "Zendesk", kind: "api", access: "read" }],
    autonomy: [],
    subagents: [],
  }),
  "2026-06-01T00:00:00Z"
);

describe("diffSnapshots", () => {
  it("flags the first deploy as initial with no entries", () => {
    const d = diffSnapshots(null, base);
    expect(d.isInitial).toBe(true);
    expect(d.entries).toHaveLength(0);
    expect(d.hasChanges).toBe(false);
  });

  it("reports no changes for an identical snapshot", () => {
    const d = diffSnapshots(base, base);
    expect(d.hasChanges).toBe(false);
    expect(d.hasElevated).toBe(false);
  });

  it("escalates new external reach", () => {
    const next = snapshotFromModel(
      model({
        capabilities: base.capabilities.map((c) => ({ ...c, detail: "", origin: "tool" as const })),
        reach: [
          { label: "Zendesk", kind: "api", access: "read" },
          { label: "Intercom", kind: "api", access: "read-write" },
        ],
      })
    );
    const d = diffSnapshots(base, next);
    const added = d.entries.find((e) => e.summary.includes("Intercom"));
    expect(added?.change).toBe("added");
    expect(added?.risk).toBe("elevated");
    expect(d.hasElevated).toBe(true);
  });

  it("escalates widened access and de-escalates narrowed access", () => {
    const widened = diffSnapshots(
      base,
      snapshotFromModel(model({ capabilities: snapCaps(), reach: [{ label: "Zendesk", kind: "api", access: "read-write" }] }))
    );
    const w = widened.entries.find((e) => e.summary.includes("widened"));
    expect(w?.risk).toBe("elevated");

    const narrowedBase = snapshotFromModel(model({ reach: [{ label: "Zendesk", kind: "api", access: "read-write" }] }));
    const narrowed = diffSnapshots(
      narrowedBase,
      snapshotFromModel(model({ reach: [{ label: "Zendesk", kind: "api", access: "read" }] }))
    );
    const n = narrowed.entries.find((e) => e.summary.includes("narrowed"));
    expect(n?.risk).toBe("routine");
  });

  it("escalates a new acts-on-its-own schedule", () => {
    const next = snapshotFromModel(
      model({
        capabilities: snapCaps(),
        reach: [{ label: "Zendesk", kind: "api", access: "read" }],
        autonomy: [{ does: "Watch SLAs", when: "every 15m", consent: "acts-on-its-own" }],
      })
    );
    const d = diffSnapshots(base, next);
    const a = d.entries.find((e) => e.kind === "autonomy");
    expect(a?.risk).toBe("elevated");
    expect(d.entries[0].risk).toBe("elevated"); // elevated sorted first
  });

  it("reports a new capability as routine", () => {
    const next = snapshotFromModel(
      model({
        capabilities: [
          ...snapCaps(),
          { label: "Escalate", detail: "", origin: "tool", source: "tools/escalate.ts" },
        ],
        reach: [{ label: "Zendesk", kind: "api", access: "read" }],
      })
    );
    const d = diffSnapshots(base, next);
    const c = d.entries.find((e) => e.summary.includes("New capability"));
    expect(c?.risk).toBe("routine");
  });

  it("classifies new reach by consequence and leads with high severity", () => {
    const next = snapshotFromFacts({
      capabilities: snapCaps(),
      reach: [
        { label: "zendesk", kind: "api" },
        { label: "slack", kind: "api" },
        { label: "stripe", kind: "api", detail: "OPENAPI · https://api.stripe.com" },
      ],
      autonomy: [],
      subagents: [],
    });
    const d = diffSnapshots(base, next);
    const stripe = d.entries.find((e) => e.summary.includes("stripe"));
    expect(stripe?.category).toBe("payments");
    expect(stripe?.severity).toBe("high");
    expect(stripe?.summary).toContain("— payments");
    // high-severity reach sorts ahead of the medium-severity slack add
    const reachAdds = d.entries.filter((e) => e.kind === "reach" && e.change === "added");
    expect(reachAdds[0].severity).toBe("high");
  });

  it("escalates a model swap and a system-prompt change", () => {
    const prev = snapshotFromFacts({
      capabilities: [], reach: [], autonomy: [], subagents: [],
      mind: { model: "anthropic/claude-sonnet-4", instructionsHash: "aaaa" },
    });
    const next = snapshotFromFacts({
      capabilities: [], reach: [], autonomy: [], subagents: [],
      mind: { model: "minimax/minimax-m3", instructionsHash: "bbbb" },
    });
    const d = diffSnapshots(prev, next);
    const mind = d.entries.filter((e) => e.kind === "mind");
    expect(mind).toHaveLength(2);
    expect(mind.every((e) => e.risk === "elevated")).toBe(true);
    expect(d.entries.some((e) => e.summary.includes("Model changed"))).toBe(true);
    expect(d.entries.some((e) => e.summary.includes("system prompt"))).toBe(true);
  });

  it("does not flag mind when the baseline predates mind tracking", () => {
    const prev = snapshotFromFacts({ capabilities: [], reach: [], autonomy: [], subagents: [] });
    const next = snapshotFromFacts({
      capabilities: [], reach: [], autonomy: [], subagents: [],
      mind: { model: "x", instructionsHash: "y" },
    });
    const d = diffSnapshots(prev, next);
    expect(d.entries.some((e) => e.kind === "mind")).toBe(false);
  });

  it("treats removed capability/reach as routine", () => {
    const next = snapshotFromModel(model({ capabilities: [], reach: [] }));
    const d = diffSnapshots(base, next);
    expect(d.entries.every((e) => e.risk === "routine")).toBe(true);
    expect(d.entries.some((e) => e.change === "removed")).toBe(true);
  });
});

// helper: the base capabilities re-expressed as model capabilities
function snapCaps() {
  return [
    { label: "Search docs", detail: "", origin: "tool" as const, source: "tools/search-docs.ts" },
    { label: "Draft reply", detail: "", origin: "tool" as const, source: "tools/draft-reply.ts" },
  ];
}
