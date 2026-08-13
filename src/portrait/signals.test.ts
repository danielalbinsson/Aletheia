import { describe, it, expect } from "vitest";
import { deriveSignals } from "./signals";
import type { AgentModel, Autonomy } from "../model";

function agent(autonomy: Autonomy[]): AgentModel {
  return {
    id: "t",
    name: "T",
    intro: "",
    essence: "",
    domain: [],
    motif: "form",
    theme: {} as AgentModel["theme"],
    capabilities: [],
    reach: [],
    autonomy,
    restrictions: [],
    subagents: [],
  };
}

describe("deriveSignals autonomy consent", () => {
  it("treats missing schedule consent as unknown, not asks-first", () => {
    const unknown = deriveSignals(agent([{ when: "nightly", does: "reconcile" }]));
    const acts = deriveSignals(
      agent([{ when: "nightly", does: "reconcile", consent: "acts-on-its-own" }]),
    );
    const empty = deriveSignals(agent([]));

    expect(unknown.autonomy).toBeGreaterThan(empty.autonomy);
    expect(unknown.autonomy).toBe(acts.autonomy);

    // Counting unknown as asks-first would dilute autonomy and make the
    // unbuilt clone look safer. Missing consent must not do that.
    const mixedUnknown = deriveSignals(
      agent([
        { when: "a", does: "x", consent: "acts-on-its-own" },
        { when: "b", does: "y" },
      ]),
    );
    const mixedAsks = deriveSignals(
      agent([
        { when: "a", does: "x", consent: "acts-on-its-own" },
        { when: "b", does: "y", consent: "asks-first" },
      ]),
    );
    expect(mixedUnknown.autonomy).toBeGreaterThan(mixedAsks.autonomy);
  });
});
