import type { AgentModel } from "../model";
import { loadRawAgents } from "./loadAgents";
import { parseAgent } from "./eveAdapter";

/** All agents found under /agents, parsed into models. Computed once. */
export const agents: AgentModel[] = loadRawAgents().map(parseAgent);

export function agentById(id: string): AgentModel | undefined {
  return agents.find((a) => a.id === id);
}
