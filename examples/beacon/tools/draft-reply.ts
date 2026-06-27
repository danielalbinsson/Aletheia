import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

// Sending a reply to a customer is irreversible, so it asks for approval first.
export default defineTool({
  description: "Write and send a reply to the customer when confident.",
  inputSchema: z.object({
    conversationId: z.string().describe("The Intercom conversation to reply in"),
    text: z.string().describe("The reply to send"),
  }),
  approval: always(),
  async execute({ conversationId, text }) {
    return { conversationId, sent: true, text };
  },
});
