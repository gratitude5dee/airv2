/**
 * CM8 task 4: connection health ahead of need. For every slot firing inside
 * the horizon, verify the platform connection is still live with Composio —
 * an expiring token raises a 'reconnect' decision *before* the slot fails,
 * not at fire time. Token custody stays with Composio; we read status only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listConnectedAccounts } from "@/lib/composio/client";

/** Probe connections for slots firing this far ahead. */
export const HEALTH_HORIZON_MS = 48 * 60 * 60 * 1000;

const PLATFORM_TOOLKIT: Record<string, string> = {
  instagram: "instagram",
  facebook: "facebook",
  x: "twitter",
  youtube: "youtube",
  tiktok: "tiktok",
};

export interface HealthResult {
  usersChecked: number;
  connectionsMarked: number;
  reauthRaised: number;
}

export async function probeConnectionHealth(
  supabase: SupabaseClient
): Promise<HealthResult> {
  const result: HealthResult = {
    usersChecked: 0,
    connectionsMarked: 0,
    reauthRaised: 0,
  };
  const horizon = new Date(Date.now() + HEALTH_HORIZON_MS).toISOString();
  const { data: slots } = await supabase
    .from("content_slots")
    .select("id, user_id, platform, scheduled_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", horizon)
    .limit(500);
  if (!slots || slots.length === 0) return result;

  const byUser = new Map<string, Array<{ id: string; platform: string }>>();
  for (const slot of slots) {
    const list = byUser.get(slot.user_id as string) ?? [];
    list.push({ id: slot.id as string, platform: slot.platform as string });
    byUser.set(slot.user_id as string, list);
  }

  for (const [userId, userSlots] of byUser) {
    result.usersChecked += 1;
    // Composio is the token authority: refresh our status mirror from it,
    // then judge each needed toolkit against the refreshed mirror.
    let liveToolkits: Set<string> | null = null;
    try {
      // listConnectedAccounts already filters to ACTIVE accounts, so a
      // toolkit missing from the response has no live token.
      const accounts = await listConnectedAccounts(userId);
      liveToolkits = new Set<string>();
      for (const account of accounts) {
        const slug = account.toolkit?.slug;
        if (slug) liveToolkits.add(slug.toLowerCase());
      }
    } catch {
      // Composio unreachable: fall back to the local mirror below.
    }

    const neededToolkits = new Map<string, string[]>(); // toolkit -> slot ids
    for (const slot of userSlots) {
      const toolkit = PLATFORM_TOOLKIT[slot.platform] ?? slot.platform;
      const ids = neededToolkits.get(toolkit) ?? [];
      ids.push(slot.id);
      neededToolkits.set(toolkit, ids);
    }

    for (const [toolkit, slotIds] of neededToolkits) {
      let healthy: boolean;
      if (liveToolkits) {
        healthy = liveToolkits.has(toolkit);
        // Keep the local mirror truthful either way.
        const { error } = await supabase
          .from("connections")
          .update({ status: healthy ? "active" : "error" })
          .eq("user_id", userId)
          .eq("toolkit", toolkit)
          .neq("status", healthy ? "active" : "error");
        if (!error) result.connectionsMarked += 1;
      } else {
        const { data: connection } = await supabase
          .from("connections")
          .select("status")
          .eq("user_id", userId)
          .eq("toolkit", toolkit)
          .maybeSingle();
        healthy = connection?.status === "active";
      }
      const firstSlotId = slotIds[0];
      if (!healthy && firstSlotId) {
        result.reauthRaised += await raiseReauth(
          supabase,
          userId,
          toolkit,
          firstSlotId
        );
      }
    }
  }
  return result;
}

export interface ReconcileConnectionsResult {
  usersChecked: number;
  revoked: number;
}

/**
 * Full per-user mirror reconcile (M11): any local `active` connection whose
 * account no longer appears in Composio's ACTIVE list is marked `revoked`.
 * `pending` rows are left alone — the Connectors page's Resume action owns
 * that path; auto-expiry would fight a user mid-OAuth.
 */
export async function reconcileConnections(
  supabase: SupabaseClient
): Promise<ReconcileConnectionsResult> {
  const result: ReconcileConnectionsResult = { usersChecked: 0, revoked: 0 };
  const { data: rows } = await supabase
    .from("connections")
    .select("id, user_id, toolkit")
    .eq("provider", "composio")
    .eq("status", "active")
    .limit(1000);
  if (!rows || rows.length === 0) return result;

  const byUser = new Map<string, Array<{ id: string; toolkit: string }>>();
  for (const row of rows) {
    const list = byUser.get(row.user_id as string) ?? [];
    list.push({ id: row.id as string, toolkit: row.toolkit as string });
    byUser.set(row.user_id as string, list);
  }

  for (const [userId, userRows] of byUser) {
    result.usersChecked += 1;
    let liveToolkits: Set<string>;
    try {
      const accounts = await listConnectedAccounts(userId);
      liveToolkits = new Set(
        accounts
          .map((a) => a.toolkit?.slug?.toLowerCase())
          .filter((s): s is string => Boolean(s))
      );
    } catch {
      // Composio unreachable: don't revoke on missing evidence.
      continue;
    }
    for (const row of userRows) {
      if (liveToolkits.has(row.toolkit.toLowerCase())) continue;
      const { error } = await supabase
        .from("connections")
        .update({ status: "revoked", connected_at: null })
        .eq("id", row.id);
      if (!error) result.revoked += 1;
    }
  }
  return result;
}

async function raiseReauth(
  supabase: SupabaseClient,
  userId: string,
  toolkit: string,
  slotId: string
): Promise<number> {
  const { data: pending } = await supabase
    .from("decisions")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "reconnect")
    .eq("platform", toolkit)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (pending) return 0;
  const { error } = await supabase.from("decisions").insert({
    user_id: userId,
    kind: "reconnect",
    platform: toolkit,
    ref: slotId,
    label: `Reconnect ${toolkit} before your scheduled posts fail`,
  });
  return error ? 0 : 1;
}
