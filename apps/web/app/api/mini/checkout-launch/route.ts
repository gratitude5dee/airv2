/**
 * Sensitive browser launch for checkout handoffs.
 *
 * The initial link has its bearer token in `#t=…`, which fragments never
 * reach Vercel, link unfurlers, or access logs. The browser-owned script
 * POSTs that token once, receives a short-lived HttpOnly cookie scoped to
 * /checkout, then redirects to the token-free app page. This intentionally
 * differs from static iMessage-card links: previews are normal there, but
 * are unsafe for a purchase handoff.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { getCheckoutHandoff } from "@/lib/checkout/handoffs";
import { cookieName } from "@/lib/miniapps/gates";
import { baseHeaders, page, withBaseHeaders } from "@/lib/miniapps/html";
import {
  consumeRedemptionOnce,
  mintToken,
  verifyToken,
} from "@/lib/miniapps/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BROWSER_SESSION_SECONDS = 15 * 60;

export async function GET(): Promise<NextResponse> {
  const body = page(
    "Open checkout",
    '<h1>Opening checkout…</h1><div class="card" data-checkout-launch>Preparing a private checkout handoff.</div><script src="/creator-os/checkout-launch.js" defer></script>'
  );
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...baseHeaders(),
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `${baseHeaders()["Content-Security-Policy"]}; script-src 'self'`,
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as
    | { token?: unknown }
    | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const claims = verifyToken(token, "checkout");
  if (!claims) {
    return NextResponse.json({ error: "This checkout link is invalid or expired." }, { status: 403, headers: baseHeaders() });
  }
  const supabase = serviceClient();
  // Check the owner-bound record before consuming the capability. A bad or
  // deleted handoff should not burn a valid link through a stale preview.
  const handoff = await getCheckoutHandoff(supabase, claims.userId, claims.resourceId);
  if (!handoff) {
    return NextResponse.json({ error: "This checkout handoff is no longer available." }, { status: 404, headers: baseHeaders() });
  }
  if (!(await consumeRedemptionOnce(supabase, claims))) {
    return NextResponse.json({ error: "This checkout link has already been used. Ask Air for a fresh link." }, { status: 409, headers: baseHeaders() });
  }
  const response = withBaseHeaders(NextResponse.json({ ok: true, next: "/checkout" }));
  response.cookies.set(
    cookieName("checkout"),
    mintToken(claims.userId, "checkout", claims.resourceId, 15, {
      role: claims.role ?? "owner",
      grantId: claims.grantId,
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/checkout",
      maxAge: BROWSER_SESSION_SECONDS,
    }
  );
  return response;
}
