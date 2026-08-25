/**
 * Shared helpers for the /home shell and its panels (extracted from the old
 * monolithic page.tsx in the redesign phase-1 split).
 */
import { asRecord } from "@/lib/records";

/** Tolerantly extract a list from an API payload that may be a bare array,
 * a keyed object ({sessions}/{skills}/{data}/{items}), or a keyed map. */
export function pickList<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const record = asRecord(payload);
  if (record) {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value as T[];
    }
    for (const key of keys) {
      const inner = asRecord(record[key]);
      if (inner) return Object.values(inner) as T[];
    }
  }
  return [];
}

/** Tool names that mean the agent is driving its own browser/desktop, so the
 * live computer view should surface inline (D14: shared by Chat and the
 * Browser panel). */
export function isComputerTool(name: string | undefined): boolean {
  return (
    typeof name === "string" &&
    (name.startsWith("browser") || name.startsWith("computer"))
  );
}

/** D8: how close to the bottom (px) still counts as "at the bottom". */
export const SCROLL_STICK_THRESHOLD_PX = 48;

/** D8: whether a scroll container is at (or near) its bottom — the chat log
 * only auto-follows new messages while this holds. */
export function isNearBottom(
  el: { scrollTop: number; scrollHeight: number; clientHeight: number },
  threshold: number = SCROLL_STICK_THRESHOLD_PX
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

let messageIdCounter = 0;

/** D11: stable per-visit message ids so chat lists never key by index. */
export function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

/** D11: replace the last (streaming) message in place, keeping its id so
 * React doesn't remount the bubble mid-stream. */
export function replaceLast<T extends { id: string }>(
  list: T[],
  patch: Omit<T, "id">
): T[] {
  const last = list[list.length - 1];
  if (last === undefined) return list;
  return [...list.slice(0, -1), { ...patch, id: last.id } as T];
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
