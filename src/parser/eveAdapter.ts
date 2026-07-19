// eveAdapter: RawProject (files on disk) -> AgentModel (what Aletheia renders).
//
// ── THE SWAP POINT ──────────────────────────────────────────────────────────
// This module is the ONLY thing that understands eve's on-disk file format.
// It reads the source files as text and lifts fields out with small, tolerant
// regexes — it never executes the agent. When the real eve format is confirmed
// (see node_modules/eve/docs), adjust the extractors here and nothing else in
// the app needs to change.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AgentModel,
  Capability,
  Reach,
  Autonomy,
  Restriction,
  Subagent,
} from "../model";
import type { RawProject } from "./loadProject";
import { extractOpenRouterModelId } from "../serializer/openRouterAgent";
import { frameworkRestriction } from "./manifestAdapter";
import { themeForMotif } from "../theme/personalityTheme";

/** Pull a quoted string value for `key:` from a blob (single or double quotes). */
function field(src: string, key: string): string | undefined {
  const m = src.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`));
  return m?.[1]?.trim() || undefined;
}

/** Title-case a directory id like "margaux" -> "Margaux". */
function titleCase(s: string): string {
  return s.replace(/(^|[-_])(\w)/g, (_, __, c) => " " + c.toUpperCase()).trim();
}

// Domain vocabulary -> the motif the portrait system draws from.
const MOTIF_RULES: Array<{ motif: string; words: RegExp; tags: string[] }> = [
  { motif: "correspondence", words: /\b(inbox|email|mail|message|correspond)/i, tags: ["email", "research", "attention"] },
  { motif: "ledger", words: /\b(book|ledger|reconcil|transaction|account|invoice|finance)/i, tags: ["finance", "bookkeeping", "audit"] },
  { motif: "hearth", words: /\b(support|customer|ticket|help|reply|conversation)/i, tags: ["support", "customers", "care"] },
  { motif: "atlas", words: /\b(research|search|web|gather|brief|read)/i, tags: ["research", "reading"] },
];

function deriveDomain(text: string): { domain: string[]; motif: string } {
  const tags = new Set<string>();
  let motif = "form"; // neutral default
  let best = 0;
  for (const rule of MOTIF_RULES) {
    const hits = (text.match(new RegExp(rule.words, "gi")) || []).length;
    if (hits > 0) rule.tags.forEach((t) => tags.add(t));
    if (hits > best) {
      best = hits;
      motif = rule.motif;
    }
  }
  return { domain: [...tags], motif };
}

/** First-person intro: the body of instructions.md before the first ## section. */
function parseIntro(md: string): { intro: string; essence: string } {
  // Drop the leading "# Title" line.
  const body = md.replace(/^#\s+.*$/m, "").trim();
  // Take everything up to the first "## " subsection (Voice / Goals etc.).
  const lead = body.split(/^##\s+/m)[0].trim();
  // Collapse to clean paragraphs.
  const paragraphs = lead
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const intro = paragraphs.join("\n\n");
  // Essence = first sentence of the first paragraph.
  const firstSentence = (paragraphs[0] || "").split(/(?<=[.!?])\s/)[0];
  return { intro, essence: firstSentence };
}

function parseCapabilities(raw: RawProject): Capability[] {
  const caps: Capability[] = [];

  for (const [path, src] of Object.entries(raw.files)) {
    if (/^tools\/.+\.ts$/.test(path)) {
      const name = field(src, "name") ?? toolLabelFromPath(path);
      const detail = field(src, "description") ?? "";
      caps.push({
        label: humanizeToolName(name),
        detail,
        origin: "tool",
        source: path,
      });
    } else if (/^skills\/.+\/SKILL\.md$/.test(path)) {
      const name = field(src, "name") ?? path.split("/")[1];
      const detail = field(src, "description") ?? "";
      caps.push({
        label: titleCase(name),
        detail,
        origin: "skill",
        source: path,
      });
    } else if (/^subagents\/.+\.ts$/.test(path)) {
      const name = field(src, "name") ?? path;
      const detail = field(src, "description") ?? "";
      caps.push({
        label: `Delegates to ${titleCase(name)}`,
        detail,
        origin: "subagent",
        source: path,
      });
    }
  }
  return caps;
}

function toolLabelFromPath(filePath: string): string {
  const base = filePath.replace(/^tools\//, "").replace(/\.ts$/, "");
  return humanizeToolName(base);
}

function parseReachComment(src: string): Reach | null {
  const m = src.match(
    /\/\/\s*@reach\s+label:\s*([^|]+)\|\s*kind:\s*(\w+)\s*\|\s*access:\s*([\w-]+)/
  );
  if (!m) return null;
  return {
    label: m[1].trim(),
    kind: m[2].trim() as Reach["kind"],
    access: m[3].trim() as Reach["access"],
  };
}

function parseMetaComment(src: string, key: string): string | undefined {
  const m = src.match(new RegExp(`//\\s*@${key}\\s+(.+)$`, "m"));
  return m?.[1]?.trim();
}

function titleFromInstructions(md: string): string | undefined {
  return md.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function parseReach(raw: RawProject): Reach[] {
  const seen = new Map<string, Reach>();
  const add = (r: Reach) => {
    const key = r.label.toLowerCase();
    const prev = seen.get(key);
    // Keep the broadest access if the same target shows up twice.
    if (!prev) seen.set(key, r);
    else if (prev.access !== r.access) seen.set(key, { ...prev, access: "read-write" });
  };

  for (const [path, src] of Object.entries(raw.files)) {
    if (/^channels\/.+\.ts$/.test(path)) {
      const label = field(src, "label") ?? field(src, "name") ?? path;
      const access = (field(src, "access") as Reach["access"]) ?? "read";
      add({ label, kind: "channel", access });
    }
    if (/^tools\/.+\.ts$/.test(path)) {
      const fromComment = parseReachComment(src);
      if (fromComment) add(fromComment);
      const block = src.match(/reach\s*:\s*\{([^}]*)\}/);
      if (block) {
        const b = block[1];
        const label = field(b, "label");
        if (label) {
          add({
            label,
            kind: (field(b, "kind") as Reach["kind"]) ?? "api",
            access: (field(b, "access") as Reach["access"]) ?? "read",
          });
        }
      }
    }
  }
  return [...seen.values()];
}

function parseAutonomy(raw: RawProject): Autonomy[] {
  const out: Autonomy[] = [];
  for (const [path, src] of Object.entries(raw.files)) {
    if (!/^schedules\/.+\.ts$/.test(path)) continue;
    const when =
      parseMetaComment(src, "when") ??
      field(src, "when") ??
      field(src, "cron") ??
      "On a schedule";
    const does =
      field(src, "does") ??
      field(src, "markdown") ??
      "";
    const consent =
      (parseMetaComment(src, "consent") as Autonomy["consent"]) ??
      (field(src, "consent") as Autonomy["consent"]) ??
      "asks-first";
    out.push({ when, does, consent });
  }
  // Acts-on-its-own first — it's the more striking fact.
  return out.sort((a, b) =>
    a.consent === b.consent ? 0 : a.consent === "acts-on-its-own" ? -1 : 1
  );
}

// Source fallback: a flat RawProject can't see a nested subagent package's own
// tools/connections, so we surface name + description only. The verified depth
// (model, tools, reach per subagent) comes from the compiled manifest.
function parseSubagents(raw: RawProject): Subagent[] {
  const subs: Subagent[] = [];
  for (const [path, src] of Object.entries(raw.files)) {
    if (/^subagents\/.+\.ts$/.test(path)) {
      subs.push({
        name: titleCase(field(src, "name") ?? path.split("/")[1]),
        description: field(src, "description") || undefined,
        capabilities: [],
        reach: [],
      });
    }
  }
  return subs;
}

function humanizeToolName(name: string): string {
  const s = name.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Source fallback for restrictions: a tool file that only re-exports
// `disableTool()` turns off the framework tool of the same name. The verified
// list comes from the manifest's `disabledFrameworkTools`; this is the
// pre-build guess, labelled "from source" downstream.
function parseRestrictions(raw: RawProject): Restriction[] {
  const restrictions: Restriction[] = [];
  for (const [path, src] of Object.entries(raw.files)) {
    const m = /^tools\/([^/]+)\.ts$/.exec(path);
    if (m && /\bdisableTool\s*\(/.test(src)) {
      restrictions.push(frameworkRestriction(m[1]));
    }
  }
  return restrictions;
}

export function parseAgent(raw: RawProject): AgentModel {
  const agentTs = raw.files["agent.ts"] ?? "";
  const instructions = raw.files["instructions.md"] ?? "";

  const name =
    field(agentTs, "name") ??
    titleFromInstructions(instructions) ??
    titleCase(raw.id);
  const runsOn = extractOpenRouterModelId(agentTs) || field(agentTs, "model");
  const description = field(agentTs, "description") ?? "";

  const { intro, essence } = parseIntro(instructions);
  const { domain, motif } = deriveDomain(
    [description, instructions].join("\n")
  );

  return {
    id: raw.id,
    name,
    runsOn,
    intro: intro || description,
    essence: essence || description,
    domain,
    motif,
    theme: themeForMotif(motif),
    capabilities: parseCapabilities(raw),
    reach: parseReach(raw),
    autonomy: parseAutonomy(raw),
    restrictions: parseRestrictions(raw),
    subagents: parseSubagents(raw),
  };
}
