import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Condense a set of messages or pages into a short, honest brief.",
  inputSchema: z.object({
    items: z.array(z.string()),
  }),
  async execute({ items }) {
    return { count: items.length, summary: "" };
  },
});
