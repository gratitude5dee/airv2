/**
 * Find My lane in the flush pipeline (plan §5.1): after the creative lane,
 * before ensureBoxAwake — a "near me" burst must not wake the box until
 * the share resolves. Owner-only: only the owner's own thread can be asked
 * for a location.
 *
 * Outcomes:
 *   handled — the burst is consumed here (share/ack expedite, intent held
 *     behind a fresh Find My card, or a stray share politely bounced).
 *   !handled + contextLine — a share <15min old is being reused; the caller
 *     prepends the line to the run input so Hermes answers with it.
 *   !handled — ordinary prose, continue normally.
 *
 * Copy is the plan's verbatim: ack, stray-share, expiry, resolve lines.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import {
  participantAddressFromDmChatGuid,
} from "./address";
import {
  detectLocationIntent,
  isLocationAcknowledgement,
  LOCATION_SHARED_BODY,
} from "./intent";
import {
  createLocationRequest,
  expediteLocationRequest,
  pendingLocationRequest,
  recentSharedLocation,
  supersedeLocationRequests,
  LOCATION_CONTEXT_PREFIX,
} from "./requests";

const ASK_LINE =
  "share your location and i'll look around — tap the Find My card i just sent.";
const STRAY_LINE =
  'Ask me what\'s near you or say "get me directions," then tap Find My so I can use the share for that one request.';
const UNAVAILABLE_LINE =
  "find my isn't reachable right now — tell me a neighborhood instead?";

export interface LocationLaneResult {
  handled: boolean;
  contextLine?: string;
}

export async function maybeRunLocationLane(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  job: {
    spaceId: string;
    userId: string;
    phone: string;
    senderTier: number | null;
    senderId?: string | undefined;
  },
  rawInput: string,
  triggerMessageId: string
): Promise<LocationLaneResult> {
  const trimmed = rawInput.trim();

  // Share/acknowledgement fast-path: expedite the pending request and eat
  // the burst — a share is never conversational content.
  if (
    trimmed === LOCATION_SHARED_BODY ||
    isLocationAcknowledgement(trimmed)
  ) {
    const expedited = await expediteLocationRequest(supabase, job.spaceId);
    if (!expedited) {
      await sender
        .sendText(job.spaceId, job.phone, STRAY_LINE)
        .catch(() => undefined);
    }
    return { handled: true };
  }

  // Synthetic resolver context rows never re-trigger detection.
  if (trimmed.startsWith(LOCATION_CONTEXT_PREFIX)) return { handled: false };

  const intent = job.senderTier === 0 ? detectLocationIntent(trimmed) : null;
  if (!intent || intent.purpose !== "nearby") return { handled: false };

  // §5.1 step 5: a share fresh enough to reuse skips the round-trip; the
  // caller folds the coarse label into the turn input.
  const recent = await recentSharedLocation(supabase, job.spaceId);
  if (recent) {
    return {
      handled: false,
      contextLine: `${LOCATION_CONTEXT_PREFIX} ${recent.coarseLabel}`,
    };
  }

  let senderAddress: string;
  try {
    senderAddress = participantAddressFromDmChatGuid(job.spaceId);
  } catch {
    const candidate = (job.senderId ?? "").trim();
    if (/^\+[1-9]\d{6,14}$/.test(candidate) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      senderAddress = candidate;
    } else {
      // No DM-shaped participant: can't ask for a share — let Hermes answer.
      return { handled: false };
    }
  }

  // A new intent supersedes whatever the thread had in flight.
  await supersedeLocationRequests(supabase, job.spaceId);
  const request = await createLocationRequest(supabase, {
    userId: job.userId,
    spaceId: job.spaceId,
    phone: job.phone,
    senderAddress,
    requestKey: `${job.spaceId}:${triggerMessageId}:location`,
    purpose: intent.purpose,
    entityType: intent.entityType,
    ...(intent.searchText ? { searchText: intent.searchText } : {}),
    burstInput: [trimmed],
  });

  const receipt = await sender
    .requestLocation(job.spaceId, job.phone, senderAddress, request.id)
    .catch(() => undefined);
  if (!receipt) {
    console.error(
      JSON.stringify({
        msg: "find my request card unavailable",
        user_id: job.userId,
        request_id: request.id,
      })
    );
    await sender
      .sendText(job.spaceId, job.phone, UNAVAILABLE_LINE)
      .catch(() => undefined);
    return { handled: true };
  }
  await sender
    .sendText(job.spaceId, job.phone, ASK_LINE)
    .catch(() => undefined);
  return { handled: true };
}

/** True when the space has a share pending — used by the resolver and by
 * tests. */
export async function locationPending(
  supabase: SupabaseClient,
  spaceId: string
): Promise<boolean> {
  return (await pendingLocationRequest(supabase, spaceId)) !== undefined;
}

export { LOCATION_CONTEXT_PREFIX };
