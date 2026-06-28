import { describe, it, expect } from "vitest";
import { parsePolicy } from "./policy";
import { classifyReach } from "./consequence";

describe("parsePolicy", () => {
  it("returns empty defaults for missing/garbage input", () => {
    expect(parsePolicy(undefined)).toEqual({ rules: [] });
    expect(parsePolicy("nope")).toEqual({ rules: [] });
    expect(parsePolicy({})).toEqual({ rules: [] });
  });

  it("reads failOn and well-formed rules, dropping bad ones", () => {
    const p = parsePolicy({
      failOn: "any",
      rules: [
        { category: "internal billing", severity: "high", pattern: "acme-pay" },
        { category: "bad", severity: "nope", pattern: "x" }, // dropped: bad severity
        { category: "bad regex", severity: "high", pattern: "(" }, // dropped: invalid regex
        { severity: "high", pattern: "y" }, // dropped: no category
      ],
    });
    expect(p.failOn).toBe("any");
    expect(p.rules).toHaveLength(1);
    expect(p.rules[0].category).toBe("internal billing");
  });

  it("policy rules feed classifyReach and take precedence", () => {
    const p = parsePolicy({
      rules: [{ category: "internal billing", severity: "high", pattern: "acme-pay" }],
    });
    const c = classifyReach("acme-pay-svc", "", p.rules);
    expect(c?.category).toBe("internal billing");
    expect(c?.severity).toBe("high");
  });
});
