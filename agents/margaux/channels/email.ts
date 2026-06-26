import { channel } from "eve";

export default channel({
  name: "email",
  label: "Gmail",
  access: "read",
  description: "Reads the user's inbox. Never sends without explicit confirmation.",
});
