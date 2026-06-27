import type { RawProject } from "../parser/loadProject";
import {
  buildOpenRouterAgentTs,
  DEFAULT_OPENROUTER_MODEL_ID,
  extractOpenRouterModelId,
  setOpenRouterModelId,
} from "./openRouterAgent";

export interface ValidationIssue {
  path: string;
  message: string;
}

function titleCase(s: string): string {
  return s.replace(/(^|[-_])(\w)/g, (_, __, c) => " " + c.toUpperCase()).trim();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function field(src: string, key: string): string | undefined {
  const m = src.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`));
  return m?.[1]?.trim() || undefined;
}

function toolTemplate(_slug: string, label: string): string {
  return `import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "${label}.",
  inputSchema: z.object({}),
  async execute() {
    return {};
  },
});
`;
}

function channelTemplate(slug: string, _label: string): string {
  return `import { defineChannel, POST } from "eve/channels";

export default defineChannel({
  name: "${slug.replace(/-/g, "_")}",
  routes: {
    webhook: POST(async () => {
      return new Response("Not implemented", { status: 501 });
    }),
  },
});
`;
}

function scheduleTemplate(_slug: string): string {
  return `import { defineSchedule } from "eve/schedules";

// @when Every morning at 9am
// @consent asks-first

export default defineSchedule({
  cron: "0 9 * * *",
  markdown: "Describe what happens on this schedule.",
});
`;
}

function subagentTemplate(slug: string, label: string): string {
  const name = slug.replace(/-/g, "_");
  return `import { subagent } from "eve";

export default subagent({
  name: "${name}",
  description: "${label}.",
});
`;
}

function skillTemplate(slug: string, label: string): string {
  return `---
name: ${slug.replace(/-/g, "_")}
description: ${label}.
---

# ${titleCase(slug)}

Describe how this skill works.
`;
}

function instructionsTemplate(name: string, intro?: string): string {
  return `# ${name}

${intro ?? `I'm ${name}. Describe who I am and what I do in the first person.`}

## Voice

Describe how I speak.

## Goals

- First goal
`;
}

function buildAgentTs(raw: RawProject): string {
  const existing = raw.files["agent.ts"] ?? "";
  const modelId = extractOpenRouterModelId(existing);
  return buildOpenRouterAgentTs(modelId);
}

export function createBlankProject(
  opts?: { name?: string; model?: string; description?: string }
): RawProject {
  const name = opts?.name ?? "My Agent";
  const model = opts?.model ?? DEFAULT_OPENROUTER_MODEL_ID;
  const id = slugify(name);

  const toolPath = "tools/example.ts";
  const files: Record<string, string> = {
    "instructions.md": instructionsTemplate(name, opts?.description),
    [toolPath]: toolTemplate("example", "Example capability"),
    "agent.ts": buildOpenRouterAgentTs(model),
  };

  return { id, files };
}

/** @deprecated Use createBlankProject */
export function createBlankAgent(
  id: string,
  opts?: { name?: string; model?: string; description?: string }
): RawProject {
  return createBlankProject({ name: opts?.name ?? titleCase(id), ...opts });
}

export function updateAgentFile(
  raw: RawProject,
  filePath: string,
  content: string
): RawProject {
  const files = { ...raw.files, [filePath]: content };
  const next: RawProject = { id: raw.id, files };
  if (filePath !== "agent.ts") {
    return rebuildAgentTs(next);
  }
  return rebuildAgentTs(next);
}

export function removeAgentFile(raw: RawProject, filePath: string): RawProject {
  const files = { ...raw.files };
  delete files[filePath];
  return rebuildAgentTs({ id: raw.id, files });
}

export function rebuildAgentTs(raw: RawProject): RawProject {
  const files: Record<string, string> = {
    ...raw.files,
    "agent.ts": buildAgentTs(raw),
  };
  const instructions = files["instructions.md"] ?? "";
  const title = instructions.match(/^#\s+(.+)$/m)?.[1];
  const id = title ? slugify(title) : raw.id;
  return { id, files };
}

export function updateIdentity(
  raw: RawProject,
  fields: { name?: string; model?: string; description?: string }
): RawProject {
  const files = { ...raw.files };

  if (fields.model !== undefined) {
    const agentTs = files["agent.ts"] ?? buildAgentTs(raw);
    files["agent.ts"] = setOpenRouterModelId(agentTs, fields.model);
  }

  if (fields.name !== undefined || fields.description !== undefined) {
    let md = files["instructions.md"] ?? instructionsTemplate(titleCase(raw.id));
    const currentName = md.match(/^#\s+(.+)$/m)?.[1] ?? titleCase(raw.id);
    const name = fields.name ?? currentName;
    const parts = md.split(/^##\s+/m);
    const lead = parts[0].replace(/^#\s+.*\n*/, "").trim();
    const tail = parts.length > 1 ? parts.slice(1) : ["Voice\n\nDescribe how I speak."];
    const intro = fields.description ?? lead.split(/\n\s*\n/)[0] ?? lead;
    files["instructions.md"] = `# ${name}\n\n${intro}\n\n## ${tail.join("## ")}`;
  }

  const id = fields.name ? slugify(fields.name) : raw.id;
  return rebuildAgentTs({ id, files });
}

export type EntityKind = "tools" | "channels" | "schedules" | "subagents" | "skills";

export function addEntity(
  raw: RawProject,
  kind: EntityKind,
  slug: string,
  label?: string
): RawProject {
  const safeSlug = slugify(slug || "new-item");
  const display = label ?? titleCase(safeSlug);

  let path: string;
  let content: string;

  switch (kind) {
    case "tools":
      path = `tools/${safeSlug}.ts`;
      content = toolTemplate(safeSlug, display);
      break;
    case "channels":
      path = `channels/${safeSlug}.ts`;
      content = channelTemplate(safeSlug, display);
      break;
    case "schedules":
      path = `schedules/${safeSlug}.ts`;
      content = scheduleTemplate(safeSlug);
      break;
    case "subagents":
      path = `subagents/${safeSlug}.ts`;
      content = subagentTemplate(safeSlug, display);
      break;
    case "skills":
      path = `skills/${safeSlug}/SKILL.md`;
      content = skillTemplate(safeSlug, display);
      break;
  }

  if (raw.files[path]) throw new Error(`File already exists: ${path}`);
  return updateAgentFile(raw, path, content);
}

export function listEntityFiles(raw: RawProject, kind: EntityKind): string[] {
  const patterns: Record<EntityKind, RegExp> = {
    tools: /^tools\/.+\.ts$/,
    channels: /^channels\/.+\.ts$/,
    schedules: /^schedules\/.+\.ts$/,
    subagents: /^subagents\/.+\.ts$/,
    skills: /^skills\/.+\/SKILL\.md$/,
  };
  return Object.keys(raw.files)
    .filter((p) => patterns[kind].test(p))
    .sort();
}

export function validateProject(raw: RawProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!raw.files["agent.ts"]) {
    issues.push({ path: "agent.ts", message: "Missing agent.ts" });
  }
  if (!raw.files["instructions.md"]) {
    issues.push({ path: "instructions.md", message: "Missing instructions.md" });
  }

  const toolNames = new Set<string>();
  for (const [filePath, src] of Object.entries(raw.files)) {
    if (/^tools\/.+\.ts$/.test(filePath)) {
      const name =
        field(src, "name") ?? filePath.replace(/^tools\//, "").replace(/\.ts$/, "");
      if (!field(src, "description") && !src.includes("defineTool")) {
        issues.push({ path: filePath, message: "Tool missing description" });
      }
      if (toolNames.has(name)) {
        issues.push({ path: filePath, message: `Duplicate tool name: ${name}` });
      } else {
        toolNames.add(name);
      }
    }
  }

  return issues;
}

/** @deprecated Use validateProject */
export const validateAgent = validateProject;

export { slugify, titleCase };
