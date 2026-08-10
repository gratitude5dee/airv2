/**
 * Asset detail and delivery revocation (CM2). DELETE revokes every active
 * delivery for the asset — on publish confirmation the platform holds its
 * own copy, so ours has no further job (CC3).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import { AssetPipelineError, revokeDeliveries } from "@/lib/assets/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: asset } = await supabase
    .from("creative_assets")
    .select("id, box_asset_id, sha256, ext, kind, bytes, created_at")
    .eq("user_id", session.userId)
    .eq("id", id)
    .maybeSingle();
  if (!asset) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { data: deliveries } = await supabase
    .from("asset_deliveries")
    .select("id, purpose, expires_at, revoked_at, created_at")
    .eq("user_id", session.userId)
    .eq("asset_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ asset, deliveries: deliveries ?? [] });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: asset } = await supabase
    .from("creative_assets")
    .select("id")
    .eq("user_id", session.userId)
    .eq("id", id)
    .maybeSingle();
  if (!asset) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const revoked = await revokeDeliveries(supabase, session.userId, id);
    return NextResponse.json({ revoked });
  } catch (error) {
    const message =
      error instanceof AssetPipelineError ? error.message : "revoke failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
