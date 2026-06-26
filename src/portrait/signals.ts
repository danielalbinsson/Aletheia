// Derives the visual signals that drive the portrait FROM the agent model.
// This is the meaning -> variable mapping the brief calls the core IP:
//
//   reach     -> how much the agent can touch   -> presence / aura width
//   autonomy  -> how much it does unprompted     -> weight / solidity
//   range     -> breadth of what it can do       -> surface complexity
//   motif     -> its domain                       -> accent glyph + texture
//   seed      -> a hash of its definition         -> same agent, same face
//
// Same agent in, same signals out — always. Two agents with different
// purposes get visibly different faces.

import type { AgentModel, PortraitSignals } from "../model";

/** Saturating 0..1 curve: grows fast, never quite reaches 1. */
function saturate(n: number, k: number): number {
  return n / (n + k);
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function deriveSignals(agent: AgentModel): PortraitSignals {
  // reach: number of distinct things it touches, weighted by write access.
  const writes = agent.reach.filter((r) => r.access !== "read").length;
  const reach = saturate(agent.reach.length + writes, 4);

  // autonomy: how much it acts on its own vs. asks first.
  const acts = agent.autonomy.filter((a) => a.consent === "acts-on-its-own").length;
  const asks = agent.autonomy.filter((a) => a.consent === "asks-first").length;
  const ownership = (acts + asks) === 0 ? 0 : acts / (acts + asks + 1);
  const autonomy = Math.max(
    0,
    Math.min(1, ownership * 0.6 + Math.min(acts, 3) / 3 * 0.4)
  );

  // range: breadth of capabilities.
  const range = saturate(agent.capabilities.length, 5);

  // seed: stable hash of the agent's definition.
  const seed = hashString(agent.id + "|" + agent.name + "|" + agent.essence);

  return { reach, autonomy, range, seed, motif: agent.motif };
}
