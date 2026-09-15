/**
 * Token-free continuation for Kernel bearer URLs. The fragment capability
 * was exchanged for an HttpOnly, path-scoped session by the parent route;
 * this endpoint consumes the staged row and performs the only redirect that
 * ever contains the provider URL. Browser JavaScript never receives it.
 */
import { NextRequest, NextResponse } from "next/server";
import { redeemKernelAction } from "@/lib/kernel/actions";
import { baseHeaders } from "@/lib/miniapps/html";
import { verifyToken } from "@/lib/miniapps/tokens";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_COOKIE = "air_kernel_action";

function failure(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { ...baseHeaders(), "Referrer-Policy": "no-referrer" } }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const token = request.cookies.get(ACTION_COOKIE)?.value ?? "";
  const claims = verifyToken(token, "kernel-action-session");
  if (!claims || claims.resourceId !== id || claims.role !== "owner") {
    return failure("This payment step is invalid or expired.", 403);
  }
  const action = await redeemKernelAction(serviceClient(), claims.userId, id);
  if (!action) {
    return failure("This payment step is no longer available.", 410);
  }
  const response = NextResponse.redirect(action.url, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.cookies.set(ACTION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: request.nextUrl.pathname,
    maxAge: 0,
  });
  return response;
}
