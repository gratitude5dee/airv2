/**
 * Natural-language schedule parsing (V4): "weekdays at 8am" → a 5-field cron
 * echoed back before anything is saved. Pure and dependency-free so it runs
 * client-side; the server re-validates with validateCron (which enforces the
 * sub-hourly rejection authoritatively — the box wake budget is the scarce
 * resource, §6.2).
 */

export const SUB_HOURLY_MESSAGE =
  "sub-hourly schedules are not allowed — waking the box that often would exhaust its start budget";

export interface ParsedSchedule {
  cron?: string;
  /** Human echo of what the cron means, shown next to the raw expression. */
  description?: string;
  error?: string;
}

const DAY_NUMBERS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const WORD_TIMES: Record<string, [number, number]> = {
  midnight: [0, 0],
  morning: [9, 0],
  noon: [12, 0],
  midday: [12, 0],
  afternoon: [15, 0],
  evening: [18, 0],
  night: [21, 0],
};

interface TimeOfDay {
  hour: number;
  minute: number;
}

/** "8am" / "8:30 pm" / "17:45" / "noon" → 24h time, or undefined. */
function parseTime(text: string): TimeOfDay | undefined {
  const word = WORD_TIMES[text.trim()];
  if (word) return { hour: word[0], minute: word[1] };
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(text.trim());
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59) return undefined;
  if (meridiem === "am") {
    if (hour < 1 || hour > 12) return undefined;
    if (hour === 12) hour = 0;
  } else if (meridiem === "pm") {
    if (hour < 1 || hour > 12) return undefined;
    if (hour !== 12) hour += 12;
  } else if (hour > 23) {
    return undefined;
  }
  return { hour, minute };
}

function formatTime(time: TimeOfDay): string {
  const meridiem = time.hour < 12 ? "am" : "pm";
  const hour = time.hour % 12 === 0 ? 12 : time.hour % 12;
  const minute = time.minute === 0 ? "" : `:${String(time.minute).padStart(2, "0")}`;
  return `${hour}${minute}${meridiem}`;
}

/** "monday and wednesday" / "mon, wed, fri" → sorted unique day numbers. */
function parseDayList(text: string): number[] | undefined {
  const parts = text
    .split(/\s*(?:,|and|&)\s*/i)
    .map((p) => p.trim().toLowerCase().replace(/s$/, ""))
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  const days: number[] = [];
  for (const part of parts) {
    const day = DAY_NUMBERS[part];
    if (day === undefined) return undefined;
    if (!days.includes(day)) days.push(day);
  }
  return days.sort((a, b) => a - b);
}

function describeDays(days: number[]): string {
  if (days.join(",") === "1,2,3,4,5") return "weekdays";
  if (days.join(",") === "0,6") return "weekends";
  return days.map((d) => DAY_LABELS[d]).join(", ");
}

/**
 * Parse a natural-language cadence into a cron. Recognizes:
 *   "every day at 8am" / "daily at 8:30pm" / "every morning"
 *   "weekdays at 8am" / "every weekend at 10"
 *   "every monday at 9am" / "mon and thu at 7pm"
 *   "every hour" / "every 3 hours"
 *   a raw 5-field cron (passed through untouched)
 * Sub-hourly phrasing ("every 15 minutes") is rejected with the honest
 * wake-budget message rather than silently rounded up.
 */
export function parseNaturalSchedule(input: string): ParsedSchedule {
  const text = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return { error: "describe when it should run" };

  // Raw (numeric) cron passthrough — validated for cadence server-side.
  if (/^[\d*,/-]+( [\d*,/-]+){4}$/.test(text)) {
    return { cron: text, description: "custom cron" };
  }

  const subHourly = /every\s+(\d+)?\s*(minute|min|second|sec)s?\b/.exec(text);
  if (subHourly) {
    return { error: SUB_HOURLY_MESSAGE };
  }

  const everyNHours = /^every\s+(\d+)\s*(?:hour|hr)s?$/.exec(text);
  if (everyNHours) {
    const n = Number(everyNHours[1]);
    if (n < 1) return { error: SUB_HOURLY_MESSAGE };
    if (n > 23) return { error: "use a daily schedule instead" };
    return {
      cron: n === 1 ? "0 * * * *" : `0 */${n} * * *`,
      description: n === 1 ? "every hour, on the hour" : `every ${n} hours`,
    };
  }
  if (/^(every hour|hourly)$/.test(text)) {
    return { cron: "0 * * * *", description: "every hour, on the hour" };
  }

  // "<days-part> [at <time>]" where days-part is daily/weekday/weekend/list.
  const match =
    /^(?:every\s+|each\s+|on\s+)?(.+?)(?:\s+(?:at|@)\s+(.+))?$/.exec(text);
  if (!match?.[1]) return { error: "couldn't understand that — try \"weekdays at 8am\"" };
  let daysPart = match[1].trim();
  let timePart = match[2]?.trim();

  // "every morning" / "daily" style: the days-part may itself be a time word.
  if (!timePart && WORD_TIMES[daysPart]) {
    timePart = daysPart;
    daysPart = "day";
  }

  const time = parseTime(timePart ?? "9am");
  if (!time) {
    return { error: `couldn't understand the time "${timePart ?? ""}"` };
  }

  let dayField: string;
  let dayLabel: string;
  if (/^(day|days|daily|everyday|every day)$/.test(daysPart)) {
    dayField = "*";
    dayLabel = "every day";
  } else if (/^weekdays?$/.test(daysPart)) {
    dayField = "1-5";
    dayLabel = "weekdays";
  } else if (/^weekends?$/.test(daysPart)) {
    dayField = "0,6";
    dayLabel = "weekends";
  } else {
    const days = parseDayList(daysPart);
    if (!days) {
      return { error: "couldn't understand that — try \"weekdays at 8am\"" };
    }
    dayField = days.join(",");
    dayLabel = describeDays(days);
  }

  return {
    cron: `${time.minute} ${time.hour} * * ${dayField}`,
    description: `${dayLabel} at ${formatTime(time)}`,
  };
}
