/**
 * Outbound email review (C10 stays structural): an agent-composed email is
 * held as an AgentMail draft plus an email_draft Needs-you decision, and the
 * owner gets an inline iMessage card to review the exact held draft and
 * approve or discard it. The only send that exists is the control-plane
 * draft send after that approval — this module never imports a send call.
 *
 * The card bubble carries value-free metadata only (recipient + subject,
 * same fields the decisions row already stores); the body stays in AgentMail
 * and is read at view time inside the owner-only inbox mini-app.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDecision } from "../routing/trust";
import { sendMiniAppCard } from "../miniapps/cards";
import { claimCardSend } from "../miniapps/cardSends";

export async function queueEmailDraftReview(
  supabase: SupabaseClient,
  userId: string,
  draft: { draftId: string; to?: string | undefined; subject?: string | undefined }
): Promise<void> {
  await createDecision(supabase, {
    userId,
    kind: "email_draft",
    platform: "email",
    sender: draft.to,
    ref: draft.draftId,
    label: draft.subject
      ? `Draft: ${draft.subject}`
      : draft.to
        ? `Draft to ${draft.to}`
        : "Email draft awaiting send",
  });

  // Inline review card — best-effort: a failed card must not fail the
  // escalation; the decision already exists and Needs-you shows it.
  await sendEmailReviewCard(supabase, userId, draft).catch((error) => {
    console.error(
      JSON.stringify({
        msg: "email review card send failed",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  });
}

async function sendEmailReviewCard(
  supabase: SupabaseClient,
  userId: string,
  draft: { to?: string | undefined; subject?: string | undefined }
): Promise<void> {
  const { data: dest } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (!dest?.space_id || !dest.phone) return;
  // Owner-scoped card with the shared cooldown claim (C15) — bounds the
  // flood rate a prompt-injected agent could achieve via mass drafting.
  const claim = await claimCardSend(supabase, userId, "inbox");
  if (!claim) return;
  const detail = [draft.to ? `To ${draft.to}` : null, draft.subject]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 120);
  try {
    await sendMiniAppCard(
      supabase,
      String(dest.space_id),
      String(dest.phone),
      userId,
      "inbox",
      "default",
      {
        caption: "Review email",
        subcaption: detail || "A draft is waiting for your approval",
        summary: `Review email — ${detail || "draft awaiting your approval"}. Nothing sends until you approve.`,
      }
    );
  } catch (error) {
    await claim.release().catch(() => undefined);
    throw error;
  }
}
