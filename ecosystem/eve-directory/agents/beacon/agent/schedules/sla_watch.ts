import { defineSchedule } from "eve/schedules";

// Fire-and-forget autonomous run: the `markdown` form invokes the agent on a
// cron with no human in the loop. The manifest reports this as an
// acts-on-its-own schedule.
export default defineSchedule({
  cron: "*/15 * * * *",
  markdown:
    "Check open tickets and warn the support team in Slack about any nearing an SLA breach.",
});
