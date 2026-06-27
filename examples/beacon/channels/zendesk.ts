import { channel } from "eve";
export default channel({ name: "zendesk", label: "Zendesk", access: "read",
  description: "Reads ticket history for context." });
