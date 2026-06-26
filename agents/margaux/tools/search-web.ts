import { tool } from "eve";

export default tool({
  name: "search_web",
  description: "Search the public web and read pages to gather context.",
  reach: { label: "Web search", kind: "api", access: "read" },
  run: async ({ query }: { query: string }) => {
    return { query };
  },
});
