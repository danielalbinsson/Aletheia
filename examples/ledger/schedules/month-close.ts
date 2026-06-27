import { schedule } from "eve";
export default schedule({
  name: "month_close", cron: "0 6 1 * *", when: "The 1st of each month",
  does: "Runs the full month-end close and posts the summary for your review.",
  consent: "asks-first",
});
