import { defineAgent } from "eve";

export default defineAgent({
  description: "Reviews posted ledger entries for anomalies and unexplained amounts before month close.",
  model: "anthropic/claude-sonnet-5",
});
