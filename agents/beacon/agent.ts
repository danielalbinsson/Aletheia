import { defineAgent } from "eve";

export default defineAgent({
  name: "Beacon",
  model: "claude-sonnet-4",
  description:
    "A front-line support agent that answers what it can, routes what it can't, and keeps every conversation warm.",
  instructions: "./instructions.md",
  tools: [
    "./tools/search-docs.ts",
    "./tools/draft-reply.ts",
    "./tools/route-ticket.ts",
  ],
  skills: ["./skills/tone"],
  channels: [
    "./channels/intercom.ts",
    "./channels/slack.ts",
    "./channels/zendesk.ts",
  ],
  schedules: ["./schedules/sla-watch.ts"],
});
