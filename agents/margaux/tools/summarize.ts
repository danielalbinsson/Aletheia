import { tool } from "eve";

export default tool({
  name: "summarize",
  description: "Condense a set of messages or pages into a short, honest brief.",
  run: async ({ items }: { items: string[] }) => {
    return { count: items.length };
  },
});
