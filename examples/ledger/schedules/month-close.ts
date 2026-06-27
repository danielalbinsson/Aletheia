import { defineSchedule } from "eve/schedules";

// Fires on the 1st of each month. Runs the close and posts a summary; the
// posting tool's approval gate is where you review before anything lands.
export default defineSchedule({
  cron: "0 6 1 * *",
  markdown:
    "Run the full month-end close and post the summary to #finance for review.",
});
