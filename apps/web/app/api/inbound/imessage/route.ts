/**
 * Spectrum inbound webhook (goal.md M2 §2). The order IS the requirement:
 *   1. verify signature   2. reject stale   3. resolve (line, sender) → user
 *   4. dedupe on (webhook_id, message_id)   5. return 200   6. work after.
 *
 * Only routing identifiers touch Postgres — never content or media (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { serviceClient } from "@/lib/supabase";
import {
  SpectrumWebhookError,
  parseInboundSpectrumMessage,
  spectrumWebhookHeaders,
  verifySpectrumSignature,
} from "@/lib/routing/spectrum";
import { dedupeInboundEvent, resolveLine } from "@/lib/routing/inbound";

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

  if (!route) {
    // Unroutable line: recorded as an event, no work dispatched.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 5: ack before work (C8). 6: work — M2 wires burst debouncing (batch_queue)
  // and the box run dispatch here.
  return NextResponse.json({ ok: true }, { status: 200 });
}
