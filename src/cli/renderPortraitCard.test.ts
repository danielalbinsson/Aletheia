import { describe, it, expect } from "vitest";
import {
  buildPortraitCard,
  renderPortraitJson,
  renderPortraitText,
} from "./renderPortraitCard";
import type { ManifestFacts } from "../parser/manifestAdapter";

const facts: ManifestFacts = {
  name: "support-bot",
  capabilities: [
    { source: "tools/refund.ts", label: "Request refund", detail: "Refund.", origin: "tool", consent: "asks-first" },
    { source: "tools/lookup.ts", label: "Lookup order", detail: "Lookup.", origin: "tool" },
  ],
  reach: [{ label: "slack", kind: "api" }],
  autonomy: [{ when: "Every 15 min", does: "check tickets", consent: "acts-on-its-own" }],
  restrictions: [{ tool: "bash", label: "run shell commands" }],
  subagents: [],
};

const bust = ["  ..  ", " .▒▒. ", "  ··  "];

const meta = {
  verified: true,
  headSha: "abc1234",
  manifestSha: "deadbeefdeadbeef",
  generatedAt: "2026-07-29T00:00:00.000Z",
};

describe("buildPortraitCard", () => {
  it("maps facts and marks asks-first per capability", () => {
    const card = buildPortraitCard(facts, bust, meta);
    expect(card.schema).toBe("aletheia.portrait/v1");
    expect(card.name).toBe("support-bot");
    expect(card.verified).toBe(true);
    expect(card.canDo).toEqual([
      { label: "Request refund", asksFirst: true },
      { label: "Lookup order", asksFirst: false },
    ]);
    expect(card.canTouch).toEqual(["slack"]);
    expect(card.cannot).toEqual([{ tool: "bash", label: "run shell commands" }]);
    expect(card.bust).toBe(bust);
  });

  it("does not claim build-verification for the asks-first fact in its provenance line", () => {
    const card = buildPortraitCard(facts, bust, meta);
    expect(card.provenance).toMatch(/verified from build/);
    expect(card.provenance).toMatch(/asks first.*source-declared/i);
  });

  it("falls back to a source-provenance line when unverified", () => {
    const card = buildPortraitCard(facts, bust, { ...meta, verified: false });
    expect(card.verified).toBe(false);
    expect(card.provenance).toMatch(/from source/i);
  });

  it("emits valid JSON round-trippable to the same card", () => {
    const card = buildPortraitCard(facts, bust, meta);
    const parsed = JSON.parse(renderPortraitJson(card));
    expect(parsed).toEqual(card);
  });

  it("text render labels asks-first and disabled tools honestly", () => {
    const text = renderPortraitText(buildPortraitCard(facts, bust, meta));
    expect(text).toContain("Request refund (asks first)");
    expect(text).toContain("run shell commands (`bash` disabled)");
    expect(text).toContain("# support-bot");
  });

  it("omits sandbox and delegation when those compiled fields were absent", () => {
    const card = buildPortraitCard(facts, bust, meta);
    expect(card.sandbox).toBeUndefined();
    expect(card.delegation).toBeUndefined();
    const text = renderPortraitText(card);
    expect(text).not.toMatch(/## Sandbox/);
    expect(text).not.toMatch(/delegates:/);
  });

  it("renders verified sandbox presence and delegation edges from extra compiled fields", () => {
    const extra: ManifestFacts = {
      ...facts,
      reach: [
        { label: "slack", kind: "channel", detail: "slack" },
        {
          label: "linear",
          kind: "api",
          detail: "MCP · https://mcp.linear.app · Vercel Connect (oauth/mcp-linear-app)",
        },
      ],
      sandbox: { present: true, workspaceCount: 1 },
      subagents: [{ name: "Auditor", capabilities: [], reach: [] }],
      delegation: [{ parent: "support-bot", child: "Auditor" }],
    };
    const card = buildPortraitCard(extra, bust, meta);
    expect(card.canTouch).toEqual([
      "slack · slack",
      "linear · MCP · https://mcp.linear.app · Vercel Connect (oauth/mcp-linear-app)",
    ]);
    expect(card.sandbox).toBe("An authored sandbox is configured. 1 sandbox workspace folder.");
    expect(card.delegation).toEqual(["support-bot → Auditor"]);
    const text = renderPortraitText(card);
    expect(text).toContain("## Sandbox");
    expect(text).toContain("_verified from build_");
    expect(text).toContain("An authored sandbox is configured.");
  });

  it("renders unverified sandbox provenance from the card flag", () => {
    const extra: ManifestFacts = {
      ...facts,
      sandbox: { present: true },
    };
    const text = renderPortraitText(buildPortraitCard(extra, bust, { ...meta, verified: false }));
    expect(text).toContain("from source — build to verify");
    expect(text).not.toContain("_verified from build_");
  });
});
