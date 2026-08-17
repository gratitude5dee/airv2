/**
 * M14 task 4: Meta connect confirmation postback. Meta's OAuth completes in
 * the agent's browser inside the box, so the control plane never sees a Meta
 * credential — the box (authenticated by its per-box GATEWAY_TOKEN, exact
 * pattern of /api/cards/computer) reports only the discovered account ref.
 * The row is attributed to the authenticated box's owner; nothing in the
 * body picks the tenant (C9).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const body = (await request.json().catch(() => ({}))) as {
    account_ref?: unknown;
    label?: unknown;
  };
  const accountRef =
    typeof body.account_ref === "string" ? body.account_ref.trim() : "";
  if (!accountRef || accountRef.length > 128) {
    return NextResponse.json({ error: "account_ref required" }, { status: 400 });
  }
  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 200)
      : null;

  // Re-confirmation must not rotate the conversion token (pixel postbacks
  // authenticate with it) — same rule as the operator admin route.
  const { data: existing } = await supabase
    .from("ad_accounts")
    .select("id, conversion_token, label")
    .eq("user_id", userId)
    .eq("provider", "meta")
    .eq("account_ref", accountRef)
    .maybeSingle();
  const { data, error } = await supabase
    .from("ad_accounts")
    .upsert(
      {
        user_id: userId,
        provider: "meta",
        account_ref: accountRef,
        label: label ?? existing?.label ?? null,
        conversion_token:
          existing?.conversion_token ?? randomBytes(24).toString("hex"),
        status: "active",
      },
      { onConflict: "user_id,provider,account_ref" }
    )
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: "account upsert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, account_id: data.id });
}
