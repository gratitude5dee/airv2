/**
 * MA3 publisher earnings export: per-app x402 receipt totals as CSV.
 * (Stripe storefront revenue joins the same shape after Session B lands.)
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { publisherEarnings } from "@/lib/miniapps/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await publisherEarnings(serviceClient(), userId);
  if (request.nextUrl.searchParams.get("format") === "csv") {
    const csv = [
      "slug,name,receipts,total_usdc",
      ...rows.map(
        (row) =>
          `${row.slug},"${row.name.replaceAll('"', '""')}",${row.receipts},${row.total_usdc.toFixed(6)}`
      ),
    ].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=earnings.csv",
      },
    });
  }
  return NextResponse.json({ earnings: rows });
}
