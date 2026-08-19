/**
 * MA2.4 WZRD.Tech plugin device-code sign-in. A plugin (Codex / Claude Code)
 * POSTs /api/plugin/auth/start → {user_code, verification_uri, device_code};
 * the owner approves the user_code in Settings (owner session only — a tier-2
 * sender can never cause an approval); the plugin polls
 * /api/plugin/auth/token until a scoped bearer is minted (plugin_tokens row,
 * HMAC-hashed at rest, revocable from Settings with immediate effect).
 */
import { createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

export const DEVICE_CODE_TTL_MINUTES = 10;
export const POLL_INTERVAL_SECONDS = 5;

/** Unambiguous alphabet for the human-typed user code (no 0/O/1/I). */
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function hash(value: string): string {
  return createHmac("sha256", env.pluginTokenSigningKey())
    .update(value)
    .digest("base64url");
}

export function hashPluginToken(token: string): string {
  return hash(`plugin-token:${token}`);
}

function hashDeviceCode(deviceCode: string): string {
  return hash(`device-code:${deviceCode}`);
}

function makeUserCode(): string {
  const chars: string[] = [];
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    chars.push(
      USER_CODE_ALPHABET.charAt(bytes.readUInt8(i) % USER_CODE_ALPHABET.length)
    );
    if (i === 3) chars.push("-");
  }
  return chars.join("");
}

export interface DeviceAuthStart {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

const KNOWN_TOOLS = new Set(["codex", "claude-code", "other"]);

export function normalizeTool(tool: string): string | null {
  const cleaned = tool.trim().toLowerCase();
  return KNOWN_TOOLS.has(cleaned) ? cleaned : null;
}

export async function startDeviceAuth(
  supabase: SupabaseClient,
  tool: string,
  verificationUri: string
): Promise<DeviceAuthStart> {
  const deviceCode = randomBytes(32).toString("base64url");
  const userCode = makeUserCode();
  const { error } = await supabase.from("plugin_device_codes").insert({
    device_code_hash: hashDeviceCode(deviceCode),
    user_code: userCode,
    tool,
    expires_at: new Date(
      Date.now() + DEVICE_CODE_TTL_MINUTES * 60_000
    ).toISOString(),
  });
  if (error) throw new Error(`device auth start failed: ${error.message}`);
  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    expires_in: DEVICE_CODE_TTL_MINUTES * 60,
    interval: POLL_INTERVAL_SECONDS,
  };
}

interface DeviceCodeRow {
  id: string;
  tool: string;
  status: "pending" | "approved" | "denied" | "consumed";
  user_id: string | null;
  expires_at: string;
}

/** Owner approval from Settings. Returns the requesting tool, or null. */
export async function approveDeviceCode(
  supabase: SupabaseClient,
  userCode: string,
  userId: string,
  decision: "approved" | "denied"
): Promise<string | null> {
  const { data, error } = await supabase
    .from("plugin_device_codes")
    .update({
      status: decision,
      user_id: decision === "approved" ? userId : null,
      approved_at: new Date().toISOString(),
    })
    .eq("user_code", userCode.trim().toUpperCase())
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("tool");
  if (error || !data || data.length === 0) return null;
  return (data[0] as { tool: string }).tool;
}

export type TokenPollResult =
  | { status: "authorization_pending" | "access_denied" | "expired_token" }
  | { status: "ok"; token: string; tool: string };

/**
 * Poll for the bearer. An approved code is consumed exactly once — the
 * conditional update is the single-use guard; a second poll after mint
 * gets expired_token.
 */
export async function pollDeviceToken(
  supabase: SupabaseClient,
  deviceCode: string
): Promise<TokenPollResult> {
  const { data, error } = await supabase
    .from("plugin_device_codes")
    .select("id, tool, status, user_id, expires_at")
    .eq("device_code_hash", hashDeviceCode(deviceCode))
    .maybeSingle();
  if (error || !data) return { status: "expired_token" };
  const row = data as DeviceCodeRow;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { status: "expired_token" };
  }
  if (row.status === "pending") return { status: "authorization_pending" };
  if (row.status === "denied") return { status: "access_denied" };
  if (row.status === "consumed") return { status: "expired_token" };
  if (!row.user_id) return { status: "access_denied" };

  const consumed = await supabase
    .from("plugin_device_codes")
    .update({ status: "consumed" })
    .eq("id", row.id)
    .eq("status", "approved")
    .select("id");
  if (consumed.error || !consumed.data || consumed.data.length === 0) {
    return { status: "expired_token" };
  }

  const token = `wzrd_plugin_${randomBytes(32).toString("base64url")}`;
  const { error: insertError } = await supabase.from("plugin_tokens").insert({
    user_id: row.user_id,
    tool: row.tool,
    token_hash: hashPluginToken(token),
  });
  if (insertError) {
    throw new Error(`plugin token mint failed: ${insertError.message}`);
  }
  console.log(
    JSON.stringify({ msg: "plugin token minted", user_id: row.user_id, tool: row.tool })
  );
  return { status: "ok", token, tool: row.tool };
}

export interface PluginPrincipal {
  userId: string;
  tokenId: string;
  tool: string;
}

/** Bearer → principal; revoked or unknown tokens are rejected immediately. */
export async function verifyPluginToken(
  supabase: SupabaseClient,
  bearer: string
): Promise<PluginPrincipal | null> {
  if (!bearer.startsWith("wzrd_plugin_")) return null;
  const { data, error } = await supabase
    .from("plugin_tokens")
    .select("id, user_id, tool, revoked_at")
    .eq("token_hash", hashPluginToken(bearer))
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    user_id: string;
    tool: string;
    revoked_at: string | null;
  };
  if (row.revoked_at) return null;
  await supabase
    .from("plugin_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);
  return { userId: row.user_id, tokenId: row.id, tool: row.tool };
}

export interface PluginTokenSummary {
  id: string;
  tool: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export async function listPluginTokens(
  supabase: SupabaseClient,
  userId: string
): Promise<PluginTokenSummary[]> {
  const { data, error } = await supabase
    .from("plugin_tokens")
    .select("id, tool, created_at, last_used_at, revoked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as PluginTokenSummary[];
}

/** Owner-only revoke; scoped to the owner's own rows. */
export async function revokePluginToken(
  supabase: SupabaseClient,
  userId: string,
  tokenId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("plugin_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id");
  return !error && !!data && data.length > 0;
}
