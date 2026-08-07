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
import { dedupeInboundEvent, resolveLine } from "@/lib/routing/inbound";
import {
  enqueueInbound,
  flushAfterDebounce,
  type InboundMessage,
} from "@/lib/orchestrator/flush";
import { createSpectrumSender } from "@/lib/spectrum/sender";
import { handleOnboarding } from "@/lib/provisioning/onboarding";

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
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let inbound;
  try {
    inbound = parseInboundSpectrumMessage(rawBody, headers);
  } catch (error) {
    if (error instanceof SpectrumWebhookError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  if (!inbound) {
    // Signed but non-conversational (outbound echo, read receipt, other
    // platform): acknowledge and ignore.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const supabase = serviceClient();

  // 3: resolve space.phone → lines → user_id.
  const route = inbound.phone
    ? await resolveLine(supabase, inbound.phone)
    : undefined;

  // 4: dedupe. A conflict means already-seen: return 200 and stop.
  const { alreadySeen } = await dedupeInboundEvent(
    supabase,
    {
      webhookId: inbound.webhookId ?? "spectrum",
      messageId: inbound.messageId,
    },
    route?.userId ?? null
  );
  if (alreadySeen) {
    return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  if (!route || !inbound.phone) {
    // Unroutable line: recorded as an event, no work dispatched.
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
    body
  );
  if (onboarding.kind === "ignore") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (onboarding.kind === "reply") {
    const reply = onboarding.text;
    const spaceId = inbound.spaceId;
    const phone = inbound.phone;
    after(async () => {
      const sender = await createSpectrumSender().catch(() => undefined);
      if (!sender) return;
      try {
        await sender.sendText(spaceId, phone, reply);
      } finally {
        await sender.close().catch(() => undefined);
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
  };
  const { runAt } = await enqueueInbound(supabase, message);

  // 5: ack before work (C8). 6: work after the response — typing indicator
  // immediately (a cold start becomes a pause, not silence), then the
  // debounced flush.
  after(async () => {
    const sender = await createSpectrumSender().catch(() => undefined);
    if (sender) {
      await sender
        .startTyping(message.spaceId, message.phone)
        .catch(() => undefined);
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
        })
      );
    } finally {
      await sender?.close().catch(() => undefined);
    }
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}
