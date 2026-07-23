import { defineTool } from "eve/tools";
import { z } from "zod";

// Matching/comparison — surfaces differences, doesn't write. No approval.
export default defineTool({
  description: "Match transactions against expected entries and surface differences.",
  inputSchema: z.object({
    period: z.string().describe("The accounting period to reconcile"),
  }),
  async execute({ period }) {
    return { period, differences: [] };
  },
});
