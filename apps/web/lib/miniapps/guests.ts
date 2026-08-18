/**
 * MA4 guest grants. A grant scopes exactly one (app, resource); redeeming it
 * mints a guest session that can render the view and use only the actions
 * the app declares guest-safe. Guest sessions never mint broader tokens and
 * never see the owner's Box shell, tools, vault, or other apps.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface GuestGrant {
  id: string;
  app_id: string;
  resource_id: string;
  created_by: string;
  max_uses: number;
  uses: number;
  expires_at: string;
  revoked_at: string | null;
}

const GRANT_ID_RE = /^[0-9a-f-]{36}$/;

/**
 * Per-grant + per-IP redemption throttle. In-memory sliding window — a hook
 * point, not a distributed limiter: the grant's max_uses is the hard cap and
 * this bounds burst redemption per instance.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const redemptions = new Map<string, number[]>();

export function guestRateLimited(grantId: string, ip: string): boolean {
  const now = Date.now();
  let limited = false;
  for (const key of [`g:${grantId}`, `ip:${ip}`]) {
    const hits = (redemptions.get(key) ?? []).filter(
      (t) => now - t < RATE_WINDOW_MS
    );
    if (hits.length >= RATE_MAX) limited = true;
    hits.push(now);
    redemptions.set(key, hits);
  }
  return limited;
}

/**
 * Atomically consume one use of a grant for the given app. Returns the grant
 * when redemption succeeded; null when the grant is unknown, revoked,
 * expired, exhausted, or scoped to a different app (the caller 403s).
 */
export async function redeemGuestGrant(
  supabase: SupabaseClient,
  grantId: string,
  appId: string
): Promise<GuestGrant | null> {
  if (!GRANT_ID_RE.test(grantId)) return null;
  const { data: grant } = await supabase
    .from("miniapp_guest_grants")
    .select(
      "id, app_id, resource_id, created_by, max_uses, uses, expires_at, revoked_at"
    )
    .eq("id", grantId)
    .maybeSingle();
  if (!grant) return null;
  const row = grant as GuestGrant;
  if (row.app_id !== appId) return null;
  if (row.revoked_at !== null) return null;
  if (Date.parse(row.expires_at) < Date.now()) return null;
  if (row.uses >= row.max_uses) return null;
  // Optimistic single-use increment: a concurrent redemption of the same
  // `uses` value loses the compare-and-set and is rejected.
  const { data: updated, error } = await supabase
    .from("miniapp_guest_grants")
    .update({ uses: row.uses + 1 })
    .eq("id", row.id)
    .eq("uses", row.uses)
    .select("id");
  if (error) throw new Error(`guest grant redeem failed: ${error.message}`);
  if ((updated?.length ?? 0) === 0) return null;
  console.log(
    JSON.stringify({
      msg: "miniapp guest grant redeemed",
      grant_id: row.id,
      app_id: appId,
      user_id: row.created_by,
    })
  );
  return row;
}

/** Owner-initiated grant creation; returns the share URL path (?g=). */
export async function createGuestGrant(
  supabase: SupabaseClient,
  ownerId: string,
  appId: string,
  resourceId: string,
  options?: { maxUses?: number; ttlHours?: number }
): Promise<GuestGrant> {
  const expires = new Date(
    Date.now() + (options?.ttlHours ?? 72) * 3600 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from("miniapp_guest_grants")
    .insert({
      app_id: appId,
      resource_id: resourceId,
      created_by: ownerId,
      max_uses: options?.maxUses ?? 25,
      expires_at: expires,
    })
    .select(
      "id, app_id, resource_id, created_by, max_uses, uses, expires_at, revoked_at"
    )
    .single();
  if (error) throw new Error(`guest grant create failed: ${error.message}`);
  return data as GuestGrant;
}
