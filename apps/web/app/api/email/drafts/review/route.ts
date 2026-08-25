/**
 * Box-facing half of C10: the box can create a draft, but only the control
 * plane can turn it into a Needs-you decision and only owner approval can
 * send it. Recipient and subject come from AgentMail rather than being
 * self-reported by the box.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDraft } from "@/lib/agentmail/client";
import { queueEmailDraftReview } from "@/lib/email/review";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DRAFT_ID_MAX_LENGTH = 200;

async function boxUserId(
  supabase: SupabaseClient,
  request: NextRequest,
): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  return box ? (box.user_id as string) : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    draft_id?: unknown;
    inbox_id?: unknown;
    to?: unknown;
    subject?: unknown;
  } | null;
  const draftId =
    typeof body?.draft_id === "string" ? body.draft_id.trim() : "";
  if (!draftId || draftId.length > DRAFT_ID_MAX_LENGTH) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { data: addresses } = await supabase
    .from("agent_addresses")
    .select("agentmail_inbox_id, is_primary")
    .eq("user_id", userId)
    .is("retired_at", null);
  const ownedInboxes = (addresses ?? [])
    .filter(
      (
        address,
      ): address is { agentmail_inbox_id: string; is_primary: boolean } =>
        typeof address.agentmail_inbox_id === "string" &&
        address.agentmail_inbox_id.length > 0,
    )
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((address) => address.agentmail_inbox_id);
  if (ownedInboxes.length === 0) {
    return NextResponse.json({ error: "no inbox" }, { status: 409 });
  }

  const requestedInboxId = body?.inbox_id;
  if (
    requestedInboxId !== undefined &&
    (typeof requestedInboxId !== "string" ||
      !ownedInboxes.includes(requestedInboxId))
  ) {
    return NextResponse.json({ error: "no such draft" }, { status: 404 });
  }
  const inboxesToTry =
    typeof requestedInboxId === "string" ? [requestedInboxId] : ownedInboxes;
  let draft: Awaited<ReturnType<typeof getDraft>> | null = null;
  for (const inboxId of inboxesToTry) {
    try {
      draft = await getDraft(inboxId, draftId);
      break;
    } catch {
      // Try the next inbox owned by this user.
    }
  }
  if (!draft) {
    return NextResponse.json({ error: "no such draft" }, { status: 404 });
  }

  const draftTo =
    Array.isArray(draft.to) && typeof draft.to[0] === "string"
      ? draft.to[0]
      : undefined;
  const bodyTo = typeof body?.to === "string" ? body.to : undefined;
  const bodySubject =
    typeof body?.subject === "string" ? body.subject : undefined;
  const to = draftTo ?? bodyTo;
  const subject = draft.subject ?? bodySubject;

  const { data: pending } = await supabase
    .from("decisions")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "email_draft")
    .eq("ref", draftId)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return NextResponse.json({ ok: true, status: "already_pending" });
  }

  try {
    await queueEmailDraftReview(supabase, userId, {
      draftId,
      ...(to !== undefined ? { to } : {}),
      ...(subject !== undefined ? { subject } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "could not file the review" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, status: "pending_approval" });
}
