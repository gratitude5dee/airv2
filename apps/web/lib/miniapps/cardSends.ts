/**
 * Agent-initiated mini-app card rate limiting (V4 generalizes the M-era
 * computer_card_sends shape). One row per (user, card kind): the insert wins
 * the first send; afterwards a conditional update only matches when the
 * previous send is older than the cooldown, so concurrent calls cannot both
 * pass. Cards are always owner-scoped (C15) — this bounds the flood rate a
 * prompt-injected agent could achieve, per card kind.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** One kind per store app the agent may send a card for (goal.md §4.3). */
export type CardKind =
  | "ads"
  | "computer"
  | "calendar"
  | "vault"
  | "browser"
  | "kanban"
  | "todo"
  | "onboarding"
  | "connect"
  | "video"
  | "image"
  | "crm"
  | "analytics"
  | "inbox"
  | "pay"
  | "shop"
  | "settings"
  | "home";

/** Minimum gap between agent-initiated cards per (user, kind). */
export const CARD_COOLDOWN_MS = 2 * 60 * 1000;

/**
 * Gap enforced after a failed delivery. Not a full release: a thrown send
 * error is ambiguous (the card may already have reached the owner — e.g. a
 * network timeout after handoff to Spectrum), so retries stay possible but
 * the flood rate remains bounded even under repeated failures.
 */
export const FAILED_SEND_RETRY_MS = 15 * 1000;

export interface CardClaim {
  /** Best-effort backoff so a failed delivery doesn't consume the full cooldown. */
  release: () => Promise<void>;
}

export async function claimCardSend(
  supabase: SupabaseClient,
  userId: string,
  kind: CardKind
): Promise<CardClaim | undefined> {
  const now = new Date();
  const { error } = await supabase
    .from("card_sends")
    .insert({ user_id: userId, kind, sent_at: now.toISOString() });
  const retryAt = new Date(
    now.getTime() - CARD_COOLDOWN_MS + FAILED_SEND_RETRY_MS
  ).toISOString();
  // Only rolls back this call's own claim: a newer claim has a later sent_at.
  const release = async () => {
    await supabase
      .from("card_sends")
      .update({ sent_at: retryAt })
      .eq("user_id", userId)
      .eq("kind", kind)
      .eq("sent_at", now.toISOString());
  };
  if (!error) {
    return { release };
  }
  if (error.code !== "23505") {
    throw new Error(`card_sends insert failed: ${error.message}`);
  }
  const cutoff = new Date(now.getTime() - CARD_COOLDOWN_MS).toISOString();
  const { data, error: updateError } = await supabase
    .from("card_sends")
    .update({ sent_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("kind", kind)
    .lt("sent_at", cutoff)
    .select("sent_at");
  if (updateError) {
    throw new Error(`card_sends update failed: ${updateError.message}`);
  }
  if ((data?.length ?? 0) === 0) return undefined;
  return { release };
}
