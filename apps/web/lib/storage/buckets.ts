/**
 * MA4 per-user public prefix accounting (user_buckets: user_id, prefix,
 * bytes_used, quota_bytes). The prefix is u/<username>/ on the platform
 * bucket; quota refusal is a clean 413 before any byte leaves the server.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MediaGuardError } from "./guard";

export interface UserBucket {
  user_id: string;
  prefix: string;
  bytes_used: number;
  quota_bytes: number;
}

/**
 * Resolve (or provision) the user's bucket row. Requires a username — public
 * URLs are keyed by it, so media publishing is gated on onboarding step 1.
 */
export async function ensureUserBucket(
  supabase: SupabaseClient,
  userId: string
): Promise<UserBucket> {
  const { data: existing } = await supabase
    .from("user_buckets")
    .select("user_id, prefix, bytes_used, quota_bytes")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing as UserBucket;
  const { data: user } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  const username = (user?.username as string | null) ?? null;
  if (!username) {
    throw new MediaGuardError("set a username before publishing media", 409);
  }
  const prefix = `u/${username}/`;
  const { data: inserted, error } = await supabase
    .from("user_buckets")
    .insert({ user_id: userId, prefix })
    .select("user_id, prefix, bytes_used, quota_bytes")
    .single();
  if (error) {
    // Concurrent provision: re-read the row that won.
    const { data: raced } = await supabase
      .from("user_buckets")
      .select("user_id, prefix, bytes_used, quota_bytes")
      .eq("user_id", userId)
      .maybeSingle();
    if (raced) return raced as UserBucket;
    throw new Error(`user bucket provision failed: ${error.message}`);
  }
  return inserted as UserBucket;
}

/** Bytes charged by reserveQuota; released exactly once if the upload fails. */
export interface QuotaHold {
  userId: string;
  bytes: number;
}

/**
 * Reserve-then-upload: check and charge are one statement (user_bucket_reserve),
 * so two uploads racing under the quota cannot both pass on a stale row. Throws
 * the same clean 413 as assertWithinQuota when the bytes would overflow. The
 * bucket row must exist (ensureUserBucket).
 */
export async function reserveQuota(
  supabase: SupabaseClient,
  userId: string,
  bytes: number
): Promise<QuotaHold> {
  const { data, error } = await supabase.rpc("user_bucket_reserve", {
    p_user_id: userId,
    p_bytes: bytes,
  });
  if (error) throw new Error(`quota reserve failed: ${error.message}`);
  if (data !== true) {
    throw new MediaGuardError(`storage quota exceeded (${bytes} more bytes would overflow)`, 413);
  }
  return { userId, bytes };
}

/**
 * Give a reservation back when the upload it covered did not complete. Best
 * effort: a failure here leaves the bytes charged (never an upload uncharged)
 * and is logged content-free.
 */
export async function releaseQuota(supabase: SupabaseClient, hold: QuotaHold): Promise<void> {
  const { error } = await supabase.rpc("user_bucket_release", {
    p_user_id: hold.userId,
    p_bytes: hold.bytes,
  });
  if (error) {
    console.error(
      JSON.stringify({ msg: "quota release failed", bytes: hold.bytes, error: error.message })
    );
  }
}

/** Quota check before a write; throws a clean 413 when it would overflow. */
export function assertWithinQuota(bucket: UserBucket, addBytes: number): void {
  if (bucket.bytes_used + addBytes > bucket.quota_bytes) {
    throw new MediaGuardError(
      `storage quota exceeded (${bucket.bytes_used} + ${addBytes} > ${bucket.quota_bytes})`,
      413
    );
  }
}
