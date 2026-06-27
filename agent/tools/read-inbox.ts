import { defineTool } from "eve/tools";
import { z } from "zod";

// @reach label: Gmail | kind: data | access: read

export default defineTool({
  description: "Read the most recent messages from the user's email inbox.",
  inputSchema: z.object({
    since: z.string().describe("ISO timestamp — only messages after this time"),
  }),
  async execute({ since }) {
    return { since, messages: [] };
  },
});
