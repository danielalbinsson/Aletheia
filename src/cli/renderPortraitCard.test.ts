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
});
