import { subagent } from "eve";
export default subagent({ name: "auditor",
  description: "Reviews posted entries and confirms they trace back to source transactions." });
