// sourceScan: comment-safe scanning of eve tool source for the two facts we
// lift from raw code — a disabled framework tool (`disableTool()`) and an
// approval gate (`approval: always()`). Both are source-declared signals, never
// manifest-verified; keeping the detection here (pure, tested) stops commented-
// out code or prose from false-triggering a trust fact.

/**
 * Strip `//` line comments and `/* *\/` block comments so a commented-out
 * `disableTool(...)` or an `approval:` mention in a doc comment doesn't read as
 * a live declaration. Deliberately simple: it does not tokenize strings, so the
 * callers below pair it with call-shaped regexes that prose is unlikely to hit.
 */
export function stripCodeComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // line comments (keep the char before //, so `://` in urls survives)
}

/** True if the source disables a framework tool via `disableTool(...)`. */
export function hasDisableTool(src: string): boolean {
  return /\bdisableTool\s*\(/.test(stripCodeComments(src));
}

/**
 * True if the source declares an approval gate. Tightened to the eve call form
 * `approval: <fn>(` (e.g. `approval: always()`), so a tool *description*
 * containing the word "approval" does not get mistaken for a gate.
 */
export function hasApprovalGate(src: string): boolean {
  return /\bapproval\s*:\s*[A-Za-z_$][\w$]*\s*\(/.test(stripCodeComments(src));
}

/**
 * Tools whose source declares an approval gate but that are NOT recorded in the
 * consent sidecar (`gated` map, keyed by tool name). These are the drift cases:
 * the app/portrait and the CLI/PR-check both treat the sidecar as the single
 * source of consent truth, so a source-only gate would otherwise be an invisible
 * mismatch. Surfacing it tells the author to mirror the gate into consent.json.
 */
export function consentDrift(
  toolSources: Record<string, string>,
  gated: Record<string, string>
): string[] {
  const drifted: string[] = [];
  for (const [tool, src] of Object.entries(toolSources)) {
    if (hasApprovalGate(src) && gated[tool] === undefined) drifted.push(tool);
  }
  return drifted.sort();
}
