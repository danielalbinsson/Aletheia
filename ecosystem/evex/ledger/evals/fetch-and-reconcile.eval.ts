import { defineEval } from "eve/evals";

export default defineEval({
  description: "Reconciliation request fetches transactions then reconciles.",
  async test(t) {
    await t.send(
      [
        "Pull yesterday's transactions and reconcile them against expected totals.",
        "Call the tools you need, then summarize what lined up.",
      ].join(" ")
    );
    t.succeeded();
    t.calledTool("fetch_transactions");
  },
});
