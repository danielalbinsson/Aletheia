import { defineTool } from "eve/tools";
import { z } from "zod";

// A safety stop — halts and raises a transaction for a human. No approval
// needed: flagging is the conservative action.
export default defineTool({
  description: "Halt and raise a transaction that breaks a rule or can't be placed.",
  inputSchema: z.object({
    id: z.string().describe("Transaction id"),
    reason: z.string().describe("Why it was flagged"),
  }),
  async execute({ id, reason }) {
    return { id, reason, flagged: true };
  },
});
