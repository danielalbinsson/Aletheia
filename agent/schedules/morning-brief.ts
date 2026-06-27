import { defineSchedule } from "eve/schedules";

// @when Every morning at 7am
// @consent acts-on-its-own

export default defineSchedule({
  cron: "0 7 * * *",
  markdown:
    "Read overnight email and write a short brief of what needs the user.",
});
