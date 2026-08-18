/**
 * Connector health + "used by" derivation (V8). Runs execute inside Hermes
 * via the per-user Composio MCP endpoint, so the control plane never sees
 * which toolkit an agent_runs row touched — health therefore comes from the
 * toolkit-attributable metadata that DOES exist: the connections status
 * mirror (kept Composio-truthful by the sync/probe paths), the publish
 * ledger (content_slots, per platform), and the calendar sync clock.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Social toolkits → the publish pipeline's platform key. */
export const TOOLKIT_PLATFORM: Record<string, string> = {
  instagram: "instagram",
  facebook: "facebook",
  twitter: "x",
  youtube: "youtube",
  tiktok: "tiktok",
  linkedin: "linkedin",
};

/** Which product surfaces consume a toolkit — the "used by" hint. */
export const TOOLKIT_USED_BY: Record<string, string> = {
  googlecalendar: "Calendar",
  gmail: "Email",
  instagram: "Social posting",
  facebook: "Social posting",
  twitter: "Social posting",
  youtube: "Social posting",
  tiktok: "Social posting",
  linkedin: "Social posting",
  shopify: "Brand sources",
};

export function usedByHint(toolkit: string): string | null {
  return TOOLKIT_USED_BY[toolkit] ?? null;
}

export interface ConnectionHealth {
  toolkit: string;
  status: string;
  /** Most recent successful toolkit-attributable use, when one exists. */
  last_ok_at: string | null;
  used_by: string | null;
}

export async function connectionHealth(
  supabase: SupabaseClient,
  userId: string,
  rows: Array<{ toolkit: string; status: string; connected_at: string | null }>
): Promise<ConnectionHealth[]> {
  const platforms = rows
    .map((row) => TOOLKIT_PLATFORM[row.toolkit])
    .filter((p): p is string => Boolean(p));

  const [slots, calendar] = await Promise.all([
    platforms.length > 0
      ? supabase
          .from("content_slots")
          .select("platform, published_at")
          .eq("user_id", userId)
          .eq("status", "published")
          .in("platform", platforms)
          .order("published_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    rows.some((row) => row.toolkit === "googlecalendar")
      ? supabase
          .from("calendar_accounts")
          .select("last_synced_at")
          .eq("user_id", userId)
          .eq("provider", "google")
          .eq("status", "active")
          .order("last_synced_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const lastByPlatform = new Map<string, string>();
  for (const slot of (slots.data ?? []) as Array<{
    platform: string;
    published_at: string | null;
  }>) {
    if (slot.published_at && !lastByPlatform.has(slot.platform)) {
      lastByPlatform.set(slot.platform, slot.published_at);
    }
  }
  const calendarSyncedAt =
    (calendar.data as { last_synced_at: string | null } | null)
      ?.last_synced_at ?? null;

  return rows.map((row) => {
    let lastOk: string | null = null;
    const platform = TOOLKIT_PLATFORM[row.toolkit];
    if (platform) {
      lastOk = lastByPlatform.get(platform) ?? null;
    } else if (row.toolkit === "googlecalendar") {
      lastOk = calendarSyncedAt;
    }
    return {
      toolkit: row.toolkit,
      status: row.status,
      last_ok_at: lastOk,
      used_by: usedByHint(row.toolkit),
    };
  });
}
