/**
 * link.wzrd.tech/ — the bare payment-link host root. Public, minimal: it
 * explains what a link is without confirming or denying any slug exists.
 */
import { NextResponse } from "next/server";
import { baseHeaders, page } from "@/lib/miniapps/html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return new NextResponse(
    page(
      "Payment link",
      `<h1>Payment link</h1><div class="card">This is a payment link host — open the full link you were sent to buy a product.</div>`
    ),
    { status: 200, headers: { ...baseHeaders(), "Content-Type": "text/html; charset=utf-8" } }
  );
}
