/**
 * MA0 store-session handoff redemption (mini origin). /home mints a
 * single-use tokened URL via POST /api/mini/link {target:"store"}; this
 * route redeems it, sets the mini-origin store cookie, and redirects to the
 * store home with the token stripped from the URL (C15).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { redeemOnce, verifyToken } from "@/lib/miniapps/tokens";
import {
  STORE_APP,
  mintStoreSessionToken,
  STORE_COOKIE,
  storeCookieOptions,
} from "@/lib/miniapps/storeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const claims = verifyToken(token, STORE_APP);
  if (!claims) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
  }
  if (!(await redeemOnce(serviceClient(), claims))) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
  }
  const response = NextResponse.redirect(
    new URL("/", request.nextUrl.origin),
    303
  );
  response.cookies.set(
    STORE_COOKIE,
    mintStoreSessionToken(claims.userId),
    storeCookieOptions()
  );
  return response;
}
