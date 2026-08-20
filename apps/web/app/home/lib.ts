/**
 * Shared helpers for the /home shell and its panels (extracted from the old
 * monolithic page.tsx in the redesign phase-1 split).
 */

/** Tolerantly extract a list from an API payload that may be a bare array,
 * a keyed object ({sessions}/{skills}/{data}/{items}), or a keyed map. */
export function pickList<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value as T[];
    }
    for (const key of keys) {
      const value = record[key];
      if (value && typeof value === "object") {
        return Object.values(value as Record<string, unknown>) as T[];
      }
    }
  }
  return [];
}

/** 429 means the box is mid-start (retry), 502 means it can't be reached —
 * the copy keeps the two failure modes distinct. */
export function boxErrorNote(status: number, what: string): string {
  if (status === 429)
    return "Your agent's computer is busy starting up — retry in a minute.";
  if (status === 502)
    return "Couldn't reach your agent's computer — it may still be waking up.";
  return `Couldn't load ${what} — try again shortly.`;
}
