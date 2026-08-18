import { describe, expect, it } from "vitest";
import { parseNaturalSchedule, SUB_HOURLY_MESSAGE } from "./nl";
import { validateCron } from "./schedule";

describe("parseNaturalSchedule", () => {
  it("parses weekdays at 8am", () => {
    const parsed = parseNaturalSchedule("weekdays at 8am");
    expect(parsed.cron).toBe("0 8 * * 1-5");
    expect(parsed.description).toBe("weekdays at 8am");
  });

  it("parses every day with minutes and pm", () => {
    const parsed = parseNaturalSchedule("every day at 8:30pm");
    expect(parsed.cron).toBe("30 20 * * *");
  });

  it("parses 12am and 12pm correctly", () => {
    expect(parseNaturalSchedule("daily at 12am").cron).toBe("0 0 * * *");
    expect(parseNaturalSchedule("daily at 12pm").cron).toBe("0 12 * * *");
  });

  it("parses 24h times", () => {
    expect(parseNaturalSchedule("every day at 17:45").cron).toBe("45 17 * * *");
  });

  it("parses day lists", () => {
    const parsed = parseNaturalSchedule("every monday and thursday at 9am");
    expect(parsed.cron).toBe("0 9 * * 1,4");
    expect(parsed.description).toBe("Mon, Thu at 9am");
  });

  it("parses weekends", () => {
    expect(parseNaturalSchedule("weekends at 10am").cron).toBe("0 10 * * 0,6");
  });

  it("parses word times", () => {
    expect(parseNaturalSchedule("every morning").cron).toBe("0 9 * * *");
    expect(parseNaturalSchedule("weekdays at noon").cron).toBe("0 12 * * 1-5");
  });

  it("parses hourly cadences", () => {
    expect(parseNaturalSchedule("every hour").cron).toBe("0 * * * *");
    expect(parseNaturalSchedule("every 3 hours").cron).toBe("0 */3 * * *");
  });

  it("passes raw cron through", () => {
    expect(parseNaturalSchedule("15 7 * * 1-5").cron).toBe("15 7 * * 1-5");
  });

  it("rejects sub-hourly phrasing with the wake-budget message", () => {
    expect(parseNaturalSchedule("every 15 minutes").error).toBe(
      SUB_HOURLY_MESSAGE
    );
    expect(parseNaturalSchedule("every minute").error).toBe(SUB_HOURLY_MESSAGE);
  });

  it("rejects nonsense honestly", () => {
    expect(parseNaturalSchedule("whenever mercury is in retrograde").error)
      .toBeTruthy();
    expect(parseNaturalSchedule("").error).toBeTruthy();
  });

  it("produces crons the server-side validator accepts", () => {
    for (const phrase of [
      "weekdays at 8am",
      "every day at 8:30pm",
      "every monday and thursday at 9am",
      "every 3 hours",
      "every hour",
    ]) {
      const parsed = parseNaturalSchedule(phrase);
      expect(parsed.cron).toBeTruthy();
      expect(validateCron(parsed.cron as string, "UTC")).toBeUndefined();
    }
  });
});
