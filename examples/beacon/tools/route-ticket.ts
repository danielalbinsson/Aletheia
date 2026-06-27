import { tool } from "eve";
export default tool({
  name: "route_ticket",
  description: "Hand a hard or sensitive ticket to the right human, with context.",
  run: async ({ to }: { to: string }) => ({ to }),
});
