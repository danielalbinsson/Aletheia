import { defineOpenAPIConnection } from "eve/connections";

// Read-only reach for ticket history. No auth declared here (a public or
// network-scoped read), so the manifest reports `hasAuthorization: false` —
// an honest signal that this reach is unauthenticated.
export default defineOpenAPIConnection({
  description: "Reads Zendesk ticket history for context.",
  spec: "https://developer.zendesk.com/zendesk/oas.yaml",
  baseUrl: "https://example.zendesk.com/api/v2",
});
