/**
 * Owner-session receipts list backing the /home Context screen: the most
 * recent trace receipts as JSON. Receipts are metadata only (same projection
 * the MA9.3 export streams) — no transcript bytes, no Postgres writes.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { fetchReceipts } from "@/lib/traces/receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_DAYS = 30;
const MAX_ROWS = 50;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const from = new Date(
    Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const receipts = await fetchReceipts(supabase, userId, { from }, 1000);
  receipts.sort((a, b) => String(b.ts ?? "").localeCompare(String(a.ts ?? "")));
  return NextResponse.json(
    { receipts: receipts.slice(0, MAX_ROWS) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
