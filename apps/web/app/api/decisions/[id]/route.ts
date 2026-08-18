/**
 * Decision detail for the Needs-you drawer (V8): the full stored payload,
 * plus — for email drafts — the held draft's body read from AgentMail at
 * view time (the body never lands in Postgres, C4). no-store: the response
 * can carry draft text and payload details.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { getDraft } from "@/lib/agentmail/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }
  const { id } = await context.params;
  const supabase = serviceClient();
  const { data: decision } = await supabase
    .from("decisions")
    .select(
      "id, kind, platform, sender, ref, label, status, created_at, resolved_at, payload"
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!decision) {
    return NextResponse.json(
      { error: "not found" },
      { status: 404, headers: NO_STORE }
    );
  }

  let draft: { subject?: string; text?: string; to?: string[] } | null = null;
  if (decision.kind === "email_draft" && decision.ref) {
    const { data: address } = await supabase
      .from("agent_addresses")
      .select("agentmail_inbox_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .is("retired_at", null)
      .maybeSingle();
    if (address?.agentmail_inbox_id) {
      try {
        const full = await getDraft(
          address.agentmail_inbox_id as string,
          decision.ref as string
        );
        draft = { subject: full.subject, text: full.text, to: full.to };
      } catch {
        // Draft may be gone (sent or expired); the drawer degrades to the
        // stored metadata.
      }
    }
  }

  return NextResponse.json({ decision, draft }, { headers: NO_STORE });
}
