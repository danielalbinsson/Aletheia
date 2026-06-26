import { channel } from "eve";
export default channel({ name: "slack", label: "Slack #support", access: "write",
  description: "Posts handoffs and SLA warnings to the support team." });
