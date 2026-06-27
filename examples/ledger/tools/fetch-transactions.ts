import { tool } from "eve";
export default tool({
  name: "fetch_transactions",
  description: "Pull the day's transactions from connected bank and card accounts.",
  reach: { label: "Bank feed", kind: "data", access: "read" },
  run: async ({ date }: { date: string }) => ({ date }),
});
