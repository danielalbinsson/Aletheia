import { defineAgent } from "eve";

// Showcase / blueprint agent. Prefer AI Gateway on Vercel; swap the model
// string for any gateway id your project can reach.
export default defineAgent({
  model: "anthropic/claude-sonnet-5",
});
