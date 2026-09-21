import type { SupabaseClient } from "@supabase/supabase-js";

export type MuseEventKind =
  | "notify"
  | "reply"
  | "pull"
  | "run"
  | "decision"
  | "grant"
  | "key"
  | "nudge"
  | "mail_draft"
  | "calendar_add"
  | "schedule_create"
  | "wallet_request";

/** Metadata-only event ledger. Never add a text/body/prompt field here. */
export async function recordMuseEvent(
  supabase: SupabaseClient,
  event: {
    userId: string;
    kind: MuseEventKind;
    agent?: string | null;
    chars?: number | null;
    status?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("muse_events").insert({
    user_id: event.userId,
    kind: event.kind,
    agent: event.agent?.slice(0, 32) ?? null,
    chars: event.chars ?? null,
    status: event.status?.slice(0, 48) ?? null,
  });
  if (error) throw new Error(`Muse event write failed: ${error.message}`);
}
