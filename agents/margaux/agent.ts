// eve agent definition. The files in this directory ARE the agent;
// this file is the entry point that wires them together.
import { defineAgent } from "eve";

export default defineAgent({
  name: "Margaux",
  model: "claude-opus-4",
  description:
    "A research assistant that reads your inbox each morning and surfaces what actually needs you.",
  instructions: "./instructions.md",
  tools: ["./tools/read-inbox.ts", "./tools/search-web.ts", "./tools/summarize.ts"],
  skills: ["./skills/triage"],
  channels: ["./channels/email.ts"],
  schedules: ["./schedules/morning-brief.ts"],
});
