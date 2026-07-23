import { defineOpenAPIConnection } from "eve/connections";

// Outbound reach: the live customer messaging API. Authenticated, so the
// manifest reports `hasAuthorization: true`. The filename ("intercom") is the
// connection's runtime name.
export default defineOpenAPIConnection({
  description: "Reads and replies to live customer conversations in Intercom.",
  spec: "https://api.intercom.io/openapi.json",
  baseUrl: "https://api.intercom.io",
  auth: {
    async getToken() {
      return { token: process.env.INTERCOM_API_KEY ?? "" };
    },
  },
});
