/**
 * Keep-awake scheduling (V8 Computer ▸ Screen): agent_schedules rows with
 * deliver 'none' and source 'computer'. Firing wakes the box through the
 * same ensureBoxAwake path every other wake uses and holds it awake for the
 * encoded window — no Hermes run, no delivery, nothing in chat.
 */

export const KEEPAWAKE_SOURCE = "computer";
export const KEEPAWAKE_MIN_MINUTES = 15;
export const KEEPAWAKE_MAX_MINUTES = 240;

const REF_RE = /^\.hermes\/schedules\/keepawake-(\d{1,3})m-[0-9a-f-]{36}\.md$/;

export function clampKeepAwakeMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return KEEPAWAKE_MIN_MINUTES;
  return Math.min(
    KEEPAWAKE_MAX_MINUTES,
    Math.max(KEEPAWAKE_MIN_MINUTES, Math.round(minutes))
  );
}

export function keepAwakePromptRef(id: string, minutes: number): string {
  return `.hermes/schedules/keepawake-${clampKeepAwakeMinutes(minutes)}m-${id}.md`;
}

/**
 * The awake window a schedule encodes, or null when the schedule is not a
 * keep-awake row. Both signals must agree — source 'computer' AND the
 * keepawake prompt_ref shape — so an ordinary schedule can never be
 * short-circuited into a silent wake.
 */
export function keepAwakeMinutes(schedule: {
  source: string;
  prompt_ref: string;
}): number | null {
  if (schedule.source !== KEEPAWAKE_SOURCE) return null;
  const match = REF_RE.exec(schedule.prompt_ref);
  if (!match) return null;
  return clampKeepAwakeMinutes(Number(match[1]));
}
