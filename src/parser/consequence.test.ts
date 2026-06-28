import { describe, it, expect } from "vitest";
import { classifyReach } from "./consequence";

describe("classifyReach", () => {
  it("flags payments as high", () => {
    expect(classifyReach("stripe", "OPENAPI · https://api.stripe.com")?.severity).toBe("high");
    expect(classifyReach("quickbooks")?.category).toBe("payments");
  });

  it("flags infra, secrets, and data stores as high", () => {
    expect(classifyReach("vault")?.severity).toBe("high");
    expect(classifyReach("prod-postgres")?.category).toBe("data store");
    expect(classifyReach("vercel")?.category).toBe("infrastructure");
  });

  it("flags comms and repos as medium", () => {
    expect(classifyReach("slack")?.severity).toBe("medium");
    expect(classifyReach("github")?.category).toBe("code & repos");
  });

  it("returns null for an unrecognized target", () => {
    expect(classifyReach("acme-internal-widget")).toBeNull();
  });

  it("lets caller rules take precedence", () => {
    const extra = [{ category: "custom", severity: "high" as const, pattern: /widget/i }];
    expect(classifyReach("acme-widget", "", extra)?.category).toBe("custom");
  });
});
