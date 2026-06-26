import { tool } from "eve";
export default tool({
  name: "categorize",
  description: "Assign each transaction a category from the chart of accounts.",
  run: async ({ ids }: { ids: string[] }) => ({ count: ids.length }),
});
