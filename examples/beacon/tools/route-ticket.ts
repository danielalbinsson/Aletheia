import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

// Handing a customer to a human is a judgement call — confirm before doing it.
export default defineTool({
  description: "Hand a hard or sensitive ticket to the right human, with context.",
  inputSchema: z.object({
    to: z.string().describe("The team or person to route to"),
    reason: z.string().describe("Why this needs a human"),
  }),
  approval: always(),
  async execute({ to, reason }) {
    return { to, reason, routed: true };
  },
});
