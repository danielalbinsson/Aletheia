import { channel } from "eve";
export default channel({ name: "intercom", label: "Intercom", access: "read-write",
  description: "Reads and replies to live customer conversations." });
