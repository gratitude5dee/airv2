/**
 * Spectrum inbound webhook (goal.md M2 §2). The order IS the requirement:
 *   1. verify signature   2. reject stale   3. resolve (line, sender) → user
 *   4. dedupe on (webhook_id, message_id)   5. return 200   6. work after.
 *
 * Only routing identifiers touch Postgres — never content or media (C4).
 */
import { after, NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { serviceClient } from "@/lib/supabase";
import {
  SpectrumWebhookError,
  parseInboundSpectrumMessage,
  spectrumWebhookHeaders,
  verifySpectrumSignature,
} from "@/lib/routing/spectrum";
import {
  dedupeInboundEvent,
  resolveLine,
  resolveSenderHandle,
} from "@/lib/routing/inbound";
import {
  carryQuickAckMarker,
  enqueueInbound,
  flushAfterDebounce,
  isBurstStart,
  type InboundMessage,
} from "@/lib/orchestrator/flush";
import { quickAckReply } from "@/lib/orchestrator/sharedBridge";
import { prewarmBox } from "@/lib/orchestrator/boxes";
import { createSpectrumSender } from "@/lib/spectrum/sender";
import { handleOnboarding } from "@/lib/provisioning/onboarding";
import { createDecision, resolveTrustTier } from "@/lib/routing/trust";
import {
  isOnairosTrigger,
  relayToOnairos,
  setSpectrumFlow,
  spectrumFlowActive,
  storeSpectrumGrants,
} from "@/lib/onairos/spectrum";

export const maxDuration = 800;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const headers = spectrumWebhookHeaders(request.headers);

  // 1 + 2: verify HMAC over v0:{timestamp}:{rawBody}; reject >5 min old.
  try {
    verifySpectrumSignature({
      headers,
      rawBody,
      signingSecret: env.spectrumWebhookSecret(),
    });
  } catch (error) {
    if (error instanceof SpectrumWebhookError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }

  let inbound;
  try {
    inbound = parseInboundSpectrumMessage(rawBody, headers);
  } catch (error) {
    if (error instanceof SpectrumWebhookError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
  if (!inbound) {
    // Signed but non-conversational (outbound echo, read receipt, other
    // platform): acknowledge and ignore.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const supabase = serviceClient();

  // 3: resolve (line, sender) → user_id. A dedicated line identifies the
  // user by itself; on the shared line (space.phone "shared") the sender's
  // registered handle does.
  let route = inbound.phone
    ? await resolveLine(supabase, inbound.phone)
    : undefined;
  if (!route && inbound.senderId) {
    route = await resolveSenderHandle(supabase, "imessage", inbound.senderId);
  }

  // 4: dedupe. A conflict means already-seen: return 200 and stop.
  const { alreadySeen } = await dedupeInboundEvent(
    supabase,
    {
      webhookId: inbound.webhookId ?? "spectrum",
      messageId: inbound.messageId,
    },
    route?.userId ?? null,
  );
  if (alreadySeen) {
    return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  if (!route || !inbound.phone) {
    // Unroutable line: recorded as an event, no work dispatched. Log the
    // line identifier (never content) so misrouted numbers are diagnosable.
    console.error(
      JSON.stringify({
        msg: "imessage inbound unroutable",
        line_phone: inbound.phone ?? null,
        space_id: inbound.spaceId,
        message_id: inbound.messageId,
      }),
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const body =
    inbound.text ??
    (inbound.attachmentIds.length > 0
      ? `[attachment:${inbound.attachmentIds.join(",")}]`
      : "");
  if (!body) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // M3: pre-active accounts are handled by the claim/OTP flow; inbound from
  // any sender other than bound_phone routes nowhere (C11).
  const onboarding = await handleOnboarding(
    supabase,
    route.userId,
    inbound.senderId,
    body,
  );
  if (onboarding.kind === "ignore") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (onboarding.kind === "reply") {
    const reply = onboarding.text;
    const spaceId = inbound.spaceId;
    const phone = inbound.phone;
    const messageId = inbound.messageId;
    after(async () => {
      const sender = await createSpectrumSender().catch(() => undefined);
      if (!sender) return;
      try {
        // Thread under the message being answered; plain send when the
        // target can't be resolved.
        const threaded = await sender
          .sendReply(spaceId, phone, messageId, reply)
          .catch(() => false);
        if (!threaded) await sender.sendText(spaceId, phone, reply);
      } finally {
        await sender.close().catch(() => undefined);
      }
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // M4: resolve the sender's trust tier before any work. Tier 2 (unknown)
  // may not cause any side effect — no run, no reply; it lands in "Needs
  // you" for the owner to triage (ARCHITECTURE.md §2.5c).
  const tier = inbound.senderId
    ? await resolveTrustTier(
        supabase,
        route.userId,
        "imessage",
        inbound.senderId,
      )
    : 2;
  if (tier === 2) {
    await createDecision(supabase, {
      userId: route.userId,
      kind: "tier2_contact",
      platform: "imessage",
      sender: inbound.senderId,
      ref: inbound.messageId,
      label: "Message from an unknown number",
    }).catch((error: unknown) => {
      console.error(
        JSON.stringify({
          msg: "tier2 decision insert failed",
          user_id: route.userId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Onairos connect relay (skill: onairos-spectrum-connect). Owner-tier
  // only: the owner's own "connect onairos" opens the flow, and while the
  // persisted shouldRouteNextMessage flag is set their messages route to
  // Onairos instead of the agent — so the email/code/YES always comes from
  // the user's own message, never a synthesized one. No key → normal path.
  if (
    tier === 0 &&
    inbound.senderId &&
    env.onairosApiKey() !== null &&
    ((await spectrumFlowActive(supabase, route.userId)) ||
      isOnairosTrigger(body))
  ) {
    const relayInput = {
      sessionId: inbound.spaceId,
      senderId: inbound.senderId,
      phone: inbound.phone,
      text: body,
      messageId: inbound.messageId,
    };
    const userId = route.userId;
    // 5: ack before work (C8); the relay + reply happen after the response.
    after(async () => {
      const sender = await createSpectrumSender().catch(() => undefined);
      try {
        let result;
        try {
          result = await relayToOnairos(relayInput);
        } catch (error) {
          console.error(
            JSON.stringify({
              msg: "onairos relay failed",
              user_id: userId,
              space_id: relayInput.sessionId,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
          await setSpectrumFlow(supabase, userId, "error").catch(
            () => undefined,
          );
          return;
        }
        if (result.grants.length > 0) {
          await storeSpectrumGrants(supabase, userId, result.grants).catch(
            (error: unknown) => {
              console.error(
                JSON.stringify({
                  msg: "onairos grant store failed",
                  user_id: userId,
                  error: error instanceof Error ? error.message : String(error),
                }),
              );
            },
          );
        } else {
          await setSpectrumFlow(
            supabase,
            userId,
            result.shouldRouteNextMessage ? "pending" : "error",
          ).catch(() => undefined);
        }
        if (result.reply && sender) {
          const threaded = await sender
            .sendReply(
              relayInput.sessionId,
              relayInput.phone,
              relayInput.messageId,
              result.reply
            )
            .catch(() => false);
          if (!threaded) {
            await sender
              .sendText(relayInput.sessionId, relayInput.phone, result.reply)
              .catch(() => undefined);
          }
        }
      } finally {
        await sender?.close().catch(() => undefined);
      }
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const message: InboundMessage = {
    userId: route.userId,
    spaceId: inbound.spaceId,
    phone: inbound.phone,
    senderId: inbound.senderId,
    messageId: inbound.messageId,
    body,
    senderTier: tier,
  };
  const { runAt } = await enqueueInbound(supabase, message);

  // 5: ack before work (C8). 6: work after the response — typing indicator
  // immediately (a cold start becomes a pause, not silence), then the
  // debounced flush.
  after(async () => {
    // Eager wake (optibox): kick the box resume the instant the message
    // lands, in parallel with the typing indicator and the debounce wait,
    // so a cold VM boot overlaps the turn instead of preceding it.
    void prewarmBox(supabase, message.userId);
    const sender = await createSpectrumSender().catch(() => undefined);
    if (sender) {
      await sender
        .markRead(message.spaceId, message.phone, message.messageId)
        .catch(() => undefined);
      await sender
        .startTyping(message.spaceId, message.phone)
        .catch(() => undefined);
      // Instant first bubble: on the first message of a burst (owner only,
      // not a /command or bare attachment) a tightly-bounded fast-lane
      // completion answers right away while the real turn runs. The carry
      // marker goes in BEFORE the completion so the agent's turn always
      // knows an ack went out and never double-greets. Best-effort: any
      // failure leaves only the typing indicator.
      if (
        message.senderTier === 0 &&
        !body.trimStart().startsWith("/") &&
        !body.trimStart().startsWith("[attachment:")
      ) {
        try {
          if (await isBurstStart(supabase, message.spaceId)) {
            await carryQuickAckMarker(
              supabase,
              message.userId,
              message.spaceId,
            );
            const ack = await quickAckReply(supabase, message.userId, body);
            if (ack) {
              await sender.sendText(message.spaceId, message.phone, ack);
            }
          }
        } catch {
          // quick ack is best-effort; the flush owns the real reply
        }
      }
    }
    try {
      await flushAfterDebounce(supabase, message, runAt);
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "imessage flush failed",
          user_id: message.userId,
          space_id: message.spaceId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      await sender?.close().catch(() => undefined);
    }
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}
