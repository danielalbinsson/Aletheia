import { defineTool } from "eve/tools";
import { z } from "zod";

// Internal classification — no external reach, no approval.
export default defineTool({
  description: "Assign each transaction a category from the chart of accounts.",
  inputSchema: z.object({
    ids: z.array(z.string()).describe("Transaction ids to categorize"),
  }),
  async execute({ ids }) {
    return { count: ids.length };
  },
});
