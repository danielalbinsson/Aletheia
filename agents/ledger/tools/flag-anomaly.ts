import { tool } from "eve";
export default tool({
  name: "flag_anomaly",
  description: "Halt and raise a transaction that breaks a rule or can't be placed.",
  run: async ({ id, reason }: { id: string; reason: string }) => ({ id, reason }),
});
