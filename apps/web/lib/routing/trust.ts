/**
 * Sender trust tiers (goal.md M4, ARCHITECTURE.md §2.5c). Resolved in the
 * router, passed to the run pipeline as trusted metadata the agent can
 * neither read nor rewrite — it never enters the model's context.
 *
 *   tier 0  the account's own verified handles
 *   tier 1  known senders the user promoted from People
 *   tier 2  everyone else (default on first contact)
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TrustTier = 0 | 1 | 2;

export async function resolveTrustTier(
  supabase: SupabaseClient,
  userId: string,
  platform: "imessage" | "email",
  address: string
): Promise<TrustTier> {
  const normalized =
    platform === "imessage"
      ? address.replace(/[^+\d]/g, "")
      : address.toLowerCase();

  const { data: handle } = await supabase
    .from("handles")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("address", normalized)
    .maybeSingle();
  if (handle) return 0;

  const { data: sender } = await supabase
    .from("senders")
    .select("trust_tier")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("address", normalized)
    .maybeSingle();
  if (sender) return sender.trust_tier as TrustTier;

  // First contact: record at tier 2. Races are benign — the unique
  // constraint makes the second insert a no-op and both read back tier 2.
  const { error } = await supabase.from("senders").insert({
    user_id: userId,
    platform,
    address: normalized,
    trust_tier: 2,
  });
  if (error && error.code !== "23505") {
    throw new Error(`senders insert failed: ${error.message}`);
  }
  return 2;
}

/** Queue a "Needs you" entry. Label is a short safe string, never a body. */
export async function createDecision(
  supabase: SupabaseClient,
  entry: {
    userId: string;
    kind: "tier2_contact" | "email_draft" | "run_approval";
    platform?: "imessage" | "email";
    sender?: string;
    ref?: string;
    label?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("decisions").insert({
    user_id: entry.userId,
    kind: entry.kind,
    platform: entry.platform ?? null,
    sender: entry.sender ?? null,
    ref: entry.ref ?? null,
    label: entry.label?.slice(0, 200) ?? null,
  });
  if (error) {
    throw new Error(`decisions insert failed: ${error.message}`);
  }
}
