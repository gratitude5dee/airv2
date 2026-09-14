import { NextRequest, NextResponse } from "next/server";
import {
  createCheckoutHandoff,
  updateCheckoutHandoff,
  type CheckoutHandoffStatus,
} from "@/lib/checkout/handoffs";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create an owner-scoped handoff from the authenticated Box/Hermes lane. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = serviceClient();
  const { data: box } = await supabase.from("boxes").select("user_id").eq("gateway_token", token).maybeSingle();
  if (!box) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body["merchant_url"] !== "string" || typeof body["item_summary"] !== "string") {
    return NextResponse.json({ error: "merchant_url and item_summary are required" }, { status: 400 });
  }
  const { data: destination } = await supabase.from("imessage_destinations").select("space_id, phone").eq("user_id", box.user_id).maybeSingle();
  if (!destination?.space_id || !destination.phone) return NextResponse.json({ error: "no known imessage destination" }, { status: 409 });
  try {
    const handoff = await createCheckoutHandoff(supabase, {
      userId: String(box.user_id), spaceId: String(destination.space_id), phone: String(destination.phone),
      taskId: typeof body["task_id"] === "string" ? body["task_id"] : null,
      merchantUrl: body["merchant_url"], itemSummary: body["item_summary"],
      quantity: typeof body["quantity"] === "number" ? body["quantity"] : null,
      amountCents: typeof body["amount_cents"] === "number" ? body["amount_cents"] : null,
      currency: typeof body["currency"] === "string" ? body["currency"] : null,
      blocker: typeof body["blocker"] === "string" ? body["blocker"] : null,
      status: body["status"] === "needs_human" ? "needs_human" : "ready_for_review",
      verifiedAt: typeof body["verified_at"] === "string" ? body["verified_at"] : null,
      expiresAt: typeof body["expires_at"] === "string" ? body["expires_at"] : null,
      sameSession: body["same_session"] !== false,
      paymentRequestId: typeof body["payment_request_id"] === "string" ? body["payment_request_id"] : null,
    });
    return NextResponse.json({ ok: true, handoff_id: handoff.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "invalid handoff" }, { status: 400 });
  }
}

/** Advance a handoff from the same authenticated Box/Hermes lane. */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = serviceClient();
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (!box) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof body?.["handoff_id"] === "string" ? body["handoff_id"] : "";
  const status = typeof body?.["status"] === "string" ? body["status"] as CheckoutHandoffStatus : undefined;
  try {
    const update: Parameters<typeof updateCheckoutHandoff>[3] = {};
    if (status !== undefined) update.status = status;
    if (body?.["blocker"] === null || typeof body?.["blocker"] === "string") update.blocker = body["blocker"] as string | null;
    if (body?.["verified_at"] === null || typeof body?.["verified_at"] === "string") update.verifiedAt = body["verified_at"] as string | null;
    if (body?.["expires_at"] === null || typeof body?.["expires_at"] === "string") update.expiresAt = body["expires_at"] as string | null;
    if (body?.["payment_request_id"] === null || typeof body?.["payment_request_id"] === "string") update.paymentRequestId = body["payment_request_id"] as string | null;
    if (typeof body?.["version"] === "number") update.expectedVersion = body["version"];
    const handoff = await updateCheckoutHandoff(supabase, String(box.user_id), id, update);
    return NextResponse.json({ ok: true, handoff_id: handoff.id, status: handoff.status, version: handoff.version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid handoff update";
    const statusCode = message === "checkout handoff not found" ? 404 : message.includes("conflict") || message.includes("terminal") || message.includes("transition") ? 409 : 400;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
