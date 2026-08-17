/**
 * M14 task 6, Meta push path. The box (authenticated by its per-box
 * GATEWAY_TOKEN) posts yesterday's Meta insights fetched through its own MCP
 * OAuth — the control plane never holds a Meta credential. Rows are hostile
 * input (C9): the batch is validated in full before any write, attributed
 * only to the authenticated box's owner, and lands as an idempotent upsert.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  MetricsValidationError,
  upsertMetricRows,
  validatePushedRows,
} from "@/lib/ads/metrics";

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

  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("id, account_ref")
    .eq("user_id", userId)
    .eq("provider", "meta")
    .eq("status", "active");
  if (!accounts || accounts.length === 0) {
    return NextResponse.json(
      { error: "no active meta account" },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  try {
    const rows = validatePushedRows(
      body,
      userId,
      accounts as { id: string; account_ref: string }[]
    );
    await upsertMetricRows(supabase, rows);
    return NextResponse.json({ ok: true, rows: rows.length });
  } catch (error) {
    if (error instanceof MetricsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "ingest failed" }, { status: 502 });
  }
}
