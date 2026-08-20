/**
 * Onairos personal-context boundary for onboarding step 4 (goal.md §MA9.2).
 * Backed by lib/onairos/sync.ts: `configured` (ONAIROS_API_KEY present)
 * gates availability, connection status comes from the connections-table
 * metadata (never persona bytes, C4). Connect itself is the client SDK
 * handoff → POST /api/onairos; this provider only reports status so the
 * step can render honestly and stay skippable with no key configured.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { onairosStatus } from "@/lib/onairos/sync";

export interface OnairosStatus {
  /** False when ONAIROS_API_KEY is not configured — the step renders a stub. */
  available: boolean;
  connected: boolean;
  /** Hosted grant URL when a connect flow exists; never a credential. */
  connect_url: string | null;
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
