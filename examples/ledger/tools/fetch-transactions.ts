import { defineTool } from "eve/tools";
import { z } from "zod";

// Read-only pull from the bank feed — no approval.
export default defineTool({
  description: "Pull the day's transactions from connected bank and card accounts.",
  inputSchema: z.object({
    date: z.string().describe("The day to fetch, as an ISO date"),
  }),
  async execute({ date }) {
    return { date, transactions: [] };
  },
});
