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
 * hash. Rotation = one insert, one revoke, one KV write, one KV delete.
 *
 * The other half is the gateway `app` principal: hash the Bearer, find the
 * active row, and meter against the app's daily cap (CR8) before the owner's
 * monthly cap.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteRuntimeKvValue,
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

/**
 * Mint a fresh runtime token for an app and make it the active one. The
 * secret leaves this function only as a KV write; the return value is the
 * opaque reference the manifest will carry.
 */
export async function rotateRuntimeToken(
  supabase: SupabaseClient,
  appId: string,
  userId: string
): Promise<{ tokenId: string }> {
  const { secret, hash } = mintRuntimeToken();
  const { data: inserted, error } = await supabase
    .from("miniapp_runtime_tokens")
    .insert({ app_id: appId, user_id: userId, token_hash: hash })
    .select("id")
    .single();
  if (error || !inserted) throw new BackendError(502, "runtime token mint failed");
  const tokenId = inserted.id as string;
  if (runtimeKvConfigured()) {
    await putRuntimeKvValue(runtimeTokenKey(tokenId), secret);
  }
  const { data: previous } = await supabase
    .from("miniapp_runtime_tokens")
    .select("id")
    .eq("app_id", appId)
    .is("revoked_at", null)
    .neq("id", tokenId);
  const revokedIds = ((previous ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (revokedIds.length > 0) {
    await supabase
      .from("miniapp_runtime_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .in("id", revokedIds);
    if (runtimeKvConfigured()) {
      for (const id of revokedIds) {
        await deleteRuntimeKvValue(runtimeTokenKey(id));
      }
    }
  }
  await supabase
    .from("miniapp_functions")
    .update({ runtime_token_id: tokenId })
    .eq("app_id", appId);
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
    if (data) return row.runtime_token_id;
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

export function appCapReached(row: FunctionsRow, now = new Date()): boolean {
  return appSpentTodayUsd(row, now) >= appDailyCapUsd(row);
}

/** Atomic day-scoped add (miniapp_fn_spend); best effort like add_spend. */
export async function recordAppSpend(
  supabase: SupabaseClient,
  appId: string,
  usd: number
): Promise<void> {
  if (!(usd > 0)) return;
  const { error } = await supabase.rpc("miniapp_fn_spend", {
    p_app_id: appId,
    p_usd: usd,
  });
  if (error) {
    console.error(
      JSON.stringify({ msg: "fn spend record failed", app_id: appId, error: error.message })
    );
  }
}
