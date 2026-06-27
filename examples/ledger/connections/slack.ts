import { defineMcpClientConnection } from "eve/connections";

// Posts anomaly flags and the monthly close summary to the finance channel.
export default defineMcpClientConnection({
  url: "https://mcp.slack.com",
  description: "Posts anomaly flags and the monthly close summary to #finance.",
  auth: {
    async getToken() {
      return { token: process.env.SLACK_BOT_TOKEN ?? "" };
    },
  },
});
