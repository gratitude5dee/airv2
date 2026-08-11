/**
 * CM8 task 2: the publish audit trail. Given a slot, reconstruct why the
 * post exists (the content_plan decision and its briefs), what went out
 * (assets by content hash via the slot's deliveries), who approved it and
 * when (resolved decisions referencing the slot or its plan), what platform
 * said (external id, permalink), the verdict history, the platform limits
 * the draft was validated against, and the brand revision in force.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";
import { adapterFor } from "@/lib/publish/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuditSlot {
  id: string;
  user_id: string;
  platform: string;
  account_ref: string;
  package_ref: string;
  scheduled_at: string;
  timezone: string;
  status: string;
  attempt: number;
  publish_state: Record<string, unknown> | null;
  external_id: string | null;
  permalink: string | null;
  last_verdict: string | null;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
  source_id: string | null;
  moment_key: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const slotId = request.nextUrl.searchParams.get("slot_id");
  if (!slotId) {
    return NextResponse.json({ error: "slot_id required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data: slot } = await supabase
    .from("content_slots")
    .select(
      "id, user_id, platform, account_ref, package_ref, scheduled_at, " +
        "timezone, status, attempt, publish_state, external_id, permalink, " +
        "last_verdict, error_message, published_at, created_at, source_id, " +
        "moment_key"
    )
    .eq("id", slotId)
    .maybeSingle<AuditSlot>();
  if (!slot) {
    return NextResponse.json({ error: "slot not found" }, { status: 404 });
  }
  const userId = slot.user_id;

  // The plan that proposed this slot (if source-originated): its briefs and
  // approval are the "why".
  const planRef = /^plan:([^:]+):/.exec(slot.package_ref)?.[1];
  const [planDecision, slotDecisions, deliveries, brand] = await Promise.all([
    planRef
      ? supabase
          .from("decisions")
          .select("id, kind, label, status, payload, created_at, resolved_at")
          .eq("user_id", userId)
          .eq("kind", "content_plan")
          .eq("ref", planRef)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("decisions")
      .select("id, kind, platform, label, status, created_at, resolved_at")
      .eq("user_id", userId)
      .eq("ref", slotId)
      .order("created_at", { ascending: true }),
    supabase
      .from("asset_deliveries")
      .select(
        "id, storage_key, purpose, expires_at, revoked_at, created_at, " +
          "creative_assets ( sha256, ext, kind, bytes, box_asset_id )"
      )
      .eq("user_id", userId)
      .eq("purpose", `slot:${slotId}`),
    supabase
      .from("brand_kits")
      .select("rev, mirrored_rev, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const adapter = adapterFor(slot.platform);
  return NextResponse.json({
    slot,
    plan: planDecision.data,
    decisions: slotDecisions.data ?? [],
    assets: deliveries.data ?? [],
    // Current revision: brand state is mirrored into the box at rev
    // boundaries, so mirrored_rev bounds what the agent rendered against.
    brand: brand.data,
    validation_limits: adapter ? adapter.limits : null,
  });
}
