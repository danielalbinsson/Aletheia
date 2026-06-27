import { tool } from "eve";
export default tool({
  name: "post_entry",
  description: "Write a reconciled journal entry into the accounting system.",
  reach: { label: "QuickBooks", kind: "api", access: "write" },
  run: async ({ entry }: { entry: unknown }) => ({ entry }),
});
