import { defineTool } from "eve/tools";
import { z } from "zod";

// @reach label: Web search | kind: api | access: read

export default defineTool({
  description: "Search the public web and read pages to gather context.",
  inputSchema: z.object({
    query: z.string(),
  }),
  async execute({ query }) {
    return { query, results: [] };
  },
});
