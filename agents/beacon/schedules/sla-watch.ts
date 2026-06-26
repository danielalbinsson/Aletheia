import { schedule } from "eve";
export default schedule({
  name: "sla_watch", cron: "*/15 * * * *", when: "Every 15 minutes",
  does: "Checks open tickets and warns the team about any nearing an SLA breach.",
  consent: "acts-on-its-own",
});
