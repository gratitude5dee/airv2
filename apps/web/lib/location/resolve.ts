/**
 * Find My resolver — the sweep step (plan §5.4). Each tick claims due
 * awaiting_share rows (status fence → 'resolving'), reads ONE consented
 * snapshot via getSharedLocation, and validates it against the mayor-coast
 * contract: type ∈ {legacy, live, shallow}, accuracy ≤ 2000 m, age ≤ 15
 * min, not expired, not still locating.
 *
 * Privacy contract (§2.6): lat/lng are read here to VALIDATE and then
 * discarded — only the SDK's coarse label (shortAddress/name/longAddress)
 * is ever written. On consume the held burst is requeued plus a context
 * line for Hermes; on expiry/decline the burst is dropped with a line.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SharedFriendLocation } from "@photon-ai/advanced-imessage";
import { scheduleFlush } from "../orchestrator/flush";
import { createSpectrumSender } from "../spectrum/sender";
import {
  claimDueLocationRequests,
  completeLocationRequest,
  releaseLocationRequest,
  LOCATION_CONTEXT_PREFIX,
  type LocationRequest,
} from "./requests";

const MAX_LOCATION_ACCURACY_METERS = 2000;
const MAX_LOCATION_AGE_MS = 15 * 60 * 1000;
/** After this many resolver passes the ask gives up (cron granularity). */
const MAX_RESOLUTION_ATTEMPTS = 4;
/** Provider-supplied label — untrusted text bound for a Hermes prompt. */
const MAX_COARSE_LABEL_LENGTH = 120;

const EXPIRED_LINE =
  "didn't get your location — try 'find my' again or tell me a neighborhood";
const GOT_IT_LINE = "got it — checking what's around you";
const REJECTION_LINE =
  "I can't process live or private location shares. Send a neighborhood or public venue name instead.";

function isValidSharedLocation(location: SharedFriendLocation): boolean {
  if (location.isLocatingInProgress) return false;
  if (!["legacy", "live", "shallow"].includes(location.locationType)) {
    return false;
  }
  const { latitude, longitude } = location;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }
  if (
    typeof location.accuracy === "number" &&
    location.accuracy > MAX_LOCATION_ACCURACY_METERS
  ) {
    return false;
  }
  const now = Date.now();
  if (location.expiresAt && location.expiresAt.getTime() <= now) return false;
  const stamp = location.locationTimestamp?.getTime();
  if (stamp !== undefined && now - stamp > MAX_LOCATION_AGE_MS) return false;
  return true;
}

/** Newlines/control chars out (a crafted label can't inject prompt lines),
 * whitespace collapsed, length capped; empty after cleaning is unusable. */
function sanitizeCoarseLabel(value: string): string | undefined {
  const clean = value
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_COARSE_LABEL_LENGTH);
  return clean || undefined;
}

function coarseLabelFor(location: SharedFriendLocation): string | undefined {
  for (const field of [
    location.shortAddress,
    location.name,
    location.longAddress,
  ]) {
    if (field) {
      const label = sanitizeCoarseLabel(field);
      if (label) return label;
    }
  }
  return undefined;
}

/**
 * Requeue the held burst plus the location context line. batch_queue has
 * no uniqueness on message_id, so a partial failure + retry would
 * duplicate the leading prefix — purge any rows from an earlier attempt
 * first, then land the whole set in ONE insert statement (atomic: either
 * the full burst is queued or nothing is). One schedule_flush after the
 * batch, mirroring enqueueInbound's destination bookkeeping.
 */
async function deliverHeldBurst(
  supabase: SupabaseClient,
  request: LocationRequest,
  coarseLabel: string
): Promise<void> {
  const bodies = (request.burst_input ?? []) as string[];
  const idPrefix = `location:${request.id}:`;
  await supabase
    .from("batch_queue")
    .delete()
    .eq("space_id", request.space_id)
    .like("message_id", `${idPrefix}%`);
  const rows = [
    `${LOCATION_CONTEXT_PREFIX} ${coarseLabel}`,
    ...bodies,
  ].map((body, index) => ({
    user_id: request.user_id,
    space_id: request.space_id,
    phone: request.phone,
    sender_id: request.sender_address,
    message_id: `${idPrefix}${index}`,
    body,
  }));
  const { error } = await supabase.from("batch_queue").insert(rows);
  if (error) {
    throw new Error(`location burst requeue failed: ${error.message}`);
  }
  const { error: destError } = await supabase
    .from("imessage_destinations")
    .upsert(
      {
        user_id: request.user_id,
        space_id: request.space_id,
        phone: request.phone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (destError) {
    console.error(
      JSON.stringify({
        msg: "location burst destination upsert failed",
        user_id: request.user_id,
        error: destError.message,
      })
    );
  }
  await scheduleFlush(supabase, {
    userId: request.user_id,
    spaceId: request.space_id,
    phone: request.phone,
    senderId: request.sender_address,
    messageId: `${idPrefix}ctx`,
    body: `${LOCATION_CONTEXT_PREFIX} ${coarseLabel}`,
    senderTier: 0,
  });
}

/**
 * Resolve the due requests this tick. Returns how many landed a terminal
 * state. Never throws — one bad row must not stall the sweep.
 */
export async function resolveDueLocationRequests(
  supabase: SupabaseClient
): Promise<{ resolved: number; expired: number }> {
  const claimed = await claimDueLocationRequests(supabase, 10);
  if (!claimed.length) return { resolved: 0, expired: 0 };
  let resolved = 0;
  let expired = 0;
  const sender = await createSpectrumSender().catch(() => undefined);
  try {
    for (const request of claimed) {
      try {
        if (new Date(request.expires_at).getTime() <= Date.now()) {
          await completeLocationRequest(supabase, request, {
            status: "expired",
          });
          expired += 1;
          await sender
            ?.sendText(request.space_id, request.phone, EXPIRED_LINE)
            .catch(() => undefined);
          continue;
        }
        if (request.revision > MAX_RESOLUTION_ATTEMPTS) {
          await completeLocationRequest(supabase, request, {
            status: "expired",
          });
          expired += 1;
          await sender
            ?.sendText(request.space_id, request.phone, EXPIRED_LINE)
            .catch(() => undefined);
          continue;
        }
        const location = await sender
          ?.getSharedLocation(request.phone, request.sender_address)
          .catch(() => undefined);
        if (location && isValidSharedLocation(location)) {
          const label = coarseLabelFor(location);
          if (!label) {
            // A share with no human-readable label can't steer an answer —
            // decline honestly rather than guess at coordinates.
            await completeLocationRequest(supabase, request, {
              status: "declined",
            });
            resolved += 1;
            await sender
              ?.sendText(request.space_id, request.phone, REJECTION_LINE)
              .catch(() => undefined);
            continue;
          }
          // Requeue before consuming: a failed batch_queue insert must keep
          // the request retryable rather than dropping the held burst.
          await deliverHeldBurst(supabase, request, label);
          await completeLocationRequest(supabase, request, {
            status: "consumed",
            coarseLabel: label,
          });
          resolved += 1;
          await sender
            ?.sendText(request.space_id, request.phone, GOT_IT_LINE)
            .catch(() => undefined);
          continue;
        }
        await releaseLocationRequest(supabase, request, request.revision);
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "location resolve failed",
            request_id: request.id,
            error: error instanceof Error ? error.message : String(error),
          })
        );
        await releaseLocationRequest(supabase, request, request.revision).catch(
          () => undefined
        );
      }
    }
  } finally {
    await sender?.close().catch(() => undefined);
  }
  return { resolved, expired };
}
