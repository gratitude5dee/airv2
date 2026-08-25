/**
 * CM4 slot primitives: the calendar survives a sleeping box because slots
 * are control-plane rows and claims are compare-and-swap updates — the same
 * concurrency primitive as claimFlush (CM4 task 2), not a new one. Caps are
 * enforced before the call (CC8), and timezones are stored explicitly so a
 * DST transition never moves a launch (CM4 task 7).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const SLOT_PLATFORMS = [
  "instagram",
  "facebook",
  "x",
  "youtube",
  "tiktok",
] as const;

export interface ContentSlot {
  id: string;
  user_id: string;
  platform: string;
  account_ref: string;
  package_ref: string;
  scheduled_at: string;
  timezone: string;
  status: string;
  attempt: number;
  attempt_epoch: number;
  claimed_at: string | null;
  publish_state: Record<string, string>;
  external_id: string | null;
  permalink: string | null;
  last_verdict: string | null;
  error_message: string | null;
  published_at: string | null;
}

const ContentSlotSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  platform: z.string(),
  account_ref: z.string(),
  package_ref: z.string(),
  scheduled_at: z.string(),
  timezone: z.string(),
  status: z.string(),
  attempt: z.number().int(),
  attempt_epoch: z.number().int(),
  claimed_at: z.string().nullable(),
  publish_state: z.record(z.string()),
  external_id: z.string().nullable(),
  permalink: z.string().nullable(),
  last_verdict: z.string().nullable(),
  error_message: z.string().nullable(),
  published_at: z.string().nullable(),
});

export function parseContentSlot(value: unknown): ContentSlot | null {
  const parsed = ContentSlotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const SLOT_COLUMNS =
  "id, user_id, platform, account_ref, package_ref, scheduled_at, timezone, " +
  "status, attempt, attempt_epoch, claimed_at, publish_state, external_id, " +
  "permalink, last_verdict, error_message, published_at";

/** A claim left behind by a dead invocation becomes claimable again. */
export const CLAIM_TTL_MS = 15 * 60 * 1000;

/**
 * Claim a scheduled slot: the update only matches while attempt_epoch is
 * unchanged and the slot is still claimable, so exactly one of any number of
 * racing invocations wins (CM4 task 4). Also reclaims 'publishing' slots
 * whose claim is stale — the previous worker died; publish_state carries
 * whatever step it checkpointed.
 */
export async function claimSlot(
  supabase: SupabaseClient,
  slot: Pick<ContentSlot, "id" | "attempt_epoch" | "status">
): Promise<ContentSlot | undefined> {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("content_slots")
    .update({
      status: "publishing",
      attempt_epoch: slot.attempt_epoch + 1,
      claimed_at: nowIso,
    })
    .eq("id", slot.id)
    .eq("attempt_epoch", slot.attempt_epoch);
  if (slot.status === "publishing") {
    query = query
      .eq("status", "publishing")
      .lt("claimed_at", new Date(Date.now() - CLAIM_TTL_MS).toISOString());
  } else {
    query = query.eq("status", "scheduled");
  }
  const { data } = await query.select(SLOT_COLUMNS);
  if (!data || data.length === 0) return undefined;
  return parseContentSlot(data[0]) ?? undefined;
}

export interface CapHeadroom {
  allowed: boolean;
  used: number;
  cap: number;
  /** When the oldest publish inside the window ages out — the next slot
   * that can fire once the cap is hit. */
  nextWindow: string | null;
}

/**
 * CC8: count this account's publishes in the trailing 24h before the call.
 * At the cap, the slot defers to nextWindow instead of failing at fire time.
 */
export async function capHeadroom(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  accountRef: string,
  dailyCap: number
): Promise<CapHeadroom> {
  const windowStart = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabase
    .from("content_slots")
    .select("published_at")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("account_ref", accountRef)
    .eq("status", "published")
    .gte("published_at", windowStart)
    .order("published_at", { ascending: true });
  const published = (data ?? []) as Array<{ published_at: string }>;
  const used = published.length;
  const oldest = published[0]?.published_at ?? null;
  return {
    allowed: used < dailyCap,
    used,
    cap: dailyCap,
    nextWindow:
      used >= dailyCap && oldest
        ? new Date(new Date(oldest).getTime() + 24 * 3600_000).toISOString()
        : null,
  };
}

const LOCAL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function wallClockUtc(timestamp: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
}

/**
 * Resolve a wall-clock time in an IANA zone to an instant. Slots store the
 * instant plus the authoring timezone; "09:00 America/Los_Angeles" fires at
 * 09:00 local on either side of a DST boundary (CM4 task 7).
 */
export function zonedTimeToInstant(local: string, timeZone: string): Date {
  const match = LOCAL_TIME.exec(local);
  if (!match) {
    throw new Error(`invalid local time: ${local}`);
  }
  const [, year, month, day, hour, minute, second] = match;
  const target = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0")
  );
  // Two fixed-point iterations converge for every real UTC offset,
  // including across DST transitions.
  let instant = target;
  for (let pass = 0; pass < 2; pass += 1) {
    instant += target - wallClockUtc(instant, timeZone);
  }
  return new Date(instant);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
