/**
 * M5 email round trip: after the webhook is verified, resolved, deduped, and
 * acked, this runs the turn — quote-strip → box run → tier-gated reply.
 *
 *   tier 0/1  the agent's reply is auto-sent from the control plane
 *   tier 2    no side effect: one "Needs you" entry, zero outbound mail
 *
 * The reply always leaves through the control-plane key (the box key is
 * draft-only, C10), threaded via Reply To Message with an Idempotency-Key.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMessage, replyToMessage } from "../agentmail/client";
import { createRun, runEvents } from "../hermes/client";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { hermesDeltas } from "../orchestrator/flush";
import { createDecision, resolveTrustTier } from "../routing/trust";

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
    await replyToMessage(inboxId, messageId, output.trim(), messageId);
  }

  await supabase.from("agent_runs").insert({
    user_id: userId,
    hermes_run_id: run.run_id,
    trigger: "email",
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    outcome: "completed",
  });
  await armStopAfter(supabase, userId);
}
