import type { AgentModel } from "../model";
import { loadRawProject, type RawProject } from "./loadProject";
import { parseAgent } from "./eveAdapter";

const raw = loadRawProject();

/** The workspace agent, parsed into a model. Computed once at build time. */
export const projectModel: AgentModel | null = raw ? parseAgent(raw) : null;

export function parseProject(raw: RawProject): AgentModel {
  return parseAgent(raw);
}

/** @deprecated Use projectModel */
export const agents: AgentModel[] = projectModel ? [projectModel] : [];

/** @deprecated Use parseProject */
export function agentById(id: string): AgentModel | undefined {
  return projectModel?.id === id ? projectModel : undefined;
}
