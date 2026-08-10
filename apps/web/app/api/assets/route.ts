/**
 * CM2 asset delivery surface. GET lists the user's ingested assets; POST
 * pulls a box asset through the stripped-export pipeline and mints a
 * short-TTL delivery URL (CC3). Bytes never transit this route — object
 * storage serves them directly.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import { ensureBoxAwake, StartLimitError } from "@/lib/orchestrator/boxes";
import {
  AssetPipelineError,
  ingestAsset,
  mintDelivery,
  sweepExpiredDeliveries,
} from "@/lib/assets/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await sweepExpiredDeliveries(supabase, session.userId);
  const { data, error } = await supabase
    .from("creative_assets")
    .select("id, box_asset_id, sha256, ext, kind, bytes, created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: "list failed" }, { status: 502 });
  }
  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    box_asset_id?: string;
    purpose?: string;
  };
  const boxAssetId = body.box_asset_id;
  if (!boxAssetId || !/^[A-Za-z0-9_-]{1,64}$/.test(boxAssetId)) {
    return NextResponse.json(
      { error: "box_asset_id required" },
      { status: 400 }
    );
  }
  try {
    const box = await ensureBoxAwake(supabase, session.userId);
    const asset = await ingestAsset(supabase, session.userId, box, boxAssetId);
    const delivery = await mintDelivery(supabase, asset, body.purpose ?? null);
    return NextResponse.json({
      asset_id: asset.id,
      sha256: asset.sha256,
      delivery_id: delivery.id,
      url: delivery.url,
      expires_at: delivery.expires_at,
    });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json(
        { error: "start_limit_reached" },
        { status: 429 }
      );
    }
    const message =
      error instanceof AssetPipelineError ? error.message : "delivery failed";
    console.error(
      JSON.stringify({
        msg: "asset delivery failed",
        user_id: session.userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
