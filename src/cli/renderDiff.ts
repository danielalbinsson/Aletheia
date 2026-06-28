// renderDiff: turn a CapabilityDiff into PR-comment markdown / a JSON payload.
// Pure — no fs, no git. The CLI feeds it the diff plus provenance metadata.

import type { CapabilityDiff, CapabilitySnapshot, DiffEntry } from "../parser/capabilityDiff";

/** Hidden marker so CI can find and update one sticky comment in place. */
export const STICKY_MARKER = "<!-- aletheia-capability-diff -->";

export interface DiffMeta {
  /** Head commit short SHA, if known. */
  headSha?: string;
  /** sha256 of the compiled manifest, if known. */
  manifestSha?: string;
  /** Human label for the baseline, e.g. "git:main" or "file:…". */
  baseline: string;
  /** The fail-on threshold the run used. */
  failOn: "elevated" | "any" | "never";
}

const GLYPH: Record<DiffEntry["change"], string> = {
  added: "＋",
  removed: "－",
  changed: "～",
};

function line(e: DiffEntry): string {
  return `- ${GLYPH[e.change]} ${e.summary}`;
}

function footer(meta: DiffMeta): string {
  const bits = [
    meta.headSha ? `head \`${meta.headSha}\`` : null,
    meta.manifestSha ? `manifest \`sha256:${meta.manifestSha.slice(0, 12)}…\`` : null,
    `baseline \`${meta.baseline}\``,
  ].filter(Boolean);
  return `<sub>${bits.join(" · ")}</sub>`;
}

/** The verdict line + whether the check should be considered failing. */
export function verdict(diff: CapabilityDiff, failOn: DiffMeta["failOn"]): {
  failing: boolean;
  headline: string;
} {
  if (diff.isInitial) {
    return { failing: failOn !== "never", headline: "First deploy — review the initial capabilities." };
  }
  if (!diff.hasChanges) {
    return { failing: false, headline: "No capability changes since the baseline." };
  }
  if (diff.hasElevated) {
    return {
      failing: failOn === "elevated" || failOn === "any",
      headline: "Authority expanded — review required.",
    };
  }
  return { failing: failOn === "any", headline: "Routine capability changes only." };
}

export function renderMarkdown(
  diff: CapabilityDiff,
  current: CapabilitySnapshot,
  meta: DiffMeta
): string {
  const v = verdict(diff, meta.failOn);
  const out: string[] = [STICKY_MARKER, "", "### Aletheia — capability review", ""];
  out.push(`**${v.headline}**`, "");

  if (diff.isInitial) {
    out.push("This agent has no prior deployed baseline. It will be able to:", "");
    for (const c of current.capabilities) out.push(`- ${c.label}`);
    if (current.reach.length) {
      out.push("", "And reach:", "");
      for (const r of current.reach) out.push(`- ${r.label}${r.detail ? ` (${r.detail})` : ""}`);
    } else {
      out.push("", "It reaches nothing outside itself.");
    }
    out.push("", footer(meta));
    return out.join("\n");
  }

  if (!diff.hasChanges) {
    out.push(footer(meta));
    return out.join("\n");
  }

  const elevated = diff.entries.filter((e) => e.risk === "elevated");
  const routine = diff.entries.filter((e) => e.risk === "routine");

  if (elevated.length) {
    out.push("#### ⚠ Needs your attention", "");
    for (const e of elevated) out.push(line(e));
    out.push("");
  }
  if (routine.length) {
    out.push("#### Other changes", "");
    for (const e of routine) out.push(line(e));
    out.push("");
  }
  out.push(footer(meta));
  return out.join("\n");
}

/** Machine-readable payload for `--format json`. */
export function renderJson(
  diff: CapabilityDiff,
  current: CapabilitySnapshot,
  meta: DiffMeta
): string {
  const v = verdict(diff, meta.failOn);
  return JSON.stringify(
    { failing: v.failing, headline: v.headline, meta, diff, current },
    null,
    2
  );
}
