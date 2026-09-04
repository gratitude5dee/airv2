/**
 * V11 CR9: Functions never learn who the owner is. The identity a user
 * Worker sees is an app-scoped pseudonym — HMAC over (user_id, app_id) under
 * the app-origin key — so two apps by the same publisher cannot correlate a
 * visitor, and no header ever carries a uuid, phone, email, wallet, or
 * username. Anonymous visitors get a daily-rotating hash of their address.
 */
import { createHash, createHmac } from "node:crypto";
import { env } from "../env";

export type Principal = `p_${string}` | `anon:${string}`;

export function appPrincipal(userId: string, appId: string): Principal {
  const key = env.appOriginSigningKey() ?? env.miniappSigningKey();
  const mac = createHmac("sha256", key)
    .update(`${appId}\n${userId}`)
    .digest("hex")
    .slice(0, 32);
  return `p_${mac}`;
}

export function anonPrincipal(
  ip: string,
  appId: string,
  day = new Date().toISOString().slice(0, 10)
): Principal {
  const digest = createHash("sha256")
    .update(`${appId}\n${day}\n${ip}`)
    .digest("hex")
    .slice(0, 16);
  return `anon:${digest}`;
}

/** Header names the Dispatcher sets (and strips inbound) on `/api/*`. */
export const IDENTITY_HEADERS = {
  app: "X-Air-App",
  principal: "X-Air-Principal",
  role: "X-Air-Role",
  resource: "X-Air-Resource",
  version: "X-Air-Version",
} as const;
