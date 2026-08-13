import { defineSchedule } from "eve/schedules";

// Fires every night with no human in the loop (acts on its own). It can post
// clean entries because post-entry still asks for approval per write.
export default defineSchedule({
  cron: "0 2 * * *",
  markdown:
    "Pull the day's transactions, categorize and reconcile them, and post the clean entries.",
});
