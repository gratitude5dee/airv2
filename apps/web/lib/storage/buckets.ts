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

/** Quota check before a write; throws a clean 413 when it would overflow. */
export function assertWithinQuota(bucket: UserBucket, addBytes: number): void {
  if (bucket.bytes_used + addBytes > bucket.quota_bytes) {
    throw new MediaGuardError(
      `storage quota exceeded (${bucket.bytes_used} + ${addBytes} > ${bucket.quota_bytes})`,
      413
    );
  }
}

/**
 * Optimistic usage bump (compare-and-set on bytes_used, same shape as guest
 * grant redemption). Retries a handful of times under contention.
 */
export async function addUsage(
  supabase: SupabaseClient,
  userId: string,
  deltaBytes: number
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: row } = await supabase
      .from("user_buckets")
      .select("bytes_used")
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) return;
    const current = row.bytes_used as number;
    const next = Math.max(0, current + deltaBytes);
    const { data: updated, error } = await supabase
      .from("user_buckets")
      .update({ bytes_used: next })
      .eq("user_id", userId)
      .eq("bytes_used", current)
      .select("user_id");
    if (error) throw new Error(`usage update failed: ${error.message}`);
    if ((updated?.length ?? 0) > 0) return;
  }
  throw new Error("usage update failed: contention");
}
