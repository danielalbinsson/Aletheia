import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

// Writing to the books is irreversible — always ask first. This approval gate
// is what makes the nightly/monthly schedules safe to run autonomously: they
// fire on their own, but a human still confirms every posting.
export default defineTool({
  description: "Write a reconciled journal entry into the accounting system.",
  inputSchema: z.object({
    account: z.string().describe("Chart-of-accounts code"),
    amount: z.number().describe("Entry amount"),
    memo: z.string().describe("What the entry is for"),
  }),
  approval: always(),
  async execute({ account, amount, memo }) {
    return { posted: true, account, amount, memo };
  },
});
