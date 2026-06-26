import { useMemo } from "react";
import type { AgentModel } from "../model";
import { portraitFor } from "../portrait/portrait";

/** Renders the agent's generated relief portrait in monospace. */
export function Portrait({ agent }: { agent: AgentModel }) {
  const { rows } = useMemo(() => portraitFor(agent), [agent]);
  return (
    <pre className="portrait" aria-label={`Portrait of ${agent.name}`}>
      {rows.join("\n")}
    </pre>
  );
}
