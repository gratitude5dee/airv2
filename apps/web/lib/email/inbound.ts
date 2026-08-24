/**
 * M5 email round trip: after the webhook is verified, resolved, deduped, and
 * acked, this runs the turn — quote-strip → box run → tier-gated reply.
 *
 *   tier 0    the agent's reply is auto-sent from the control plane (the
 *             counterparty is the owner's own verified handle)
 *   tier 1    the reply is escalated for review: held as an AgentMail reply
 *             draft plus an email_draft decision with an inline iMessage
 *             card — nothing sends until the owner approves
 *   tier 2    no side effect: one "Needs you" entry, zero outbound mail
 *
 * Every send leaves through the control-plane key (the box key is
 * draft-only, C10), threaded with an Idempotency-Key.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDraft,
  getAttachmentBytes,
  getMessage,
  replyToMessage,
  type AgentMailMessage,
} from "../agentmail/client";
import { queueEmailDraftReview } from "./review";
import { createRun, runEvents } from "../hermes/client";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { hermesDeltas } from "../orchestrator/flush";
import {
  createDecision,
  resolveTrustTier,
  senderIdFor,
} from "../routing/trust";
import { extractInviteSummary, inviteLabel, looksLikeIcs } from "../calendar/ics";
import { materializeIcs, nudgeSync } from "../calendar/store";
import { sendMiniAppCard } from "../miniapps/cards";
import { claimCardSend } from "../miniapps/cardSends";

/**
 * Strip quoted history before it reaches the model (M5 task 4) — it is
 * context you pay for and it degrades reasoning. Covers the common Gmail /
 * Apple Mail / Outlook quote shapes.
 */
export function stripQuotedHistory(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    // "On <date>, <someone> wrote:" / "-----Original Message-----" /
    // "From: x" header block — everything below is quoted history.
    if (
      /^On .{4,80} wrote:\s*$/.test(line.trim()) ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim()) ||
      /^_{5,}$/.test(line.trim()) ||
      (/^From:\s/.test(line) && kept.length > 0)
    ) {
      break;
    }
    if (line.trimStart().startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

/** Extract a bare address from "Name <a@b.c>" or "a@b.c". */
export function parseAddress(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return (match?.[1] ?? value).trim().toLowerCase();
}

/**
 * V3 email-invite branch: detect `.ics` / text-calendar attachments, drop the
 * raw (hostile, I5) bytes into ~/.hermes/calendar/inbox/, and mint one
 * calendar_add decision per invite. Returns true when the message carried an
 * invite (the turn ends there — no auto-reply to machine-generated invites).
 */
async function handleCalendarInvites(
  supabase: SupabaseClient,
  userId: string,
  inboxId: string,
  message: AgentMailMessage,
  from: string
): Promise<boolean> {
  const invites = (message.attachments ?? []).filter((attachment) =>
    looksLikeIcs(attachment.content_type, attachment.filename)
  );
  if (invites.length === 0) return false;

  try {
    const box = await ensureBoxAwake(supabase, userId);
    for (const invite of invites) {
      const bytes = await getAttachmentBytes(
        inboxId,
        message.message_id,
        invite.attachment_id
      );
      const path = await materializeIcs(
        box.boxId,
        invite.filename ?? "invite.ics",
        bytes
      );
      const summary = extractInviteSummary(bytes.toString("utf8"));
      await createDecision(supabase, {
        userId,
        kind: "calendar_add",
        platform: "email",
        sender: from || undefined,
        ref: path,
        label: inviteLabel(summary),
      });
    }
    // Merge the drops as pending events so the store reflects them promptly.
    await nudgeSync(box.target, box.boxId).catch(() => undefined);
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }

  // "Want this on your calendar?" — an owner-scoped calendar card (C15:
  // the durable per-user destination only, same discipline as the computer
  // card; the cooldown claim bounds the flood rate). Best-effort: a failed
  // card must not fail invite processing — the decision already exists.
  await sendCalendarCard(supabase, userId).catch((error) => {
    console.error(
      JSON.stringify({
        msg: "calendar card send failed",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  });
  return true;
}

async function sendCalendarCard(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: dest } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (!dest?.space_id || !dest.phone) return;
  const claim = await claimCardSend(supabase, userId, "calendar");
  if (!claim) return;
  try {
    await sendMiniAppCard(
      supabase,
      String(dest.space_id),
      String(dest.phone),
      userId,
      "calendar",
      "default"
    );
  } catch (error) {
    await claim.release().catch(() => undefined);
    throw error;
  }
}

export async function processInboundEmail(
  supabase: SupabaseClient,
  userId: string,
  inboxId: string,
  messageId: string
): Promise<void> {
  const message = await getMessage(inboxId, messageId);
  const from = parseAddress(message.from ?? "");
  const tier = from
    ? await resolveTrustTier(supabase, userId, "email", from)
    : 2;

  if (tier === 2) {
    // Unknown senders get a decision only — an attached .ics must never
    // auto-add an event or reach the box before the human weighs in.
    await createDecision(supabase, {
      userId,
      kind: "tier2_contact",
      platform: "email",
      sender: from || undefined,
      ref: messageId,
      label: message.subject?.slice(0, 120) ?? "Email from an unknown sender",
    });
    return;
  }

  // V3: calendar invites short-circuit the reply turn — the raw bytes land
  // in the box inbox and the human decides via the calendar_add decision.
  if (await handleCalendarInvites(supabase, userId, inboxId, message, from)) {
    return;
  }

  // Prefer the provider's extraction; fall back to our own stripping.
  const body =
    message.extracted_text?.trim() || stripQuotedHistory(message.text ?? "");
  if (!body) return;

  const box = await ensureBoxAwake(supabase, userId);
  const input = [
    `You received an email${message.subject ? ` with subject "${message.subject}"` : ""} from ${from}.`,
    "Write the reply body only — no subject line, no signature block beyond a short sign-off.",
    "",
    body,
  ].join("\n");

  const run = await createRun(box.target, {
    input,
    sessionId: `email:${message.thread_id ?? messageId}`,
  });
  const startedAt = new Date().toISOString();
  let output = "";
  for await (const delta of hermesDeltas(
    await runEvents(box.target, run.run_id)
  )) {
    output += delta;
  }

  if (output.trim()) {
    // AgentMail Idempotency-Key allows only [A-Za-z0-9-._~]; RFC-822 ids
    // contain <>@ so map anything else onto that alphabet.
    const idempotencyKey = messageId.replace(/[^A-Za-z0-9\-._~]/g, "_");
    if (tier === 0) {
      await replyToMessage(inboxId, messageId, output.trim(), idempotencyKey);
    } else {
      // Escalate for review: hold the reply as a threaded draft (recipients,
      // subject, and threading derive from the inbound message) and file an
      // email_draft decision with an inline iMessage review card. The
      // client_id makes a retried turn reuse the same draft, not stack more.
      const draftId = await createDraft(inboxId, {
        in_reply_to: messageId,
        text: output.trim(),
        client_id: `reply-${idempotencyKey}`,
      });
      await queueEmailDraftReview(supabase, userId, {
        draftId,
        to: from,
        subject: message.subject
          ? message.subject.startsWith("Re:")
            ? message.subject
            : `Re: ${message.subject}`
          : undefined,
      });
    }
  }

  await supabase.from("agent_runs").insert({
    user_id: userId,
    hermes_run_id: run.run_id,
    trigger: "email",
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    outcome: "completed",
    sender_id: from ? await senderIdFor(supabase, userId, "email", from) : null,
  });
  await armStopAfter(supabase, userId);
}
