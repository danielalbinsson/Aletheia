import { defineOpenAPIConnection } from "eve/connections";

// Read-only reach into the bank feed. Authenticated.
export default defineOpenAPIConnection({
  description: "Reads transactions from connected bank and card accounts.",
  spec: "https://api.examplebank.com/openapi.json",
  baseUrl: "https://api.examplebank.com",
  auth: {
    async getToken() {
      return { token: process.env.BANK_API_KEY ?? "" };
    },
  },
});
