import { tool } from "eve";
export default tool({
  name: "draft_reply",
  description: "Write and send a reply to the customer when confident.",
  reach: { label: "Intercom", kind: "channel", access: "write" },
  run: async ({ text }: { text: string }) => ({ text }),
});
