import { defineMcpClientConnection } from "eve/connections";

// Outbound reach over MCP — posts handoffs and SLA warnings to the support
// team. A different protocol ("mcp") from the OpenAPI connections, which the
// manifest surfaces per connection.
export default defineMcpClientConnection({
  url: "https://mcp.slack.com",
  description: "Posts handoffs and SLA warnings to the support team's Slack.",
  auth: {
    async getToken() {
      return { token: process.env.SLACK_BOT_TOKEN ?? "" };
    },
  },
});
