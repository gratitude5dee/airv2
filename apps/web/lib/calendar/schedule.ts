/**
 * agent_schedules primitives: cron validation (5-field, evaluated in the
 * user's timezone) and next-fire computation. Sub-hourly cadences are
 * rejected — the box wake budget is the scarce resource (§6.2).
 */
import parser, { type CronDate, type CronExpression } from "cron-parser";

/** cron-parser's next() is typed as CronDate | IteratorResult<CronDate>. */
function nextDate(interval: CronExpression): Date {
  const value = interval.next();
  if ("toDate" in value) return (value as CronDate).toDate();
  return (value as IteratorResult<CronDate, CronDate>).value.toDate();
}

export const DELIVER_VALUES = ["imessage", "email", "none"] as const;
export type Deliver = (typeof DELIVER_VALUES)[number];

/** Waking hours (user-local) that channel deliveries clamp to, like the Brief. */
export const WAKING_START_HOUR = 8;
export const WAKING_END_HOUR = 22;

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export interface AgentSchedule {
  id: string;
  user_id: string;
  name: string;
  cron: string;
  timezone: string;
  prompt_ref: string;
  deliver: Deliver;
  source: string;
  status: string;
  next_run_at: string;
  last_run_at: string | null;
  failure_count: number;
}

export const SCHEDULE_COLUMNS =
  "id, user_id, name, cron, timezone, prompt_ref, deliver, source, status, " +
  "next_run_at, last_run_at, failure_count";

/**
 * Validate a 5-field cron in the given timezone. Returns an error string or
 * undefined when valid. Rejects sub-hourly cadences (two consecutive fires
 * less than an hour apart).
 */
export function validateCron(cron: string, timezone: string): string | undefined {
  if (cron.trim().split(/\s+/).length !== 5) {
    return "cron must have exactly 5 fields";
  }
  let interval: ReturnType<typeof parser.parseExpression>;
  try {
    interval = parser.parseExpression(cron, { tz: timezone });
  } catch {
    return "invalid cron expression";
  }
  try {
    const first = nextDate(interval).getTime();
    const second = nextDate(interval).getTime();
    const third = nextDate(interval).getTime();
    if (second - first < 60 * 60 * 1000 || third - second < 60 * 60 * 1000) {
      return "sub-hourly schedules are not allowed — waking the box that often would exhaust its start budget";
    }
  } catch {
    return "cron expression never fires";
  }
  return undefined;
}

/** Next fire strictly after `from` (defaults to now), in the user's tz. */
export function nextRunAt(cron: string, timezone: string, from?: Date): Date {
  const interval = parser.parseExpression(cron, {
    tz: timezone,
    currentDate: from ?? new Date(),
  });
  return nextDate(interval);
}

/**
 * Off-hours guard: a delivery-bearing schedule firing outside waking hours
 * is deferred to the next waking-window start in the user's timezone; a
 * `deliver: 'none'` schedule runs whenever it fires.
 */
export function clampToWakingHours(
  fireAt: Date,
  timezone: string,
  deliver: Deliver
): Date {
  if (deliver === "none") return fireAt;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(fireAt)
  );
  if (hour >= WAKING_START_HOUR && hour < WAKING_END_HOUR) return fireAt;
  // Walk forward hour-by-hour until the local clock enters the window.
  const candidate = new Date(fireAt);
  candidate.setUTCMinutes(0, 0, 0);
  for (let index = 0; index < 48; index += 1) {
    candidate.setUTCHours(candidate.getUTCHours() + 1);
    const localHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(candidate)
    );
    if (localHour >= WAKING_START_HOUR && localHour < WAKING_END_HOUR) {
      return candidate;
    }
  }
  return fireAt;
}
