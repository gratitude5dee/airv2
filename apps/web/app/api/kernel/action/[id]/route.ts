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
  verifyToken,
} from "@/lib/miniapps/tokens";
import { redeemKernelAction } from "@/lib/kernel/actions";
import { ACTION_LABELS } from "@/lib/kernel/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (!claims || claims.resourceId !== id) {
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
  const action = await redeemKernelAction(supabase, claims.userId, id);
  if (!action) {
    return NextResponse.json(
      { error: "This payment step is no longer available." },
      { status: 410, headers: baseHeaders() }
    );
  }
  return NextResponse.json(
    { ok: true, url: action.url },
    {
      headers: {
        ...baseHeaders(),
        "Referrer-Policy": "no-referrer",
      },
    }
  );
}

/** Label text for the presenter page (surfaced for future rich variants). */
export function actionLabel(name: string): string {
  return ACTION_LABELS[name] ?? "finish a payment step";
}
