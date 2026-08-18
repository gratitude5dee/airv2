/**
 * Expand a schedule's cron into concrete fire times inside a window — used
 * by the Calendar tab to place schedule pills on the month/week grids.
 * Pure (cron-parser only) so it runs client-side against Postgres metadata
 * without waking the box.
 */
import parser, { type CronDate, type CronExpression } from "cron-parser";

function nextDate(interval: CronExpression): Date {
  const value = interval.next();
  if ("toDate" in value) return (value as CronDate).toDate();
  return (value as IteratorResult<CronDate, CronDate>).value.toDate();
}

export function cronOccurrences(
  cron: string,
  timezone: string,
  start: Date,
  end: Date,
  // Enough for an hourly cron across the 42-day month grid (1008 fires).
  cap = 1100
): Date[] {
  let interval: CronExpression;
  try {
    interval = parser.parseExpression(cron, {
      tz: timezone,
      // currentDate is exclusive in cron-parser: step back so an occurrence
      // landing exactly on `start` is still included in the window.
      currentDate: new Date(start.getTime() - 1),
    });
  } catch {
    return [];
  }
  const occurrences: Date[] = [];
  for (let index = 0; index < cap; index += 1) {
    let fire: Date;
    try {
      fire = nextDate(interval);
    } catch {
      break;
    }
    if (fire.getTime() > end.getTime()) break;
    occurrences.push(fire);
  }
  return occurrences;
}
