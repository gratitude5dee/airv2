/**
 * MA11 rate limits + ops counters. Every counted event lands in ops_events
 * (append-only, service-role only); the durable limits count that ledger so
 * they hold across instances, unlike the in-memory guest throttle. Limits
 * fail open on a ledger read error — a counter outage must not take the
 * store down — but the record leg logs loudly so ops sees it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type OpsEventKind =
  | "store_open"
  | "launch"
  | "publish"
  | "upload"
  | "upload_rejected"
  | "guest_session"
  | "grant"
  | "rate_limited";

/** Per-user launch mints (store session or plugin bearer), per hour. */
export const LAUNCHES_PER_HOUR = 60;
/** Publish status flips to `published`, per user per day. */
export const PUBLISHES_PER_DAY = 20;
/** Public-media uploads (bundle, icon, Apps API presign), per user per hour. */
export const UPLOADS_PER_HOUR = 60;
/** Guest grant mints, per owner per hour. */
export const GRANTS_PER_HOUR = 30;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Append one ops event; best-effort, never blocks the request. */
export async function recordOpsEvent(
  supabase: SupabaseClient,
  kind: OpsEventKind,
  userId: string | null,
  ref?: string,
  bytes?: number
): Promise<void> {
  const { error } = await supabase.from("ops_events").insert({
    user_id: userId,
    kind,
    ref: ref ?? null,
    bytes: bytes ?? 0,
  });
  if (error) {
    console.error(
      JSON.stringify({ msg: "ops event insert failed", kind, error: error.message })
    );
  }
}

/** Min gap between anonymous store_open writes, per server instance. */
export const STORE_OPEN_MIN_INTERVAL_MS = 1_000;

let lastStoreOpenAt = 0;

/**
 * Record an anonymous store-home open. The store home needs no session, so
 * an unauthenticated client could otherwise force one insert per request —
 * throttle writes to one per second per instance. The counter stays a
 * useful traffic signal; it is not an exact hit count (the edge cache
 * already absorbs most anonymous hits in production).
 */
export async function recordStoreOpen(supabase: SupabaseClient): Promise<void> {
  const now = Date.now();
  if (now - lastStoreOpenAt < STORE_OPEN_MIN_INTERVAL_MS) return;
  lastStoreOpenAt = now;
  await recordOpsEvent(supabase, "store_open", null);
}

async function countRecent(
  supabase: SupabaseClient,
  kind: OpsEventKind,
  userId: string,
  windowMs: number
): Promise<number | null> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabase
    .from("ops_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) {
    console.error(
      JSON.stringify({ msg: "ops event count failed", kind, error: error.message })
    );
    return null;
  }
  return count ?? 0;
}

/**
 * Mark a user as rate-limited, at most once per window per kind — repeat
 * blocked calls read instead of write, so hammering a limited endpoint
 * cannot grow the ledger or inflate the rate_limited_24h signal.
 */
async function markRateLimited(
  supabase: SupabaseClient,
  userId: string,
  kind: OpsEventKind,
  windowMs: number
): Promise<void> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabase
    .from("ops_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "rate_limited")
    .eq("user_id", userId)
    .eq("ref", kind)
    .gte("created_at", since);
  if (error) {
    console.error(
      JSON.stringify({ msg: "ops event count failed", kind, error: error.message })
    );
    return;
  }
  if ((count ?? 0) > 0) return;
  await recordOpsEvent(supabase, "rate_limited", userId, kind);
}

/**
 * Durable per-user limit check against the ops ledger. Returns true when the
 * user is over the limit for the window; records a `rate_limited` marker so
 * probing shows up in the ops dashboard.
 */
async function overLimit(
  supabase: SupabaseClient,
  kind: OpsEventKind,
  userId: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const count = await countRecent(supabase, kind, userId, windowMs);
  if (count === null) return false; // fail open: counters must not outage the store
  if (count < max) return false;
  await markRateLimited(supabase, userId, kind, windowMs);
  return true;
}

export function launchRateLimited(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  return overLimit(supabase, "launch", userId, LAUNCHES_PER_HOUR, HOUR_MS);
}

export function publishRateLimited(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  return overLimit(supabase, "publish", userId, PUBLISHES_PER_DAY, DAY_MS);
}

/**
 * Rejected attempts count against the hourly upload budget too, so a user
 * spamming invalid presign requests trips this limit instead of writing an
 * unbounded stream of upload_rejected rows.
 */
export async function uploadRateLimited(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const uploads = await countRecent(supabase, "upload", userId, HOUR_MS);
  const rejected = await countRecent(supabase, "upload_rejected", userId, HOUR_MS);
  if (uploads === null || rejected === null) return false; // fail open
  if (uploads + rejected < UPLOADS_PER_HOUR) return false;
  await markRateLimited(supabase, userId, "upload", HOUR_MS);
  return true;
}

export function grantRateLimited(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  return overLimit(supabase, "grant", userId, GRANTS_PER_HOUR, HOUR_MS);
}
