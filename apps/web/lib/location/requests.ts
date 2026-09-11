/**
 * location_requests store (mayor-coast locationRequests.ts port). The row
 * holds a "near me" burst while a Find My share resolves: burst_input keeps
 * the original queued bodies as jsonb; coarse_label is the ONLY location
 * datum that may persist — lat/lng are read once in the sweep resolver and
 * reduced to the SDK's coarse address fields (§2.6 privacy contract).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const LOCATION_REQUEST_TTL_MS = 2 * 60 * 1000;
/** Recent consumed shares are reusable for this long (§5.1 step 5). */
export const LOCATION_SHARE_REUSE_MS = 15 * 60 * 1000;
/** Resolver backoff at cron granularity — [30,60,90,120]s, cap 4 attempts. */
export const RESOLUTION_BACKOFF_MS = [30_000, 60_000, 90_000, 120_000];

/** The context line the resolver injects (and the reuse path prepends). */
export const LOCATION_CONTEXT_PREFIX =
  "[context] the user just shared their location:";

export type LocationRequestStatus =
  | "pending_provider"
  | "awaiting_share"
  | "resolving"
  | "consumed"
  | "expired"
  | "cancelled"
  | "declined";

export interface LocationRequest {
  id: string;
  user_id: string;
  space_id: string;
  phone: string;
  sender_address: string;
  request_key: string;
  status: LocationRequestStatus;
  purpose: "nearby" | "directions";
  entity_type: string;
  search_text: string | null;
  burst_input: string[] | null;
  revision: number;
  next_attempt_at: string | null;
  expires_at: string;
  coarse_label: string | null;
  resolved_at: string | null;
  created_at: string;
}

/**
 * Create the request holding a burst. request_key is unique per
 * space+trigger message so a retried flush reuses the same row instead of
 * double-prompting the user (returns the existing row on 23505).
 */
export async function createLocationRequest(
  supabase: SupabaseClient,
  input: {
    userId: string;
    spaceId: string;
    phone: string;
    senderAddress: string;
    requestKey: string;
    purpose: "nearby" | "directions";
    entityType: string;
    searchText?: string | undefined;
    burstInput: string[];
  }
): Promise<LocationRequest> {
  const { data, error } = await supabase
    .from("location_requests")
    .insert({
      user_id: input.userId,
      space_id: input.spaceId,
      phone: input.phone,
      sender_address: input.senderAddress,
      request_key: input.requestKey,
      status: "awaiting_share",
      purpose: input.purpose,
      entity_type: input.entityType,
      search_text: input.searchText ?? null,
      burst_input: input.burstInput,
      next_attempt_at: new Date(
        Date.now() + RESOLUTION_BACKOFF_MS[0]!
      ).toISOString(),
      expires_at: new Date(Date.now() + LOCATION_REQUEST_TTL_MS).toISOString(),
    })
    .select("*")
    .single();
  if (error && error.code === "23505") {
    const existing = await latestLocationRequest(
      supabase,
      input.spaceId,
      input.requestKey
    );
    if (existing) return existing;
  }
  if (error) throw new Error(`location request insert failed: ${error.message}`);
  return data as LocationRequest;
}

async function latestLocationRequest(
  supabase: SupabaseClient,
  spaceId: string,
  requestKey: string
): Promise<LocationRequest | undefined> {
  const { data } = await supabase
    .from("location_requests")
    .select("*")
    .eq("space_id", spaceId)
    .eq("request_key", requestKey)
    .maybeSingle();
  return (data as LocationRequest | null) ?? undefined;
}

/** The space's in-flight request, if any (awaiting_share or resolving). */
export async function pendingLocationRequest(
  supabase: SupabaseClient,
  spaceId: string
): Promise<LocationRequest | undefined> {
  const { data } = await supabase
    .from("location_requests")
    .select("*")
    .eq("space_id", spaceId)
    .in("status", ["pending_provider", "awaiting_share", "resolving"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LocationRequest | null) ?? undefined;
}

/**
 * A consumed share fresh enough to reuse — the §5.1 shortcut that lets a
 * follow-up "near me" skip the Find My round-trip entirely.
 */
export async function recentSharedLocation(
  supabase: SupabaseClient,
  spaceId: string
): Promise<{ coarseLabel: string } | undefined> {
  const since = new Date(Date.now() - LOCATION_SHARE_REUSE_MS).toISOString();
  const { data } = await supabase
    .from("location_requests")
    .select("coarse_label")
    .eq("space_id", spaceId)
    .eq("status", "consumed")
    .gte("resolved_at", since)
    .not("coarse_label", "is", null)
    .order("resolved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const label = data?.coarse_label as string | undefined;
  return label ? { coarseLabel: label } : undefined;
}

/**
 * mayor-coast expediteLocationRequestForThread: an acknowledgement or the
 * share itself bumps the pending request to resolve on the next tick
 * (revision++ is the fence — a resolver already holding the row loses).
 */
/**
 * Pull the pending request's next probe to now. `appendBodies` folds text
 * that arrived with a share (a caption) into the held burst so it reaches
 * Hermes with the location context.
 *
 * Never touches a `resolving` row's revision: the sweeper holds that
 * revision as the fence for every terminal/release write, so bumping it
 * mid-resolution would stale those writes and wedge the row forever. A
 * resolving row already reads the provider — the share needs no nudge.
 */
export async function expediteLocationRequest(
  supabase: SupabaseClient,
  spaceId: string,
  appendBodies?: string[]
): Promise<string | null> {
  const pending = await pendingLocationRequest(supabase, spaceId);
  if (!pending) return null;
  const burstInput = appendBodies?.length
    ? [...((pending.burst_input ?? []) as string[]), ...appendBodies]
    : undefined;
  if (pending.status === "resolving") {
    if (burstInput) {
      await supabase
        .from("location_requests")
        .update({ burst_input: burstInput })
        .eq("id", pending.id)
        .eq("revision", pending.revision)
        .eq("status", "resolving");
    }
    return pending.id;
  }
  const { error } = await supabase
    .from("location_requests")
    .update({
      next_attempt_at: new Date().toISOString(),
      revision: pending.revision + 1,
      ...(burstInput ? { burst_input: burstInput } : {}),
    })
    .eq("id", pending.id)
    .eq("revision", pending.revision)
    .in("status", ["pending_provider", "awaiting_share"]);
  return error ? null : pending.id;
}

/** New "near me" intents cancel whatever the thread had in flight. */
export async function supersedeLocationRequests(
  supabase: SupabaseClient,
  spaceId: string
): Promise<void> {
  await supabase
    .from("location_requests")
    .update({ status: "cancelled" })
    .eq("space_id", spaceId)
    .in("status", ["pending_provider", "awaiting_share", "resolving"]);
}

/**
 * Claim the due awaiting_share rows for resolution. The status fence makes
 * the transition atomic — two sweep ticks can't both resolve one request.
 */
export async function claimDueLocationRequests(
  supabase: SupabaseClient,
  limit = 10
): Promise<LocationRequest[]> {
  const { data } = await supabase
    .from("location_requests")
    .select("*")
    .eq("status", "awaiting_share")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  const claimed: LocationRequest[] = [];
  for (const row of (data ?? []) as LocationRequest[]) {
    const { data: updated, error } = await supabase
      .from("location_requests")
      .update({
        status: "resolving",
        revision: row.revision + 1,
      })
      .eq("id", row.id)
      .eq("revision", row.revision)
      .eq("status", "awaiting_share")
      .select("id")
      .maybeSingle();
    if (!error && updated) {
      claimed.push({ ...row, status: "resolving", revision: row.revision + 1 });
    }
  }
  return claimed;
}

/** Release a resolving row back to awaiting_share with the next backoff. */
export async function releaseLocationRequest(
  supabase: SupabaseClient,
  request: LocationRequest,
  attemptIndex: number
): Promise<void> {
  const delay =
    RESOLUTION_BACKOFF_MS[
      Math.min(attemptIndex, RESOLUTION_BACKOFF_MS.length - 1)
    ]!;
  await supabase
    .from("location_requests")
    .update({
      status: "awaiting_share",
      next_attempt_at: new Date(Date.now() + delay).toISOString(),
    })
    .eq("id", request.id)
    .eq("revision", request.revision);
}

/** Terminal write — consumed keeps only the coarse label. */
export async function completeLocationRequest(
  supabase: SupabaseClient,
  request: LocationRequest,
  outcome:
    | { status: "consumed"; coarseLabel: string }
    | { status: "expired" | "declined" | "cancelled" }
): Promise<void> {
  await supabase
    .from("location_requests")
    .update({
      status: outcome.status,
      coarse_label:
        outcome.status === "consumed" ? outcome.coarseLabel : null,
      burst_input: outcome.status === "consumed" ? request.burst_input : null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("revision", request.revision);
}
