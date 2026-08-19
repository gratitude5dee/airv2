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
import { addUsage } from "./buckets";
import {
  deleteObject,
  getObject,
  headObject,
  publicUrl,
  putObject,
} from "./r2";

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
  const head = await headObject(key);
  if (!head) {
    await addUsage(supabase, userId, -charged);
    return { ok: false, status: 404, error: "object not found" };
  }
  if (head.sizeBytes > MEDIA_MAX_BYTES || !allowedMediaType(head.contentType)) {
    await deleteObject(key);
    await addUsage(supabase, userId, -charged);
    return { ok: false, status: 422, error: "upload rejected" };
  }
  const object = await getObject(key);
  if (!object) {
    await addUsage(supabase, userId, -charged);
    return { ok: false, status: 404, error: "object not found" };
  }
  try {
    const sanitized = guardMediaUpload(object.body, head.contentType);
    if (!sanitized.equals(object.body)) {
      await putObject(key, sanitized, head.contentType);
    }
    await addUsage(supabase, userId, sanitized.length - charged);
  } catch (error) {
    if (error instanceof MediaGuardError) {
      await deleteObject(key);
      await addUsage(supabase, userId, -charged);
      return { ok: false, status: error.status, error: error.message };
    }
    throw error;
  }
  return { ok: true, publicUrl: publicUrl(key) };
}
