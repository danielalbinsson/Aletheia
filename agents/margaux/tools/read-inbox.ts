import { tool } from "eve";

export default tool({
  name: "read_inbox",
  description: "Read the most recent messages from the user's email inbox.",
  reach: { label: "Gmail", kind: "data", access: "read" },
  run: async ({ since }: { since: string }) => {
    // …
    return { since };
  },
});
