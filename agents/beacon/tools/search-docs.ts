import { tool } from "eve";
export default tool({
  name: "search_docs",
  description: "Search the help center and internal docs for an answer.",
  reach: { label: "Help center", kind: "data", access: "read" },
  run: async ({ q }: { q: string }) => ({ q }),
});
