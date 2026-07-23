import { defineOpenAPIConnection } from "eve/connections";

// Read-write reach into the accounting system, where reconciled journal
// entries are posted. Authenticated. The post-entry tool's approval gate keeps
// every write human-confirmed.
export default defineOpenAPIConnection({
  description: "Posts reconciled journal entries to the accounting system.",
  spec: "https://quickbooks.api.intuit.com/openapi.json",
  baseUrl: "https://quickbooks.api.intuit.com",
  auth: {
    async getToken() {
      return { token: process.env.QUICKBOOKS_TOKEN ?? "" };
    },
  },
});
