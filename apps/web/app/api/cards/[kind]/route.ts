/**
 * Agent-initiated mini-app card, generalized over every registered card kind
 * (goal.md §4.3). Same contract as /api/cards/computer: the user's own Hermes
 * (authenticated by its per-box GATEWAY_TOKEN) asks the control plane to send
 * its OWNER an iMessage card that opens the app view. The mint happens
 * control-plane-side and the single-use token goes only to the owner's
 * iMessage thread (C15: owner-scoped — never an arbitrary recipient), rate
 * limited per (user, kind) by claimCardSend.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sendMiniAppCard } from "@/lib/miniapps/cards";
import { claimCardSend, type CardClaim } from "@/lib/miniapps/cardSends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CARD_KINDS = [
  "ads",
  "computer",
  "calendar",
  "vault",
  "browser",
  "kanban",
  "todo",
  "onboarding",
  "connect",
  "video",
  "image",
  "crm",
  "analytics",
  "inbox",
  "pay",
  "shop",
  "settings",
] as const;

type Kind = (typeof CARD_KINDS)[number];

function isCardKind(value: string): value is Kind {
  return (CARD_KINDS as readonly string[]).includes(value);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> }
): Promise<NextResponse> {
  const { kind } = await context.params;
  if (!isCardKind(kind)) {
    return NextResponse.json({ error: "unknown card kind" }, { status: 404 });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (!box) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = box.user_id as string;

  // The owner's iMessage destination: only the durable per-user record,
  // written exclusively from tier-0 (owner-handle) inbounds. No flush_jobs
  // fallback — its latest row can belong to a tier-1 contact's thread on a
  // shared line, and the card must never land there.
  const { data: dest } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  const spaceId = dest?.space_id ? String(dest.space_id) : "";
  const phone = dest?.phone ? String(dest.phone) : "";
  if (!spaceId || !phone) {
    return NextResponse.json(
      { error: "no known imessage destination for this user" },
      { status: 409 }
    );
  }

  let claim: CardClaim | undefined;
  try {
    claim = await claimCardSend(supabase, userId, kind);
    if (!claim) {
      return NextResponse.json(
        { error: `a ${kind} card was sent recently — wait before sending another` },
        { status: 429 }
      );
    }
    await sendMiniAppCard(
      supabase,
      spaceId,
      phone,
      userId,
      kind,
      "default"
    );
  } catch (error) {
    await claim?.release().catch(() => undefined);
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "card send failed", kind, user_id: userId, error: message })
    );
    return NextResponse.json({ error: "card send failed" }, { status: 502 });
  }
  console.log(JSON.stringify({ msg: "card sent", kind, user_id: userId }));
  return NextResponse.json({ ok: true });
}
