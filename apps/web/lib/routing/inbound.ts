/**
 * Shared ingress logic: resolve → dedupe, in the order goal.md M2/M5 require.
 * The route handlers verify signatures first, call this, ack with 200, and
 * only then do work. Factored here so idempotency is unit-testable.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DedupeKey {
  webhookId: string;
  messageId: string;
}

export interface ResolvedRoute {
  userId: string;
}

/**
 * Insert into inbound_events on (webhook_id, message_id).
 * A conflict means already-seen: the caller returns 200 and stops.
 */
export async function dedupeInboundEvent(
  supabase: SupabaseClient,
  key: DedupeKey,
  userId: string | null
): Promise<{ alreadySeen: boolean }> {
  const { error } = await supabase.from("inbound_events").insert({
    webhook_id: key.webhookId,
    message_id: key.messageId,
    user_id: userId,
  });
  if (error) {
    // 23505 = unique_violation on the (webhook_id, message_id) primary key.
    if (error.code === "23505") {
      return { alreadySeen: true };
    }
    throw new Error(`inbound_events insert failed: ${error.message}`);
  }
  return { alreadySeen: false };
}

/** Resolve a line phone (E.164) to its assigned user. */
export async function resolveLine(
  supabase: SupabaseClient,
  phone: string
): Promise<ResolvedRoute | undefined> {
  const { data } = await supabase
    .from("lines")
    .select("assigned_user_id")
    .eq("phone", phone)
    .maybeSingle();
  if (!data?.assigned_user_id) return undefined;
  return { userId: data.assigned_user_id as string };
}

/**
 * Resolve a sender handle (platform + address) to its user — the fallback
 * when the line phone doesn't identify the account (Spectrum reports
 * `space.phone: "shared"` on shared-line spaces, so the line alone can't
 * distinguish users there).
 */
export async function resolveSenderHandle(
  supabase: SupabaseClient,
  platform: string,
  address: string
): Promise<ResolvedRoute | undefined> {
  const { data } = await supabase
    .from("handles")
    .select("user_id")
    .eq("platform", platform)
    .eq("address", address)
    .maybeSingle();
  if (!data?.user_id) return undefined;
  return { userId: data.user_id as string };
}

/**
 * Resolve an agent email address to its user, including retired aliases —
 * a retired address routes forever (SECURITY-DECISIONS.md).
 */
export async function resolveAgentAddress(
  supabase: SupabaseClient,
  address: string
): Promise<ResolvedRoute | undefined> {
  const { data } = await supabase
    .from("agent_addresses")
    .select("user_id")
    .eq("address", address.toLowerCase())
    .maybeSingle();
  if (!data?.user_id) return undefined;
  return { userId: data.user_id as string };
}
