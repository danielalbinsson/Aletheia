import { tool } from "eve";
export default tool({
  name: "reconcile",
  description: "Match transactions against expected entries and surface differences.",
  run: async ({ period }: { period: string }) => ({ period }),
});
