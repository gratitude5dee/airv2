/**
 * Pixel registry reads/writes. The pixel itself lives on Meta and is
 * created/managed by the agent through the box's Meta Ads MCP — this route
 * only records refs so every surface shares one pixel inventory. No platform
 * credential is stored or returned.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("ad_pixels")
    .select("id, account_id, pixel_ref, name, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: "list failed" }, { status: 502 });
  }
  return NextResponse.json({ pixels: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    pixel_ref?: string;
    name?: string;
    account_id?: string;
  };
  const pixelRef = (body.pixel_ref ?? "").trim();
  if (!pixelRef || !/^[A-Za-z0-9_-]{1,64}$/.test(pixelRef)) {
    return NextResponse.json({ error: "invalid pixel_ref" }, { status: 400 });
  }
  const supabase = serviceClient();
  if (body.account_id) {
    const { data: account } = await supabase
      .from("ad_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("id", body.account_id)
      .maybeSingle();
    if (!account) {
      return NextResponse.json({ error: "unknown account" }, { status: 400 });
    }
  }
  const { data, error } = await supabase
    .from("ad_pixels")
    .upsert(
      {
        user_id: userId,
        pixel_ref: pixelRef,
        name: (body.name ?? "").trim().slice(0, 128) || null,
        account_id: body.account_id ?? null,
        status: "active",
      },
      { onConflict: "user_id,pixel_ref" }
    )
    .select("id, account_id, pixel_ref, name, status, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "save failed" }, { status: 502 });
  }
  return NextResponse.json({ pixel: data });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
  };
  if (!body.id || (body.status !== "active" && body.status !== "archived")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("ad_pixels")
    .update({ status: body.status })
    .eq("user_id", userId)
    .eq("id", body.id)
    .select("id, status")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "update failed" }, { status: 502 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ pixel: data });
}
