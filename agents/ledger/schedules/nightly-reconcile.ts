import { schedule } from "eve";
export default schedule({
  name: "nightly_reconcile", cron: "0 2 * * *", when: "Every night at 2am",
  does: "Pulls the day's transactions, categorizes, reconciles, and posts clean entries.",
  consent: "acts-on-its-own",
});
