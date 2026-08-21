import { describe, expect, it } from "vitest";
import {
  clampToWakingHours,
  isValidTimeZone,
  nextRunAt,
  parseAgentSchedule,
  validateCron,
} from "./schedule";

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("validateCron", () => {
  it("accepts an hourly-or-slower 5-field cron", () => {
    expect(validateCron("0 9 * * *", "UTC")).toBeUndefined();
    expect(validateCron("0 */2 * * 1-5", "America/New_York")).toBeUndefined();
  });

  it("rejects the wrong field count", () => {
    expect(validateCron("0 9 * *", "UTC")).toMatch(/5 fields/);
    expect(validateCron("0 9 * * * *", "UTC")).toMatch(/5 fields/);
  });

  it("rejects sub-hourly cadences — the box wake budget is scarce", () => {
    expect(validateCron("*/15 * * * *", "UTC")).toMatch(/sub-hourly/);
    expect(validateCron("0,30 * * * *", "UTC")).toMatch(/sub-hourly/);
  });

  it("rejects garbage expressions", () => {
    expect(validateCron("not a cron at all", "UTC")).toBeDefined();
  });
});

describe("nextRunAt", () => {
  it("computes the next fire strictly after `from` in the given tz", () => {
    const from = new Date("2026-08-18T10:30:00Z");
    const next = nextRunAt("0 9 * * *", "UTC", from);
    expect(next.toISOString()).toBe("2026-08-19T09:00:00.000Z");
  });

  it("respects the timezone", () => {
    const from = new Date("2026-08-18T10:30:00Z"); // 03:30 in LA
    const next = nextRunAt("0 9 * * *", "America/Los_Angeles", from);
    expect(next.toISOString()).toBe("2026-08-18T16:00:00.000Z"); // 9am PDT
  });
});

describe("clampToWakingHours", () => {
  it("leaves in-window deliveries alone", () => {
    const fireAt = new Date("2026-08-18T17:00:00Z"); // 10am PDT
    expect(
      clampToWakingHours(fireAt, "America/Los_Angeles", "imessage").getTime()
    ).toBe(fireAt.getTime());
  });

  it("defers an off-hours delivery to the waking window", () => {
    const fireAt = new Date("2026-08-18T10:00:00Z"); // 3am PDT
    const clamped = clampToWakingHours(fireAt, "America/Los_Angeles", "imessage");
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        hour12: false,
      }).format(clamped)
    );
    expect(hour).toBeGreaterThanOrEqual(8);
    expect(hour).toBeLessThan(22);
    expect(clamped.getTime()).toBeGreaterThan(fireAt.getTime());
  });

  it("never defers a silent (deliver: none) schedule", () => {
    const fireAt = new Date("2026-08-18T10:00:00Z");
    expect(
      clampToWakingHours(fireAt, "America/Los_Angeles", "none").getTime()
    ).toBe(fireAt.getTime());
  });
});

describe("parseAgentSchedule", () => {
  it("accepts a selected schedule row", () => {
    expect(
      parseAgentSchedule({
        id: "schedule-1",
        user_id: "user-1",
        name: "Morning",
        cron: "0 9 * * *",
        timezone: "UTC",
        prompt_ref: ".hermes/schedules/schedule-1.md",
        deliver: "imessage",
        source: "user",
        status: "active",
        next_run_at: "2026-08-19T09:00:00Z",
        last_run_at: null,
        failure_count: 0,
        one_shot: false,
      })
    ).toMatchObject({ id: "schedule-1", deliver: "imessage" });
  });

  it("rejects a row with an invalid delivery channel", () => {
    expect(parseAgentSchedule({ id: "schedule-1", deliver: "sms" })).toBeNull();
  });
});
