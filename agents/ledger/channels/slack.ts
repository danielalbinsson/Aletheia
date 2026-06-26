import { channel } from "eve";
export default channel({ name: "slack", label: "Slack #finance", access: "write",
  description: "Posts anomaly flags and the monthly close summary." });
