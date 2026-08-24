/**
 * Berd pairing lifecycle (berd.goal.md §MA-B2). Nothing in Air can dial the
 * user's machine, so pairing is a device-code exchange the *Berd side*
 * completes outbound: the owner mints a short, single-use, hashed code here,
 * types it into Berd (desktop, or a self-hosted instance on their own Box —
 * §3.3), and Berd exchanges it for a long-lived revocable per-device token.
 * Postgres carries only this routing metadata (C4); the token is stored
 * hashed and the plaintext exists once, in the exchange response Berd stores
 * in its own secure storage. It never reaches a browser (C18).
 */
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mintEnvelopeKey, sealEnvelopeKey } from "../commandLane";

const CODE_TTL_MS = 10 * 60 * 1000;
/** Human-typable alphabet: no 0/O/1/I/L ambiguity. */
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

export function hashPairingCode(code: string): string {
  return sha256(code.trim().toUpperCase());
}

export interface BerdLiveLink {
  status: "unpaired" | "pending" | "paired" | "revoked";
  deviceLabel: string | null;
  protocolVersion: number | null;
  lastSeenAt: string | null;
  pendingExpiresAt: string | null;
}

export async function beginBerdPairing(
  supabase: SupabaseClient,
  userId: string
): Promise<{ code: string; expiresAt: string }> {
  // One live code per user: minting a new one voids the old.
  await supabase
    .from("berd_pairing_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const { error } = await supabase.from("berd_pairing_codes").insert({
    user_id: userId,
    code_hash: hashPairingCode(code),
    expires_at: expiresAt,
  });
  if (error) throw new Error(`berd pairing code insert: ${error.message}`);
  return { code, expiresAt };
}

export async function cancelBerdPairing(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from("berd_pairing_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);
}

export async function disconnectBerd(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("berd_links")
    .update({ status: "revoked", revoked_at: now })
    .eq("user_id", userId)
    .eq("status", "paired");
  await cancelBerdPairing(supabase, userId);
}

export async function berdLiveLink(
  supabase: SupabaseClient,
  userId: string
): Promise<BerdLiveLink> {
  const { data: paired } = await supabase
    .from("berd_links")
    .select("device_label, protocol_version, last_seen_at")
    .eq("user_id", userId)
    .eq("status", "paired")
    .order("paired_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (paired) {
    return {
      status: "paired",
      deviceLabel: (paired.device_label as string | null) ?? null,
      protocolVersion: (paired.protocol_version as number | null) ?? null,
      lastSeenAt: (paired.last_seen_at as string | null) ?? null,
      pendingExpiresAt: null,
    };
  }
  const { data: pending } = await supabase
    .from("berd_pairing_codes")
    .select("expires_at")
    .eq("user_id", userId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (pending) {
    return {
      status: "pending",
      deviceLabel: null,
      protocolVersion: null,
      lastSeenAt: null,
      pendingExpiresAt: (pending.expires_at as string | null) ?? null,
    };
  }
  const { data: revoked } = await supabase
    .from("berd_links")
    .select("revoked_at")
    .eq("user_id", userId)
    .eq("status", "revoked")
    .limit(1)
    .maybeSingle();
  return {
    status: revoked ? "revoked" : "unpaired",
    deviceLabel: null,
    protocolVersion: null,
    lastSeenAt: null,
    pendingExpiresAt: null,
  };
}

export type BerdExchangeResult =
  | { ok: true; token: string; envelopeKey: string }
  | { ok: false; error: string };

/**
 * The exchange Berd calls (outbound, from the desktop or the user's Box).
 * The code is the sole credential: unknown, expired, replayed, or cancelled
 * codes all fail closed with the same 403 at the route. Marking the code
 * used is conditional (`used_at is null`) so a raced replay loses.
 */
export async function exchangeBerdPairingCode(
  supabase: SupabaseClient,
  input: { code: string; deviceLabel: string; protocolVersion: number | null }
): Promise<BerdExchangeResult> {
  const code = input.code.trim();
  if (code.length < 6 || code.length > 16) {
    return { ok: false, error: "invalid code" };
  }
  const { data: row } = await supabase
    .from("berd_pairing_codes")
    .select("id, user_id, expires_at, used_at")
    .eq("code_hash", hashPairingCode(code))
    .maybeSingle();
  if (!row) return { ok: false, error: "unknown code" };
  if (row.used_at) return { ok: false, error: "code already used" };
  if (Date.parse(row.expires_at as string) <= Date.now()) {
    return { ok: false, error: "code expired" };
  }
  const { data: claimed } = await supabase
    .from("berd_pairing_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id");
  if (!claimed?.length) return { ok: false, error: "code already used" };
  // One paired device per user for now: a new pairing supersedes the old.
  await supabase
    .from("berd_links")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("user_id", row.user_id)
    .eq("status", "paired");
  const token = `berd_${randomBytes(32).toString("hex")}`;
  // §MA-B3: the per-device envelope key lets Berd verify each pulled
  // envelope really came from here. The device stores the plaintext in its
  // own secure storage; this side keeps it sealed only (C18).
  const envelopeKey = mintEnvelopeKey();
  const deviceLabel = input.deviceLabel.trim().slice(0, 80) || "Berd";
  const { error } = await supabase.from("berd_links").insert({
    user_id: row.user_id,
    device_label: deviceLabel,
    token_hash: sha256(token),
    protocol_version: input.protocolVersion,
    envelope_key_sealed: sealEnvelopeKey(envelopeKey),
  });
  if (error) return { ok: false, error: "pairing failed" };
  return { ok: true, token, envelopeKey };
}

/**
 * Heartbeat/validity check for a paired token. A revoked link fails here,
 * which is what makes `Disconnect` take effect on Berd's next contact.
 */
export async function berdHeartbeat(
  supabase: SupabaseClient,
  token: string
): Promise<boolean> {
  if (!token.startsWith("berd_")) return false;
  const { data } = await supabase
    .from("berd_links")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token_hash", sha256(token))
    .eq("status", "paired")
    .select("id");
  return Boolean(data?.length);
}
