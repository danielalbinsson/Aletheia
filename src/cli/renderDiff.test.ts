import { describe, it, expect } from "vitest";
import { renderMarkdown, verdict, STICKY_MARKER, type DiffMeta } from "./renderDiff";
import { snapshotFromFacts, diffSnapshots } from "../parser/capabilityDiff";
import type { AgentModel } from "../model";

const meta: DiffMeta = { headSha: "abc1234", manifestSha: "9f3c".padEnd(64, "0"), baseline: "git:main", failOn: "elevated" };

function facts(over: Partial<Pick<AgentModel, "capabilities" | "reach" | "autonomy" | "subagents">>) {
  return { capabilities: [], reach: [], autonomy: [], subagents: [], ...over };
}

const baseSnap = snapshotFromFacts(
  facts({
    capabilities: [{ label: "Search docs", detail: "", origin: "tool", source: "tools/search-docs.ts" }],
    reach: [{ label: "zendesk", kind: "api", detail: "OPENAPI" }],
  })
);

describe("verdict", () => {
  it("fails on elevated when fail-on=elevated", () => {
    const next = snapshotFromFacts(
      facts({ reach: [{ label: "zendesk", kind: "api" }, { label: "stripe", kind: "api" }] })
    );
    const d = diffSnapshots(baseSnap, next);
    expect(verdict(d, "elevated").failing).toBe(true);
  });

  it("does not fail on routine-only", () => {
    const next = snapshotFromFacts(facts({ capabilities: [], reach: [{ label: "zendesk", kind: "api" }] }));
    const d = diffSnapshots(baseSnap, next);
    expect(d.hasElevated).toBe(false);
    expect(verdict(d, "elevated").failing).toBe(false);
  });

  it("never fails when fail-on=never", () => {
    const next = snapshotFromFacts(facts({ reach: [{ label: "stripe", kind: "api" }] }));
    expect(verdict(diffSnapshots(baseSnap, next), "never").failing).toBe(false);
  });
});

describe("renderMarkdown", () => {
  it("includes the sticky marker, verdict, and provenance footer", () => {
    const next = snapshotFromFacts(
      facts({ reach: [{ label: "zendesk", kind: "api" }, { label: "stripe", kind: "api", detail: "OPENAPI · https://api.stripe.com" }] })
    );
    const md = renderMarkdown(diffSnapshots(baseSnap, next), next, meta);
    expect(md.startsWith(STICKY_MARKER)).toBe(true);
    expect(md).toContain("Authority expanded");
    expect(md).toContain("Needs your attention");
    expect(md).toContain("stripe");
    expect(md).toContain("baseline `git:main`");
    expect(md).toContain("head `abc1234`");
  });

  it("renders the initial-capabilities view when there is no baseline", () => {
    const md = renderMarkdown(diffSnapshots(null, baseSnap), baseSnap, meta);
    expect(md).toContain("no prior deployed baseline");
    expect(md).toContain("Search docs");
  });

  it("says no changes when identical", () => {
    const md = renderMarkdown(diffSnapshots(baseSnap, baseSnap), baseSnap, meta);
    expect(md).toContain("No capability changes");
  });

  it("renders an integrity-warnings block when warnings are passed", () => {
    const md = renderMarkdown(diffSnapshots(baseSnap, baseSnap), baseSnap, meta, undefined, [
      "refund declares approval in source but is missing from the sidecar.",
    ]);
    expect(md).toContain("Integrity warnings");
    expect(md).toContain("missing from the sidecar");
  });

  it("omits the warnings block when there are none", () => {
    const md = renderMarkdown(diffSnapshots(baseSnap, baseSnap), baseSnap, meta, undefined, []);
    expect(md).not.toContain("Integrity warnings");
  });

  it("embeds the portrait in a collapsed details block when provided", () => {
    const md = renderMarkdown(diffSnapshots(baseSnap, baseSnap), baseSnap, meta, {
      name: "Beacon",
      rows: ["  ▒▒  ", " ▓██▓ "],
    });
    expect(md).toContain("<details><summary>Portrait</summary>");
    expect(md).toContain("Beacon");
    expect(md).toContain("▓██▓");
  });
});
