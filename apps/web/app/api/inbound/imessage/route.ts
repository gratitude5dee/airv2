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
  isOnboardingLine,
  resolveInboundRoute,
} from "@/lib/routing/inbound";
import {
  carryQuickAckMarker,
  dropQuickAckMarker,
  enqueueInbound,
  flushAfterDebounce,
  isBurstStart,
  updateQuickAckMarker,
  type InboundMessage,
} from "@/lib/orchestrator/flush";
import {
  initialResponse,
  type InitialResponse,
} from "@/lib/orchestrator/sharedBridge";
import {
  ACK_REACTION,
  hasExplicitResponseLane,
  INITIAL_REPLY_SLA_MS,
  REACTION_SLA_MS,
} from "@/lib/orchestrator/ttfk";
import { prewarmBox } from "@/lib/orchestrator/boxes";
import { createSpectrumSender } from "@/lib/spectrum/sender";
import {
  handleOnboarding,
  signupSender,
} from "@/lib/provisioning/onboarding";
import { ensureComputeProvisioned } from "@/lib/provisioning/provision";
import {
  createDecision,
  normalizeAddress,
  resolveTrustTier,
} from "@/lib/routing/trust";
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

/**
 * Reply on the line: thread under the source message when the target
 * resolves, plain send otherwise.
 */
async function sendLineReply(
  spaceId: string,
  phone: string,
  messageId: string,
  text: string,
  senderPromise?: ReturnType<typeof warmSpectrumSender>,
): Promise<void> {
  const sender = await (senderPromise ?? warmSpectrumSender());
  if (!sender) return;
  try {
    const threaded = await sender
      .sendReply(spaceId, phone, messageId, text)
      .catch(() => false);
    if (!threaded) await sender.sendText(spaceId, phone, text);
  } finally {
    await sender.close().catch(() => undefined);
  }
}

/**
 * Token minting and gRPC client construction are read-only, but account for a
 * material part of first-kindness latency. Start them as soon as a known user
 * route exists, while dedupe/onboarding/trust checks continue. No send occurs
 * until those gates pass, so tier-2 contacts still cause zero outbound work.
 */
function warmSpectrumSender() {
  return createSpectrumSender().catch(() => undefined);
}

async function closeWarmSpectrumSender(
  senderPromise: ReturnType<typeof warmSpectrumSender> | undefined,
): Promise<void> {
  const sender = await senderPromise;
  await sender?.close().catch(() => undefined);
}

function closeWarmSpectrumSenderAfter(
  senderPromise: ReturnType<typeof warmSpectrumSender> | undefined,
): void {
  if (!senderPromise) return;
  after(() => closeWarmSpectrumSender(senderPromise));
}

async function withWarmSenderCleanup<T>(
  operation: Promise<T>,
  senderPromise: ReturnType<typeof warmSpectrumSender> | undefined,
): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    closeWarmSpectrumSenderAfter(senderPromise);
    throw error;
  }
}

/**
 * Starts before the HTTP response is returned. The promise is awaited from
 * `after()` so serverless teardown cannot interrupt it, but establishing the
 * Spectrum connection and sending the tapback do not wait for debounce,
 * box wake, or a model request.
 */
async function sendImmediateReaction(
  sender: Awaited<ReturnType<typeof createSpectrumSender>> | undefined,
  message: InboundMessage,
  receivedAtMs: number
): Promise<void> {
  if (!sender) return;
  const reacted = await sender
    .react(message.spaceId, message.phone, message.messageId, ACK_REACTION)
    .catch(() => false);
  console.info(
    JSON.stringify({
      msg: "imessage ttfk reaction",
      user_id: message.userId,
      space_id: message.spaceId,
      delivered: reacted,
      elapsed_ms: Date.now() - receivedAtMs,
      within_sla: Date.now() - receivedAtMs <= REACTION_SLA_MS,
    })
  );
}

/**
 * A single first bubble per settled burst. The marker is present for normal
 * agent turns so the final model reply never repeats the acknowledgement.
 * Explicit commands own their deterministic response lane, so they receive
 * the visible line without introducing a marker into their command input.
 */
async function sendInitialReply(
  supabase: ReturnType<typeof serviceClient>,
  sender: Awaited<ReturnType<typeof createSpectrumSender>> | undefined,
  message: InboundMessage,
  body: string,
  response: InitialResponse,
  receivedAtMs: number
): Promise<boolean> {
  if (!sender || !(await isBurstStart(supabase, message.spaceId))) return false;
  const isCommand =
    body.trimStart().startsWith("/") || hasExplicitResponseLane(body);
  const markerId = isCommand || response.disposition === "final"
    ? undefined
    : await carryQuickAckMarker(supabase, message.userId, message.spaceId);
  let sent = false;
  try {
    await sender.sendText(message.spaceId, message.phone, response.body);
    sent = true;
    if (markerId) {
      await updateQuickAckMarker(
        supabase,
        message.spaceId,
        markerId,
        response.body
      );
    }
    console.info(
      JSON.stringify({
        msg: "imessage ttfk initial reply",
        user_id: message.userId,
        space_id: message.spaceId,
        elapsed_ms: Date.now() - receivedAtMs,
        within_sla: Date.now() - receivedAtMs <= INITIAL_REPLY_SLA_MS,
        kind: isCommand ? "command" : "agent",
        disposition: response.disposition,
        source: response.source,
      })
    );
    return response.disposition === "final";
  } finally {
    if (markerId && !sent) {
      await dropQuickAckMarker(supabase, message.spaceId, markerId);
    }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Keep SLA accounting anchored to request receipt, rather than after the
  // routing/database work required to safely identify a trusted recipient.
  const receivedAtMs = Date.now();
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
      console.warn(
        JSON.stringify({
          msg: "spectrum webhook rejected",
          status: error.status,
          reason: error.message,
          event: headers.event ?? null,
          has_signature: Boolean(headers.signature),
          signature_format: headers.signature?.startsWith("v0=")
            ? "v0"
            : headers.signature
              ? "bare"
              : "missing",
          has_timestamp: Boolean(headers.timestamp),
        }),
      );
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
  let route = await resolveInboundRoute(supabase, {
    phone: inbound.phone,
    senderAddress: inbound.senderId,
  });
  const warmSenderPromise = route && inbound.phone
    ? warmSpectrumSender()
    : undefined;

  // 4: dedupe. A conflict means already-seen: return 200 and stop.
  const { alreadySeen } = await withWarmSenderCleanup(
    dedupeInboundEvent(
      supabase,
      {
        webhookId: inbound.webhookId ?? "spectrum",
        messageId: inbound.messageId,
      },
      route?.userId ?? null,
    ),
    warmSenderPromise,
  );
  if (alreadySeen) {
    closeWarmSpectrumSenderAfter(warmSenderPromise);
    return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  const marker =
    inbound.attachmentIds.length > 0
      ? `[attachment:${inbound.attachmentIds.join(",")}]`
      : "";
  // A private Find My share is persisted as a marker only — the
  // coordinates never reach Postgres (§2.6, C4).
  const body = inbound.locationSignal
    ? ["[location shared]", inbound.text ?? ""].filter(Boolean).join("\n")
    : [marker, inbound.text ?? ""].filter(Boolean).join("\n");
  if (!body) {
    // Identifiers only (C4): a conversational payload whose content parsed to
    // nothing would otherwise vanish without a trace.
    console.error(
      JSON.stringify({
        msg: "imessage inbound empty body",
        user_id: route?.userId ?? null,
        space_id: inbound.spaceId,
        message_id: inbound.messageId,
      }),
    );
    closeWarmSpectrumSenderAfter(warmSenderPromise);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!route || !inbound.phone) {
    // Self-serve signup (platform.md §user lifecycle): the onboarding line
    // answers unknown senders with a fresh pre-active account bound to their
    // own handle, then the same claim/OTP flow an invited user runs. On any
    // other line an unroutable inbound is recorded and dropped.
    if (
      inbound.phone &&
      inbound.senderId &&
      (await isOnboardingLine(supabase, inbound.phone))
    ) {
      const senderAddress = normalizeAddress("imessage", inbound.senderId);
      if (/^\+?\d{8,15}$/.test(senderAddress)) {
        try {
          route = { userId: await signupSender(supabase, inbound.senderId) };
        } catch (error) {
          // A failed signup must not be deduped away — release the event so
          // Spectrum's redelivery retries account creation.
          await supabase
            .from("inbound_events")
            .delete()
            .eq("webhook_id", inbound.webhookId ?? "spectrum")
            .eq("message_id", inbound.messageId);
          throw error;
        }
      } else {
        // An iMessage sent from an email Apple ID carries no phone number
        // (digits in the address don't make it one) — the SMS OTP could
        // never reach them, so say so instead of signing up an account
        // every later text would still ignore.
        const spaceId = inbound.spaceId;
        const phone = inbound.phone;
        const messageId = inbound.messageId;
        after(async () => {
          await sendLineReply(
            spaceId,
            phone,
            messageId,
            "To sign up, text me from your phone number — I can't reach an email address.",
          );
        });
        return NextResponse.json({ ok: true }, { status: 200 });
      }
    } else {
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
  }

  // M3: pre-active accounts are handled by the claim/OTP flow; inbound from
  // any sender other than bound_phone routes nowhere (C11).
  const onboarding = await withWarmSenderCleanup(
    handleOnboarding(
      supabase,
      route.userId,
      inbound.senderId,
      body,
    ),
    warmSenderPromise,
  );
  if (onboarding.kind === "ignore") {
    closeWarmSpectrumSenderAfter(warmSenderPromise);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (onboarding.kind === "reply") {
    const reply = onboarding.text;
    const startCompute = onboarding.startCompute === true;
    const userId = route.userId;
    const spaceId = inbound.spaceId;
    const phone = inbound.phone;
    const messageId = inbound.messageId;
    after(async () => {
      // Reply first; then the build. `after` keeps the invocation alive
      // only for awaited work — a detached provision promise could freeze
      // before the boxes row exists.
      await sendLineReply(
        spaceId,
        phone,
        messageId,
        reply,
        warmSenderPromise,
      );
      if (startCompute) {
        await ensureComputeProvisioned(supabase, userId).catch(
          (error: unknown) => {
            console.error(
              JSON.stringify({
                msg: "self-serve compute provision failed",
                user_id: userId,
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          },
        );
      }
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // M4: resolve the sender's trust tier before any work. Tier 2 (unknown)
  // may not cause any side effect — no run, no reply; it lands in "Needs
  // you" for the owner to triage (ARCHITECTURE.md §2.5c).
  const tier = inbound.senderId
    ? await withWarmSenderCleanup(
        resolveTrustTier(
          supabase,
          route.userId,
          "imessage",
          inbound.senderId,
        ),
        warmSenderPromise,
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
    closeWarmSpectrumSenderAfter(warmSenderPromise);
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
    ((await withWarmSenderCleanup(
      spectrumFlowActive(supabase, route.userId),
      warmSenderPromise,
    )) ||
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
      const sender = await (warmSenderPromise ?? warmSpectrumSender());
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
  // Start connecting before the 200 leaves this function. The promise is
  // retained by `after()` below and the reaction begins in parallel with the
  // durable queue write.
  const senderPromise = warmSenderPromise ?? warmSpectrumSender();
  const reaction = senderPromise.then((sender) =>
    sendImmediateReaction(sender, message, receivedAtMs)
  );
  // The fast answer and the Spectrum connection race in parallel. Production
  // GLM latency is typically longer than sender initialization, so starting
  // this only after the sender connects would waste the entire 5s budget.
  const initialResponsePromise = initialResponse(
    supabase,
    message.userId,
    body
  );
  let runAt: string;
  try {
    ({ runAt } = await enqueueInbound(supabase, message));
  } catch (error) {
    // The sender may already have connected for the reaction. Do not retain a
    // live client if the durable queue write rejects.
    void senderPromise.then((sender) => sender?.close().catch(() => undefined));
    throw error;
  }

  // First-kindness work starts immediately, while the durable model turn
  // remains after the 200. A cold wake therefore overlaps the 1s tapback and
  // 5s first-bubble budgets instead of preceding them.
  after(async () => {
    void prewarmBox(supabase, message.userId);
    const sender = await senderPromise;
    if (sender) {
      // The tapback was already dispatched before the queue write. Do not
      // let a slow receipt/read operation consume the five-second first-bubble
      // budget; all three are best-effort independent iMessage actions.
      void reaction.catch(() => undefined);
      void sender
        .markRead(message.spaceId, message.phone, message.messageId)
        .catch(() => undefined);
      void sender
        .startTyping(message.spaceId, message.phone)
        .catch(() => undefined);
      const response = await initialResponsePromise;
      const completed = await sendInitialReply(
        supabase,
        sender,
        message,
        body,
        response,
        receivedAtMs
      ).catch(() => false);
      if (completed) {
        // The first bubble fully answered this message. Remove only that exact
        // durable row; flushAfterDebounce still runs to clean the job or serve
        // any concurrently-arriving message whose newer deadline won.
        const { error } = await supabase
          .from("batch_queue")
          .delete()
          .eq("space_id", message.spaceId)
          .eq("message_id", message.messageId);
        if (error) {
          console.error(
            JSON.stringify({
              msg: "imessage direct completion cleanup failed",
              user_id: message.userId,
              space_id: message.spaceId,
              error: error.message,
            })
          );
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
