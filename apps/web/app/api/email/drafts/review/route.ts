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
  request: NextRequest
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
    to?: unknown;
    subject?: unknown;
  } | null;
  const draftId =
    typeof body?.draft_id === "string" ? body.draft_id.trim() : "";
  if (!draftId || draftId.length > DRAFT_ID_MAX_LENGTH) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { data: address } = await supabase
    .from("agent_addresses")
    .select("agentmail_inbox_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("retired_at", null)
    .maybeSingle();
  const inboxId = address?.agentmail_inbox_id;
  if (!inboxId) {
    return NextResponse.json({ error: "no inbox" }, { status: 409 });
  }

  let draft: Awaited<ReturnType<typeof getDraft>>;
  try {
    draft = await getDraft(inboxId as string, draftId);
  } catch {
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

  await queueEmailDraftReview(supabase, userId, {
    draftId,
    ...(to !== undefined ? { to } : {}),
    ...(subject !== undefined ? { subject } : {}),
  });
  return NextResponse.json({ ok: true, status: "pending_approval" });
}
