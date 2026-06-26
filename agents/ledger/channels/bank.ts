import { channel } from "eve";
export default channel({ name: "bank", label: "Bank feed", access: "read",
  description: "Reads transactions from connected accounts. Read-only." });
