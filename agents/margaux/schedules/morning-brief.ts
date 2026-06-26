import { schedule } from "eve";

export default schedule({
  name: "morning_brief",
  cron: "0 7 * * *",
  when: "Every morning at 7am",
  does: "Reads overnight email and writes a short brief of what needs you.",
  consent: "acts-on-its-own",
});
