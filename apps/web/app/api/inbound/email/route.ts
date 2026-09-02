/**
 * Mail inbound webhook (goal.md M5 §1) for `message.received` — one endpoint
 * for both providers (AgentMail / wzrdmail), selected by MAIL_PROVIDER.
 * Same order as the iMessage ingress: verify (Svix) → resolve → dedupe →
 * 200 → work. Recipients resolve through agent_addresses INCLUDING
 * retired aliases — a retired address routes forever.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { inboundWebhookSecret, mailProvider } from "@/lib/mail/client";
import { parseInboundEvent, type InboundMessageEvent } from "@/lib/mail/inbound-event";
import { serviceClient } from "@/lib/supabase";
import {
  SvixWebhookError,
  svixHeaders,
  verifySvixSignature,
} from "@/lib/routing/svix";
import { dedupeInboundEvent, resolveAgentAddress } from "@/lib/routing/inbound";
import { processInboundEmail } from "@/lib/email/inbound";

export const maxDuration = 800;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const headers = svixHeaders(request.headers);

  try {
    verifySvixSignature({
      headers,
      rawBody,
      secret: inboundWebhookSecret(),
    });
  } catch (error) {
    if (error instanceof SvixWebhookError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let event: InboundMessageEvent;
  try {
    event = parseInboundEvent(JSON.parse(Buffer.from(rawBody).toString("utf8")));
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (event.eventType !== "message.received") {
    // Spam / blocked / unauthenticated variants and other events: ack only.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const message = event.message;
  const messageId = message?.message_id;
  if (!messageId) {
    return NextResponse.json({ error: "missing message id" }, { status: 400 });
  }

  const supabase = serviceClient();

  const recipients = Array.isArray(message?.to)
    ? message.to
    : message?.to
      ? [message.to]
      : [];
  let userId: string | null = null;
  for (const recipient of recipients) {
    const route = await resolveAgentAddress(supabase, recipient);
    if (route) {
      userId = route.userId;
      break;
    }
  }

  const { alreadySeen } = await dedupeInboundEvent(
    supabase,
    { webhookId: headers.id ?? mailProvider(), messageId },
    userId
  );
  if (alreadySeen) {
    return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  // Ack before work (C8); the turn runs after the response.
  const inboxId = message?.inbox_id;
  if (userId && inboxId) {
    const resolvedUserId = userId;
    after(async () => {
      try {
        await processInboundEmail(supabase, resolvedUserId, inboxId, messageId);
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "email turn failed",
            user_id: resolvedUserId,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
