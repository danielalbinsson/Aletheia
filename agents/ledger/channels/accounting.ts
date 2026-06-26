import { channel } from "eve";
export default channel({ name: "accounting", label: "QuickBooks", access: "read-write",
  description: "Posts reconciled journal entries." });
