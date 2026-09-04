/**
 * V11 CR9: Functions never learn who the owner is. The identity a user
 * Worker sees is an app-scoped pseudonym — HMAC over (user_id, app_id) under
 * the app-origin key — so two apps by the same publisher cannot correlate a
 * visitor, and no header ever carries a uuid, phone, email, wallet, or
 * username. Anonymous visitors get a daily-rotating hash of their address.
 */
import { createHmac } from "node:crypto";
import { env } from "../env";

export type Principal = `p_${string}` | `g_${string}` | `anon:${string}`;

function mac(...parts: string[]): string {
  const key = env.appOriginSigningKey() ?? env.miniappSigningKey();
  return createHmac("sha256", key).update(parts.join("\n")).digest("hex");
}

export function appPrincipal(userId: string, appId: string): Principal {
  return `p_${mac("user", appId, userId).slice(0, 32)}`;
}

/** A guest link's identity is the grant that admitted it, not its creator. */
export function guestPrincipal(grantId: string, appId: string): Principal {
  return `g_${mac("grant", appId, grantId).slice(0, 32)}`;
}

export function anonPrincipal(
  ip: string,
  appId: string,
  day = new Date().toISOString().slice(0, 10)
): Principal {
  return `anon:${mac("anon", appId, day, ip).slice(0, 16)}`;
}

/** Header names the Dispatcher sets (and strips inbound) on `/api/*`. */
export const IDENTITY_HEADERS = {
  app: "X-Air-App",
  principal: "X-Air-Principal",
  role: "X-Air-Role",
  resource: "X-Air-Resource",
  version: "X-Air-Version",
} as const;
