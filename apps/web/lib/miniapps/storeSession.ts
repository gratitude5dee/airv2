/**
 * MA0 store session: a mini-origin-only login for the store home, detail
 * pages, and POST /api/mini/launch. It reuses the mini-app HMAC token format
 * under the reserved pseudo-app "__store" — never the main app's air_session
 * cookie (the origins share no session state, C15/MA1).
 *
 * Two mints:
 *  - handoff: /home calls POST /api/mini/link {target:"store"} and gets a
 *    single-use tokened URL on the mini origin (redeemed at /login?t=…).
 *  - direct: thirdweb SMS OTP at mini.wzrd.tech/login (POST /api/mini/login).
 */
import type { NextRequest } from "next/server";
import { mintToken, verifyToken } from "./tokens";

/** Reserved pseudo-app for store sessions; never a registry slug. */
export const STORE_APP = "__store";
export const STORE_COOKIE = "mini_store";
export const STORE_SESSION_TTL_MINUTES = 7 * 24 * 60;

export function mintStoreHandoffToken(userId: string): string {
  return mintToken(userId, STORE_APP, "store", 10);
}

export function mintStoreSessionToken(userId: string): string {
  return mintToken(userId, STORE_APP, "store", STORE_SESSION_TTL_MINUTES);
}

export function storeSessionUserId(request: NextRequest): string | null {
  const raw = request.cookies.get(STORE_COOKIE)?.value;
  if (!raw) return null;
  return verifyToken(raw, STORE_APP)?.userId ?? null;
}

export function storeCookieOptions(): {
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: STORE_SESSION_TTL_MINUTES * 60,
  };
}
