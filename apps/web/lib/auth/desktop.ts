/**
 * Desktop surface credentials (§7.4 Tier 1). The desktop app is a remote
 * gateway client of *our* control plane, never of the box: it authenticates
 * here, and every box URL, `_port_auth` token and API_SERVER_KEY stays on the
 * server (C3/C16).
 *
 * Two credentials, both HMAC-signed and scoped:
 *
 *  - a **pairing token**, minted only inside an owner-authenticated web
 *    session (same shape as the mini-app link mint) and redeemable exactly
 *    once, whose redemption creates the `desktop_devices` row;
 *  - a **device token**, short-lived and bound to that row, which the desktop
 *    presents as `Authorization: Bearer` on the relay and SSE routes and
 *    refreshes before expiry.
 *
 * Revoking the device row invalidates every token issued to it without
 * rotating the signing key.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

export const PAIRING_TTL_SECONDS = 10 * 60;
export const DEVICE_TOKEN_TTL_SECONDS = 12 * 60 * 60;

interface PairingClaims {
  typ: "desktop-pair";
  userId: string;
  jti: string;
  exp: number;
}

interface DeviceClaims {
  typ: "desktop";
  userId: string;
  deviceId: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env.desktopSigningKey())
    .update(payload)
    .digest("base64url");
}

function encode(claims: PairingClaims | DeviceClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode<T>(token: string): T | undefined {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return undefined;
  const payload = token.slice(0, dot);
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(token.slice(dot + 1));
  if (expected.length !== actual.length) return undefined;
  if (!timingSafeEqual(expected, actual)) return undefined;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return undefined;
  }
}

function expired(exp: number | undefined): boolean {
  return !exp || exp < Math.floor(Date.now() / 1000);
}

export function mintPairingToken(userId: string): {
  token: string;
  expiresIn: number;
} {
  const claims: PairingClaims = {
    typ: "desktop-pair",
    userId,
    jti: randomBytes(12).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + PAIRING_TTL_SECONDS,
  };
  console.log(
    JSON.stringify({
      msg: "desktop pairing token minted",
      user_id: userId,
      jti: claims.jti,
    })
  );
  return { token: encode(claims), expiresIn: PAIRING_TTL_SECONDS };
}

export function verifyPairingToken(
  token: string
): { userId: string; jti: string } | undefined {
  const claims = decode<PairingClaims>(token);
  if (!claims || claims.typ !== "desktop-pair") return undefined;
  if (!claims.userId || !claims.jti) return undefined;
  if (expired(claims.exp)) return undefined;
  return { userId: claims.userId, jti: claims.jti };
}

export function mintDeviceToken(
  userId: string,
  deviceId: string
): { token: string; expiresIn: number } {
  const claims: DeviceClaims = {
    typ: "desktop",
    userId,
    deviceId,
    exp: Math.floor(Date.now() / 1000) + DEVICE_TOKEN_TTL_SECONDS,
  };
  return { token: encode(claims), expiresIn: DEVICE_TOKEN_TTL_SECONDS };
}

export function verifyDeviceToken(
  token: string
): { userId: string; deviceId: string } | undefined {
  const claims = decode<DeviceClaims>(token);
  if (!claims || claims.typ !== "desktop") return undefined;
  if (!claims.userId || !claims.deviceId) return undefined;
  if (expired(claims.exp)) return undefined;
  return { userId: claims.userId, deviceId: claims.deviceId };
}

export function bearerToken(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1];
}

/**
 * Redeem a pairing token: the unique constraint on `pairing_jti` makes the
 * first insert win, so a replayed token pairs nothing.
 */
export async function pairDevice(
  supabase: SupabaseClient,
  token: string,
  label: string | undefined
): Promise<{ userId: string; deviceId: string } | undefined> {
  const claims = verifyPairingToken(token);
  if (!claims) return undefined;
  const { data, error } = await supabase
    .from("desktop_devices")
    .insert({
      user_id: claims.userId,
      pairing_jti: claims.jti,
      label: label?.slice(0, 120) ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    // 23505: already redeemed. 23503: the user was deleted after the mint.
    if (error.code === "23505" || error.code === "23503") return undefined;
    throw new Error(`desktop pairing failed: ${error.message}`);
  }
  const deviceId = (data as { id: string }).id;
  console.log(
    JSON.stringify({
      msg: "desktop device paired",
      user_id: claims.userId,
      device_id: deviceId,
    })
  );
  return { userId: claims.userId, deviceId };
}

/**
 * Authenticate a desktop request. The signature proves the token is ours; the
 * device row proves it has not been revoked (and the user still has an
 * account), so a stolen token dies as soon as the owner unpairs.
 */
export async function desktopSession(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<{ userId: string; deviceId: string } | undefined> {
  const token = bearerToken(request);
  if (!token) return undefined;
  const claims = verifyDeviceToken(token);
  if (!claims) return undefined;
  const { data } = await supabase
    .from("desktop_devices")
    .select("id, user_id, revoked_at")
    .eq("id", claims.deviceId)
    .maybeSingle();
  const row = data as
    | { id: string; user_id: string; revoked_at: string | null }
    | null;
  if (!row || row.revoked_at || row.user_id !== claims.userId) return undefined;
  void supabase
    .from("desktop_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => undefined);
  return { userId: claims.userId, deviceId: claims.deviceId };
}
