/**
 * Onairos personal-context boundary for onboarding step 4 (goal.md §MA9.2).
 * Backed by lib/onairos/sync.ts: `configured` (ONAIROS_API_KEY present)
 * gates availability, connection status comes from the connections-table
 * metadata (never persona bytes, C4). Connect itself is the client SDK
 * handoff → POST /api/onairos; this provider only reports status so the
 * step can render honestly and stay skippable with no key configured.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { onairosStatus } from "@/lib/onairos/sync";
import { ONAIROS_PROVIDER, ONAIROS_TOOLKIT } from "@/lib/onairos/ids";

export interface OnairosStatus {
  /** False when ONAIROS_API_KEY is not configured — the step renders a stub. */
  available: boolean;
  connected: boolean;
  /** Hosted grant URL when a connect flow exists; never a credential. */
  connect_url: string | null;
}

/** One connections row, as far as the Onairos step cares. */
export interface ConnectionStatusRow {
  provider?: string | null;
  toolkit?: string | null;
  status?: string | null;
}

/**
 * The same status derived from connection rows the caller already holds.
 * Onboarding reads every row for the user anyway, so the step costs no
 * extra round trip there.
 */
export function onairosStatusFromRows(
  rows: readonly ConnectionStatusRow[]
): OnairosStatus {
  const row = rows.find(
    (r) => r.provider === ONAIROS_PROVIDER && r.toolkit === ONAIROS_TOOLKIT
  );
  return {
    available: env.onairosApiKey() !== null,
    connected: row?.status === "active",
    connect_url: null,
  };
}

export interface OnairosProvider {
  status(supabase: SupabaseClient, userId: string): Promise<OnairosStatus>;
}

export const onairosProvider: OnairosProvider = {
  async status(
    supabase: SupabaseClient,
    userId: string
  ): Promise<OnairosStatus> {
    const state = await onairosStatus(supabase, userId);
    return {
      available: state.configured,
      connected: state.status === "active",
      connect_url: null,
    };
  },
};
