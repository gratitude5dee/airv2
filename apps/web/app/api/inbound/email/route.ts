/**
 * AgentMail inbound webhook (goal.md M5 §1) for `message.received`.
 * Same order as the iMessage ingress: verify (Svix) → resolve → dedupe →
 * 200 → work. Recipients resolve through agent_addresses INCLUDING
 * retired aliases — a retired address routes forever.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
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

interface AgentMailMessageEvent {
  event_type?: string;
  event_id?: string;
  message?: {
    message_id?: string;
    to?: string[] | string;
    inbox_id?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const headers = svixHeaders(request.headers);

  try {
    verifySvixSignature({
      headers,
      rawBody,
      secret: env.agentmailWebhookSecret(),
    });
  } catch (error) {
    if (error instanceof SvixWebhookError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let event: AgentMailMessageEvent;
  try {
    event = JSON.parse(Buffer.from(rawBody).toString("utf8")) as AgentMailMessageEvent;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (event.event_type !== "message.received") {
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
    { webhookId: headers.id ?? "agentmail", messageId },
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
