/**
 * MA4 presigned-upload reservation + confirm. The presign leg pre-charges the
 * declared size against the quota AND records the charge server-side
 * (pending_uploads); the confirm leg consumes that reservation exactly once
 * and reconciles against the stored charge — a client can never influence
 * how much is released. Confirm also runs the full MA8 guard on the actual
 * bytes (allowlist, text vault scrub, EXIF strip): a violating object is
 * deleted, a sanitized image is rewritten in place.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allowedMediaType,
  guardMediaUpload,
  MEDIA_MAX_BYTES,
  MediaGuardError,
} from "./guard";
import { releaseQuota, reserveQuota } from "./buckets";
import {
  deleteObject,
  getObject,
  headObject,
  publicUrl,
  putObject,
} from "./r2";

/** Lifetime of a presigned PUT; a pending reservation older than this can
 * never be completed, so the sweeper releases its charge. */
export const PRESIGN_TTL_SECONDS = 600;

/** Sweep cutoff: presign TTL plus a grace window so an upload that lands
 * right at the deadline still gets its confirm in before the reservation
 * is reclaimed. */
export const SWEEP_AFTER_SECONDS = PRESIGN_TTL_SECONDS + 15 * 60;

/** Record the pre-charge so confirm reconciles against a server-side value. */
export async function reserveUpload(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  chargedBytes: number
): Promise<void> {
  const { error } = await supabase
    .from("pending_uploads")
    .insert({ key, user_id: userId, charged_bytes: chargedBytes });
  if (error) {
    throw new Error(`upload reservation failed: ${error.message}`);
  }
}

/** Consume the reservation (single-use): delete-returning the charge. */
async function takeReservation(
  supabase: SupabaseClient,
  userId: string,
  key: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("pending_uploads")
    .delete()
    .eq("key", key)
    .eq("user_id", userId)
    .select("charged_bytes");
  if (error) {
    throw new Error(`upload reservation lookup failed: ${error.message}`);
  }
  if (!data || data.length === 0) return null;
  return Number(data[0]?.charged_bytes ?? 0);
}

interface StaleUpload {
  key: string;
  user_id: string;
}

/** Stale reservations handled per sweep; the rest wait for the next tick. */
export const SWEEP_BATCH = 200;

/**
 * Release abandoned presign reservations: a pending_uploads row older than
 * the presign TTL belongs to an upload that was never confirmed, so its
 * pre-charge would leak quota forever. Whatever the client PUT at the key
 * never went through confirm's guard, so the object is deleted before the
 * charge goes back — an R2 failure leaves the row (and the charge) for the
 * next sweep. Delete-returning the row keeps the release exactly-once even
 * across concurrent sweeps. The cutoff includes a grace window past the
 * presign expiry so a confirm racing the sweep still finds its reservation.
 */
export async function sweepAbandonedUploads(
  supabase: SupabaseClient,
  ttlSeconds: number = SWEEP_AFTER_SECONDS
): Promise<number> {
  const cutoff = new Date(Date.now() - ttlSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from("pending_uploads")
    .select("key, user_id")
    .lt("created_at", cutoff)
    .limit(SWEEP_BATCH);
  if (error) {
    throw new Error(`upload sweep failed: ${error.message}`);
  }
  let released = 0;
  for (const row of (data ?? []) as StaleUpload[]) {
    try {
      await deleteObject(row.key);
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "sweeper object delete failed",
          error: error instanceof Error ? error.message : String(error),
        })
      );
      continue;
    }
    const charged = await takeReservation(supabase, row.user_id, row.key);
    if (charged === null) continue;
    if (charged > 0) {
      await releaseQuota(supabase, { userId: row.user_id, bytes: charged });
    }
    released += 1;
  }
  return released;
}

export type ConfirmResult =
  | { ok: true; publicUrl: string }
  | { ok: false; status: number; error: string };

export async function confirmUpload(
  supabase: SupabaseClient,
  userId: string,
  key: string
): Promise<ConfirmResult> {
  const charged = await takeReservation(supabase, userId, key);
  if (charged === null) {
    return { ok: false, status: 409, error: "no pending upload for key" };
  }
  const hold = { userId, bytes: charged };
  const head = await headObject(key);
  if (!head) {
    await releaseQuota(supabase, hold);
    return { ok: false, status: 404, error: "object not found" };
  }
  if (head.sizeBytes > MEDIA_MAX_BYTES || !allowedMediaType(head.contentType)) {
    await deleteObject(key);
    await releaseQuota(supabase, hold);
    return { ok: false, status: 422, error: "upload rejected" };
  }
  const object = await getObject(key);
  if (!object) {
    await releaseQuota(supabase, hold);
    return { ok: false, status: 404, error: "object not found" };
  }
  let sanitized: Buffer;
  try {
    sanitized = guardMediaUpload(object.body, head.contentType);
  } catch (error) {
    if (error instanceof MediaGuardError) {
      await deleteObject(key);
      await releaseQuota(supabase, hold);
      return { ok: false, status: error.status, error: error.message };
    }
    throw error;
  }
  // The declaration was the client's; the object is what counts. Bytes over
  // it go through the same reserve as a fresh upload, so an understated
  // declaration cannot land past the quota. A smaller object refunds.
  const delta = sanitized.length - charged;
  if (delta > 0) {
    try {
      await reserveQuota(supabase, userId, delta);
    } catch (error) {
      if (error instanceof MediaGuardError) {
        await deleteObject(key);
        await releaseQuota(supabase, hold);
        return { ok: false, status: error.status, error: error.message };
      }
      throw error;
    }
  } else if (delta < 0) {
    await releaseQuota(supabase, { userId, bytes: -delta });
  }
  if (!sanitized.equals(object.body)) {
    await putObject(key, sanitized, head.contentType);
  }
  return { ok: true, publicUrl: publicUrl(key) };
}
