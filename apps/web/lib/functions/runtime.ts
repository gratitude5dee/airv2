/**
 * V11 §11.3 runtime tokens — the per-app credential behind `air.internal`.
 *
 * Delivery (CR6/CR16): the control plane mints the token, stores only its
 * hash in miniapp_runtime_tokens, writes the secret once into the Outbound
 * Worker's own KV under `rt:<token id>`, and forgets it. The signed manifest
 * carries the *id* (`runtime.token_ref`); the Dispatcher passes that id to
 * the Outbound Worker as a param; the Outbound Worker resolves it from its
 * KV and sets the Bearer toward the gateway. So: the user Worker never sees
 * the token (its bindings are ASSETS/DB/KV/secrets only), the Dispatcher
 * never holds a credential, the Box never learns it, and Postgres holds a
 * hash. Rotation = one insert, one KV write, a compare-and-swap of the app's
 * active reference, then revoke + KV delete of what it replaced. Two
 * rotations racing on one app resolve on the CAS: the loser revokes only its
 * own fresh token, the winner only tokens older than itself, so the app is
 * never left without an active token.
 *
 * The other half is the gateway `app` principal: hash the Bearer, find the
 * active row, and meter against the app's daily cap (CR8) before the owner's
 * monthly cap.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { costUsd, type SpeedTier } from "../entitlements/models";
import {
  deleteRuntimeKvValue,
  hasRuntimeKvValue,
  putRuntimeKvValue,
  runtimeKvConfigured,
} from "./cloudflare";
import { hashRuntimeToken, mintRuntimeToken } from "./tokens";
import { BackendError, loadFunctions, type FunctionsRow } from "./backend";

export const RUNTIME_KV_PREFIX = "rt:";
/** Models a Functions Worker may name; anything else is refused (§11.3). */
export const RUNTIME_MODELS = ["fast", "balanced", "deep"] as const;
export type RuntimeModel = (typeof RUNTIME_MODELS)[number];

export function isRuntimeModel(value: unknown): value is RuntimeModel {
  return (
    typeof value === "string" &&
    (RUNTIME_MODELS as readonly string[]).includes(value)
  );
}

export function runtimeTokenKey(tokenId: string): string {
  return `${RUNTIME_KV_PREFIX}${tokenId}`;
}

/** The Outbound Worker can only resolve a token that reached its KV. */
export function runtimeTokensReady(): boolean {
  return runtimeKvConfigured();
}

function requireRuntimeKv(): void {
  if (!runtimeKvConfigured()) {
    throw new BackendError(503, "the Functions runtime is not configured (runtime KV)");
  }
}

async function revokeTokens(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase
    .from("miniapp_runtime_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .in("id", ids)
    .is("revoked_at", null);
  for (const id of ids) {
    await deleteRuntimeKvValue(runtimeTokenKey(id)).catch(() => undefined);
  }
}

/**
 * Mint a fresh runtime token for an app and make it the active one. The
 * secret leaves this function only as a KV write; the return value is the
 * opaque reference the manifest will carry. Refuses (nothing persisted)
 * when the runtime KV is not configured: a token the Outbound Worker
 * cannot resolve would approve a backend that answers nothing.
 */
export async function rotateRuntimeToken(
  supabase: SupabaseClient,
  appId: string,
  userId: string
): Promise<{ tokenId: string }> {
  requireRuntimeKv();
  const { data: before } = await supabase
    .from("miniapp_functions")
    .select("runtime_token_id")
    .eq("app_id", appId)
    .maybeSingle();
  const previousRef =
    typeof before?.runtime_token_id === "string" ? before.runtime_token_id : null;
  const { secret, hash } = mintRuntimeToken();
  const { data: inserted, error } = await supabase
    .from("miniapp_runtime_tokens")
    .insert({ app_id: appId, user_id: userId, token_hash: hash })
    .select("id, created_at")
    .single();
  if (error || !inserted) throw new BackendError(502, "runtime token mint failed");
  const tokenId = inserted.id as string;
  const createdAt = inserted.created_at as string;
  try {
    await putRuntimeKvValue(runtimeTokenKey(tokenId), secret);
  } catch (error) {
    await revokeTokens(supabase, [tokenId]);
    throw error;
  }
  // CAS on the active reference: only the rotation that observed the current
  // pointer moves it. `is null` when no token existed yet.
  let swap = supabase
    .from("miniapp_functions")
    .update({ runtime_token_id: tokenId })
    .eq("app_id", appId);
  swap = previousRef === null ? swap.is("runtime_token_id", null) : swap.eq("runtime_token_id", previousRef);
  const { data: swapped } = await swap.select("app_id");
  if (!Array.isArray(swapped) || swapped.length === 0) {
    await revokeTokens(supabase, [tokenId]);
    const { data: winner } = await supabase
      .from("miniapp_functions")
      .select("runtime_token_id")
      .eq("app_id", appId)
      .maybeSingle();
    const ref = typeof winner?.runtime_token_id === "string" ? winner.runtime_token_id : null;
    if (!ref) throw new BackendError(409, "runtime token rotation raced; retry");
    return { tokenId: ref };
  }
  // Everything older than the new active token goes; a newer one belongs to
  // a rotation that will either win its own CAS or revoke itself.
  const { data: older } = await supabase
    .from("miniapp_runtime_tokens")
    .select("id")
    .eq("app_id", appId)
    .is("revoked_at", null)
    .neq("id", tokenId)
    .lt("created_at", createdAt);
  await revokeTokens(
    supabase,
    ((older ?? []) as Array<{ id: string }>).map((r) => r.id)
  );
  console.log(JSON.stringify({ msg: "runtime token rotated", app_id: appId }));
  return { tokenId };
}

/** The app's active token reference, minting the first one on demand. */
export async function ensureRuntimeToken(
  supabase: SupabaseClient,
  row: FunctionsRow
): Promise<string> {
  if (row.runtime_token_id) {
    const { data } = await supabase
      .from("miniapp_runtime_tokens")
      .select("id")
      .eq("id", row.runtime_token_id)
      .is("revoked_at", null)
      .maybeSingle();
    // An active row whose secret the Outbound Worker cannot resolve (minted
    // before the runtime KV existed, or a lost write) is useless; rotate it.
    if (data && (await hasRuntimeKvValue(runtimeTokenKey(row.runtime_token_id)))) {
      return row.runtime_token_id;
    }
  }
  return (await rotateRuntimeToken(supabase, row.app_id, row.user_id)).tokenId;
}

/** Teardown: revoke every token and drop the Outbound Worker's copies. */
export async function revokeRuntimeTokens(
  supabase: SupabaseClient,
  appId: string
): Promise<void> {
  const { data } = await supabase
    .from("miniapp_runtime_tokens")
    .select("id")
    .eq("app_id", appId)
    .is("revoked_at", null);
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (ids.length === 0) return;
  await supabase
    .from("miniapp_runtime_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .in("id", ids);
  if (runtimeKvConfigured()) {
    for (const id of ids) {
      await deleteRuntimeKvValue(runtimeTokenKey(id)).catch(() => undefined);
    }
  }
}

/** Who a runtime Bearer is: one app, one owner, one budget. */
export interface RuntimePrincipal {
  tokenId: string;
  appId: string;
  userId: string;
  slug: string;
  functions: FunctionsRow;
}

/**
 * Resolve a runtime Bearer. Null when unknown, revoked, or the app's
 * backend is killed/disabled — the Worker then gets a 401 like any stranger.
 */
export async function authenticateRuntimeToken(
  supabase: SupabaseClient,
  bearer: string
): Promise<RuntimePrincipal | null> {
  if (!bearer.startsWith("art_")) return null;
  const { data: token } = await supabase
    .from("miniapp_runtime_tokens")
    .select("id, app_id, user_id")
    .eq("token_hash", hashRuntimeToken(bearer))
    .is("revoked_at", null)
    .maybeSingle();
  if (!token) return null;
  const appId = token.app_id as string;
  const functions = await loadFunctions(supabase, appId);
  if (!functions || functions.killed_at) return null;
  if (functions.status !== "live" && functions.status !== "draft") return null;
  const { data: app } = await supabase
    .from("mini_apps")
    .select("slug")
    .eq("id", appId)
    .maybeSingle();
  if (!app) return null;
  return {
    tokenId: token.id as string,
    appId,
    userId: token.user_id as string,
    slug: app.slug as string,
    functions,
  };
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Spend counted toward today's app cap (yesterday's counter is stale). */
export function appSpentTodayUsd(row: FunctionsRow, now = new Date()): number {
  return row.ai_spend_day === todayUtc(now) ? row.ai_spent_today_usd : 0;
}

/** The approved cap governs; before approval the declared/default cap does (draft testing). */
export function appDailyCapUsd(row: FunctionsRow): number {
  return row.approved_manifest?.dailyCapUsd ?? row.ai_daily_cap_usd;
}

/**
 * Cheap deny on the row already in hand (settled spend only). Admission is
 * decided by reserveAppSpend; this just spares the RPC once the day is over.
 */
export function appCapReached(row: FunctionsRow, now = new Date()): boolean {
  return appSpentTodayUsd(row, now) >= appDailyCapUsd(row);
}

/**
 * What a call holds against the cap until its usage is known: a generous
 * prompt plus a long answer at the tier's price. Settled to the real cost.
 */
export const RESERVE_PROMPT_TOKENS = 8_000;
export const RESERVE_COMPLETION_TOKENS = 2_000;

export function appReserveUsd(tier: SpeedTier): number {
  return costUsd(tier, RESERVE_PROMPT_TOKENS, RESERVE_COMPLETION_TOKENS);
}

/** A hold taken by miniapp_fn_reserve; settled or released exactly once. */
export interface AppHold {
  appId: string;
  reservedUsd: number;
  /** UTC day (YYYY-MM-DD) the ledger booked the hold on. */
  day: string;
}

export type AppReservation =
  | { status: "held"; hold: AppHold }
  /** spent + held has reached the cap (CR8). */
  | { status: "capped" }
  /** The ledger did not answer; the call is refused rather than unmetered. */
  | { status: "unavailable" };

/**
 * Reserve-then-dispatch (CR8): one statement decides admission and takes the
 * hold, so two calls racing under the cap cannot both pass on a stale read.
 */
export async function reserveAppSpend(
  supabase: SupabaseClient,
  row: FunctionsRow,
  tier: SpeedTier,
  now = new Date()
): Promise<AppReservation> {
  if (appCapReached(row, now)) return { status: "capped" };
  const reservedUsd = appReserveUsd(tier);
  const { data, error } = await supabase.rpc("miniapp_fn_reserve", {
    p_app_id: row.app_id,
    p_usd: reservedUsd,
    p_cap: appDailyCapUsd(row),
  });
  if (error) {
    console.error(
      JSON.stringify({ msg: "fn reserve failed", app_id: row.app_id, error: error.message })
    );
    return { status: "unavailable" };
  }
  return typeof data === "string" && data.length > 0
    ? { status: "held", hold: { appId: row.app_id, reservedUsd, day: data } }
    : { status: "capped" };
}

/**
 * Replace the hold with the call's real cost (0 when the call produced no
 * metered usage). Best effort like add_spend: a failure here leaves the hold
 * counted until the UTC day rolls over, never spend uncounted.
 */
export async function settleAppSpend(
  supabase: SupabaseClient,
  hold: AppHold,
  usd: number
): Promise<void> {
  const { error } = await supabase.rpc("miniapp_fn_settle", {
    p_app_id: hold.appId,
    p_reserved: hold.reservedUsd,
    p_usd: usd > 0 ? usd : 0,
    p_day: hold.day,
  });
  if (error) {
    console.error(
      JSON.stringify({ msg: "fn settle failed", app_id: hold.appId, error: error.message })
    );
  }
}

export function releaseAppSpend(supabase: SupabaseClient, hold: AppHold): Promise<void> {
  return settleAppSpend(supabase, hold, 0);
}
