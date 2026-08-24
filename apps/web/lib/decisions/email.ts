/**
 * Email-draft decision resolution — the one send path for agent-composed
 * mail (C10). Shared by the Needs-you API route and the inbox mini-app's
 * inline card so both surfaces resolve through identical checks: owner-
 * scoped decision lookup, pending-only, send via the control-plane key with
 * the decision id as the Idempotency-Key (a replayed approval re-sends
 * nothing), and a conditional status flip that loses races cleanly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDraft } from "../agentmail/client";

export class EmailDraftError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "EmailDraftError";
    this.status = status;
  }
}

/** Resolve the user's primary agent inbox and send the held draft. */
export async function sendHeldDraft(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
  idempotencyKey: string
): Promise<void> {
  const { data: address } = await supabase
    .from("agent_addresses")
    .select("agentmail_inbox_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("retired_at", null)
    .maybeSingle();
  if (!address?.agentmail_inbox_id) {
    throw new EmailDraftError(409, "no inbox");
  }
  await sendDraft(
    address.agentmail_inbox_id as string,
    draftId,
    idempotencyKey
  );
}

/**
 * Approve (send) or dismiss (leave unsent) a pending email_draft decision.
 * Owner-scoped by userId; anything not a pending email_draft is refused.
 */
export async function resolveEmailDraftDecision(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
  approve: boolean
): Promise<void> {
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, kind, ref, status")
    .eq("id", decisionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!decision || decision.kind !== "email_draft") {
    throw new EmailDraftError(404, "not found");
  }
  if (decision.status !== "pending") {
    throw new EmailDraftError(409, "already resolved");
  }
  if (approve) {
    if (!decision.ref) {
      throw new EmailDraftError(409, "draft reference missing");
    }
    await sendHeldDraft(
      supabase,
      userId,
      decision.ref as string,
      decision.id as string
    );
  }
  await supabase
    .from("decisions")
    .update({
      status: approve ? "approved" : "dismissed",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", decision.id)
    .eq("user_id", userId)
    .eq("status", "pending");
}
