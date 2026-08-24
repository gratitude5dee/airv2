/**
 * Buzz community binding (buzz.goal.md §MA-Z2). The community is a relay URL
 * plus an identity, and identity is a keypair the control plane must never
 * hold: binding therefore mirrors Berd's device-code shape. The owner names
 * the relay and the signer (their own Box, where the agent already holds
 * `BUZZ_PRIVATE_KEY` as env, or Buzz Desktop), a single-use hashed code is
 * minted, and the *signer side* completes the exchange outbound with its
 * public identity (npub). Private material never appears in a form, a URL,
 * a log line, or Postgres (C18) — the control plane learns only
 * (relay, npub, signer kind, status), which is exactly C4's routing tier.
 *
 * NIP-98 proof-of-key over the exchange lands with the intent lane
 * (§MA-Z3), where the same signer signs each command envelope; until then
 * the pairing code — owner-minted, short-lived, single-use — is the
 * exchange credential.
 */
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuzzSignerKind } from "./state";

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

export function hashBindingCode(code: string): string {
  return sha256(code.trim().toUpperCase());
}

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|127\.\d+\.\d+\.\d+|0\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?)$/i;

/**
 * C5: the relay is an outbound host and must be an explicit, public,
 * TLS-only endpoint. Loopback, RFC1918, link-local, and mDNS names are
 * refused — a hostile document or prompt-injected agent must not be able to
 * point this lane at the control plane's own network.
 */
export function validateRelayUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 200) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "wss:") return null;
  if (url.username || url.password) return null;
  if (PRIVATE_HOST.test(url.hostname)) return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

const NPUB = /^npub1[a-z0-9]{20,80}$/;

export interface BuzzLiveLink {
  status: "unbound" | "pending" | "connected" | "revoked";
  relayUrl: string | null;
  communityLabel: string | null;
  npub: string | null;
  signerKind: BuzzSignerKind | null;
  lastSeenAt: string | null;
  pendingExpiresAt: string | null;
}

export async function beginBuzzBinding(
  supabase: SupabaseClient,
  userId: string,
  relayUrl: string,
  signerKind: "box" | "desktop"
): Promise<{ code: string; expiresAt: string }> {
  await supabase
    .from("buzz_pairing_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { error } = await supabase.from("buzz_pairing_codes").insert({
    user_id: userId,
    code_hash: hashBindingCode(code),
    relay_url: relayUrl,
    signer_kind: signerKind,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`buzz binding code insert: ${error.message}`);
  return { code, expiresAt };
}

export async function cancelBuzzBinding(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from("buzz_pairing_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);
}

export async function disconnectBuzz(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from("buzz_links")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "connected");
  await cancelBuzzBinding(supabase, userId);
}

export async function buzzLiveLink(
  supabase: SupabaseClient,
  userId: string
): Promise<BuzzLiveLink> {
  const { data: connected } = await supabase
    .from("buzz_links")
    .select("relay_url, community_label, npub, signer_kind, last_seen_at")
    .eq("user_id", userId)
    .eq("status", "connected")
    .order("paired_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (connected) {
    return {
      status: "connected",
      relayUrl: (connected.relay_url as string | null) ?? null,
      communityLabel: (connected.community_label as string | null) ?? null,
      npub: (connected.npub as string | null) ?? null,
      signerKind: (connected.signer_kind as BuzzSignerKind | null) ?? null,
      lastSeenAt: (connected.last_seen_at as string | null) ?? null,
      pendingExpiresAt: null,
    };
  }
  const { data: pending } = await supabase
    .from("buzz_pairing_codes")
    .select("relay_url, signer_kind, expires_at")
    .eq("user_id", userId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (pending) {
    return {
      status: "pending",
      relayUrl: (pending.relay_url as string | null) ?? null,
      communityLabel: null,
      npub: null,
      signerKind: (pending.signer_kind as BuzzSignerKind | null) ?? null,
      lastSeenAt: null,
      pendingExpiresAt: (pending.expires_at as string | null) ?? null,
    };
  }
  const { data: revoked } = await supabase
    .from("buzz_links")
    .select("revoked_at")
    .eq("user_id", userId)
    .eq("status", "revoked")
    .limit(1)
    .maybeSingle();
  return {
    status: revoked ? "revoked" : "unbound",
    relayUrl: null,
    communityLabel: null,
    npub: null,
    signerKind: null,
    lastSeenAt: null,
    pendingExpiresAt: null,
  };
}

export type BuzzExchangeResult =
  | { ok: true; token: string; relayUrl: string }
  | { ok: false; error: string };

/**
 * The exchange the signer side calls (the Box agent running `buzz`, or Buzz
 * Desktop). It presents the code and its public identity; it receives a
 * revocable link token for the intent lane (§MA-Z3). Replays lose the
 * conditional claim; the private key stays wherever the signer keeps it.
 */
export async function exchangeBuzzBindingCode(
  supabase: SupabaseClient,
  input: { code: string; npub: string; communityLabel: string | null }
): Promise<BuzzExchangeResult> {
  const code = input.code.trim();
  if (code.length < 6 || code.length > 16) {
    return { ok: false, error: "invalid code" };
  }
  if (!NPUB.test(input.npub.trim())) {
    return { ok: false, error: "invalid npub" };
  }
  const { data: row } = await supabase
    .from("buzz_pairing_codes")
    .select("id, user_id, relay_url, signer_kind, expires_at, used_at")
    .eq("code_hash", hashBindingCode(code))
    .maybeSingle();
  if (!row) return { ok: false, error: "unknown code" };
  if (row.used_at) return { ok: false, error: "code already used" };
  if (Date.parse(row.expires_at as string) <= Date.now()) {
    return { ok: false, error: "code expired" };
  }
  const { data: claimed } = await supabase
    .from("buzz_pairing_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id");
  if (!claimed?.length) return { ok: false, error: "code already used" };
  await supabase
    .from("buzz_links")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("user_id", row.user_id)
    .eq("status", "connected");
  const token = `buzz_${randomBytes(32).toString("hex")}`;
  const communityLabel = input.communityLabel?.trim().slice(0, 120) || null;
  const { error } = await supabase.from("buzz_links").insert({
    user_id: row.user_id,
    relay_url: row.relay_url,
    community_label: communityLabel,
    npub: input.npub.trim(),
    signer_kind: row.signer_kind,
    token_hash: sha256(token),
  });
  if (error) return { ok: false, error: "binding failed" };
  return { ok: true, token, relayUrl: row.relay_url as string };
}

export async function buzzHeartbeat(
  supabase: SupabaseClient,
  token: string
): Promise<boolean> {
  if (!token.startsWith("buzz_")) return false;
  const { data } = await supabase
    .from("buzz_links")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token_hash", sha256(token))
    .eq("status", "connected")
    .select("id");
  return Boolean(data?.length);
}
