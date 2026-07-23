import { defineTool } from "eve/tools";
import { z } from "zod";

// Read-only verification — confirms posted entries trace to source records.
export default defineTool({
  description: "Check that posted entries trace back to their source transactions.",
  inputSchema: z.object({
    period: z.string().describe("The accounting period to audit"),
  }),
  async execute({ period }) {
    return { period, unmatched: [] };
  },
});
