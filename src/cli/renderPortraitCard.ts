// Render an agent portrait as a generated artifact (JSON or text).
//
// Why this exists: the gallery used to ship 100 KB JPEG *screenshots* of
// portraits, labelled "verified from build". A screenshot cannot stay true — one
// of them advertised a "Mock git diff" tool that had been deleted, under a
// "verified from build" heading. A trust product cannot ship a stale image that
// asserts verification. So the portrait becomes a generated artifact from the
// same build the passport uses, and the gallery renders it live.
//
// Honesty carries through: `verified` reflects whether facts came from the
// compiled manifest. The one fact that is never build-verified — "asks first"
// approval — is marked per item, because eve does not serialize approval into
// the manifest (see SelfPortrait.tsx and the honesty contract).

import type { ManifestFacts } from "../parser/manifestAdapter";

export interface PortraitMeta {
  verified: boolean;
  headSha?: string;
  manifestSha?: string;
  generatedAt: string;
}

export interface PortraitCard {
  schema: "aletheia.portrait/v1";
  name: string;
  verified: boolean;
  provenance: string;
  generatedAt: string;
  headSha?: string;
  manifestSha?: string;
  bust: string[];
  canDo: { label: string; asksFirst: boolean }[];
  canTouch: string[];
  doesOnItsOwn: { when: string; does: string; asksFirst: boolean }[];
  cannot: { tool: string; label: string }[];
  subagents: string[];
}

export function buildPortraitCard(
  facts: ManifestFacts,
  bust: string[],
  meta: PortraitMeta
): PortraitCard {
  return {
    schema: "aletheia.portrait/v1",
    name: facts.name ?? "agent",
    verified: meta.verified,
    provenance: meta.verified
      ? "verified from build — except “asks first”, which is source-declared (eve does not serialize approval)"
      : "from source — build to verify",
    generatedAt: meta.generatedAt,
    headSha: meta.headSha,
    manifestSha: meta.manifestSha,
    bust,
    canDo: facts.capabilities.map((c) => ({
      label: c.label,
      asksFirst: c.consent === "asks-first",
    })),
    canTouch: facts.reach.map((r) => r.label),
    doesOnItsOwn: facts.autonomy.map((a) => ({
      when: a.when,
      does: a.does,
      asksFirst: a.consent === "asks-first",
    })),
    cannot: (facts.restrictions ?? []).map((r) => ({ tool: r.tool, label: r.label })),
    subagents: (facts.subagents ?? []).map((s) => s.name),
  };
}

export function renderPortraitJson(card: PortraitCard): string {
  return `${JSON.stringify(card, null, 2)}\n`;
}

function bullets(items: string[]): string {
  return items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none)";
}

export function renderPortraitText(card: PortraitCard): string {
  const canDo = card.canDo.map((c) => (c.asksFirst ? `${c.label} (asks first)` : c.label));
  const alone = card.doesOnItsOwn.map((a) =>
    a.asksFirst ? `${a.when}: ${a.does} (asks first)` : `${a.when}: ${a.does}`
  );
  const cannot = card.cannot.map((r) => `${r.label} (\`${r.tool}\` disabled)`);

  return [
    card.bust.join("\n"),
    "",
    `# ${card.name}`,
    `_${card.provenance}_`,
    "",
    "## What I can do",
    "",
    bullets(canDo),
    "",
    "## What I can touch",
    "",
    bullets(card.canTouch),
    "",
    "## What I do on my own",
    "",
    bullets(alone),
    ...(card.subagents.length ? ["", "## Subagents", "", bullets(card.subagents)] : []),
    "",
    "## What I cannot do",
    "",
    bullets(cannot),
    "",
  ].join("\n");
}
