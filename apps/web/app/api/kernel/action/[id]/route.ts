/**
 * Kernel provider-action presenter. Payment ceremonies (Link OAuth, card
 * enrollment, spend approval) are provider-hosted URLs — bearer credentials
 * that must never sit in a request path, access log, preview fetch, or the
 * agent's context (C27).
 *
 * The iMessage card carries the presenter URL with the token in `#t=`
 * (fragments never reach Vercel or unfurlers). The page's script POSTs the
 * token once; we verify it, claim the single-use row, and hand back the
 * sealed provider URL for client-side navigation. Same shape as
 * /api/mini/checkout-launch.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { baseHeaders, page } from "@/lib/miniapps/html";
import {
  consumeRedemptionOnce,
  mintToken,
  verifyToken,
} from "@/lib/miniapps/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ACTION_COOKIE = "air_kernel_action";
const ACTION_SESSION_SECONDS = 60;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const body = page(
    "Continue to payment setup",
    `<h1>Opening…</h1><div class="card" data-kernel-action>Preparing a secure payment step.</div><script src="/creator-os/kernel-action.js" data-action-id="${encodeURIComponent(id)}" defer></script>`
  );
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...baseHeaders(),
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `${baseHeaders()["Content-Security-Policy"]}; script-src 'self'`,
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { token?: unknown }
    | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const claims = verifyToken(token, "kernel-action");
  if (!claims || claims.resourceId !== id || claims.role !== "owner") {
    return NextResponse.json(
      { error: "This link is invalid or expired." },
      { status: 403, headers: baseHeaders() }
    );
  }
  const supabase = serviceClient();
  // Single-use capability: consume the jti before any URL leaves this
  // boundary, and require the staged row to be unused + unexpired.
  if (!(await consumeRedemptionOnce(supabase, claims))) {
    return NextResponse.json(
      { error: "This link was already used. Ask Air for a fresh one." },
      { status: 409, headers: baseHeaders() }
    );
  }
  const next = `/api/kernel/action/${encodeURIComponent(id)}/continue`;
  const response = NextResponse.json(
    { ok: true, next },
    { headers: { ...baseHeaders(), "Referrer-Policy": "no-referrer" } }
  );
  response.cookies.set(
    ACTION_COOKIE,
    mintToken(claims.userId, "kernel-action-session", id, 1, {
      role: "owner",
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: next,
      maxAge: ACTION_SESSION_SECONDS,
    }
  );
  return response;
}
