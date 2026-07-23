import { defineTool } from "eve/tools";
import { z } from "zod";

// Read-only lookup — runs without approval.
export default defineTool({
  description: "Search the help center and internal docs for an answer.",
  inputSchema: z.object({
    query: z.string().describe("What to search for"),
    limit: z.number().optional().describe("Max results to return"),
  }),
  async execute({ query, limit }) {
    return { query, limit: limit ?? 5, results: [] };
  },
});
