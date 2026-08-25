/**
 * Shared command lane for the Berd and Buzz mini-apps (berd.goal.md §MA-B3,
 * buzz.goal.md §MA-Z3). One shape, two apps: the owner's action mints a
 * short-lived, single-use envelope; the paired signer (desktop or Box-hosted)
 * pulls it outbound with its bearer token and posts the JSON result, which
 * the caller merges into the box-side document. Nothing ever dials the
 * device.
 *
 * Two custody rules shape the storage:
 * - Envelope args can carry content (a system prompt, a message body), which
 *   does not belong in Postgres (C4). Args are sealed at rest with a key
 *   derived from SESSION_SECRET and nulled the moment the device claims the
 *   envelope; the ledger keeps only group/verb names, states, and times.
 * - The device must be able to tell a real envelope from a forged one. At
 *   pairing time each link gets a random envelope key: the device holds the
 *   plaintext, this side holds it sealed. Every envelope carries an
 *   HMAC-SHA256 over its canonical fields under that per-device key.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { openSecret, sealSecret } from "@/lib/crypto/secretbox";
import { asRecord } from "@/lib/records";

/** How long a minted envelope stays claimable before it fails as expired. */
const ENVELOPE_TTL_MS = 120 * 1000;
/** Backpressure: an owner cannot stack unclaimed work without bound. */
const MAX_OPEN_ENVELOPES = 30;
/** One claim returns at most this many envelopes. */
const CLAIM_BATCH = 10;
/** Serialized args are bounded before sealing (C9: hostile input is sized). */
const MAX_ARGS_BYTES = 16 * 1024;

export interface LaneConfig {
  /** Envelope ledger table (`berd_envelopes` / `buzz_intents`). */
  table: string;
  /** Link table holding the sealed per-device envelope key. */
  linkTable: string;
  /** Column naming the verb (`action` for Berd, `verb` for Buzz). */
  verbColumn: "action" | "verb";
}

export const BERD_LANE: LaneConfig = {
  table: "berd_envelopes",
  linkTable: "berd_links",
  verbColumn: "action",
};

export const BUZZ_LANE: LaneConfig = {
  table: "buzz_intents",
  linkTable: "buzz_links",
  verbColumn: "verb",
};

/** AES key for sealing args + envelope keys at rest, derived so no new
 * deploy config is needed; set COMMAND_LANE_KEY (64 hex chars) to rotate
 * it independently of web sessions. */
function laneSealKey(): string {
  return (
    process.env.COMMAND_LANE_KEY ??
    createHash("sha256").update(env.sessionSecret()).digest("hex")
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function mintEnvelopeKey(): string {
  return randomBytes(32).toString("hex");
}

export function sealEnvelopeKey(plaintext: string): string {
  return sealSecret(plaintext, laneSealKey());
}

/** The wire shape the signer receives. `sig` covers every other field. */
export interface WireEnvelope {
  id: string;
  group: string;
  verb: string;
  args: unknown;
  issuedAt: string;
  expiresAt: string;
  singleUse: true;
  sig: string;
}

export function signEnvelope(
  envelopeKey: string,
  fields: Omit<WireEnvelope, "sig">
): string {
  const canonical = [
    fields.id,
    fields.group,
    fields.verb,
    fields.issuedAt,
    fields.expiresAt,
    JSON.stringify(fields.args ?? null),
  ].join("\n");
  return createHmac("sha256", Buffer.from(envelopeKey, "hex"))
    .update(canonical)
    .digest("hex");
}

export type EnqueueResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function enqueueEnvelope(
  supabase: SupabaseClient,
  lane: LaneConfig,
  userId: string,
  resourceId: string,
  group: string,
  verb: string,
  args: unknown
): Promise<EnqueueResult> {
  const serialized = JSON.stringify(args ?? null);
  if (Buffer.byteLength(serialized, "utf8") > MAX_ARGS_BYTES) {
    return { ok: false, error: "arguments too large" };
  }
  const { count } = await supabase
    .from(lane.table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("state", ["queued", "sent"]);
  if ((count ?? 0) >= MAX_OPEN_ENVELOPES) {
    return { ok: false, error: "too many operations in flight — wait for the device to catch up" };
  }
  const expiresAt = new Date(Date.now() + ENVELOPE_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from(lane.table)
    .insert({
      user_id: userId,
      resource_id: resourceId,
      cmd_group: group,
      [lane.verbColumn]: verb,
      args_sealed: sealSecret(serialized, laneSealKey()),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "could not queue the operation" };
  return { ok: true, id: data.id as string };
}

interface LinkRow {
  id: string;
  user_id: string;
  envelope_key_sealed: string | null;
}

/** Bearer token → link row, or null. The token is only ever compared by
 * hash; a revoked link fails here, which is how Disconnect takes effect. */
export async function laneLink(
  supabase: SupabaseClient,
  lane: LaneConfig,
  token: string,
  tokenPrefix: string,
  connectedStatus: string
): Promise<LinkRow | null> {
  if (!token.startsWith(tokenPrefix)) return null;
  const { data } = await supabase
    .from(lane.linkTable)
    .select("id, user_id, envelope_key_sealed")
    .eq("token_hash", sha256(token))
    .eq("status", connectedStatus)
    .maybeSingle();
  return (data as LinkRow | null) ?? null;
}

/**
 * The outbound pull. Expired queued envelopes fail first (their pending
 * entries are reconciled by the caller); live ones are claimed one at a time
 * with a conditional update so a racing second poller cannot double-claim,
 * and args are nulled in the same statement — after this moment the ledger
 * row carries names and states only.
 */
export async function claimEnvelopes(
  supabase: SupabaseClient,
  lane: LaneConfig,
  link: LinkRow
): Promise<{
  envelopes: WireEnvelope[];
  expiredIds: { id: string; resourceId: string }[];
}> {
  const nowIso = new Date().toISOString();
  const { data: expired } = await supabase
    .from(lane.table)
    .update({
      state: "failed",
      note: "expired before the device claimed it",
      args_sealed: null,
      completed_at: nowIso,
    })
    .eq("user_id", link.user_id)
    .eq("state", "queued")
    .lte("expires_at", nowIso)
    .select("id, resource_id");
  const expiredIds = (expired ?? []).map((row) => ({
    id: row.id as string,
    resourceId: row.resource_id as string,
  }));

  if (!link.envelope_key_sealed) return { envelopes: [], expiredIds };
  const envelopeKey = openSecret(link.envelope_key_sealed, laneSealKey());

  const { data: queued } = await supabase
    .from(lane.table)
    .select(`id, cmd_group, ${lane.verbColumn}, args_sealed, issued_at, expires_at`)
    .eq("user_id", link.user_id)
    .eq("state", "queued")
    .gt("expires_at", nowIso)
    .order("issued_at", { ascending: true })
    .limit(CLAIM_BATCH);

  const envelopes: WireEnvelope[] = [];
  for (const raw of queued ?? []) {
    const row = asRecord(raw) ?? {};
    // Decrypt before the claiming update nulls the ciphertext.
    let args: unknown = null;
    if (typeof row.args_sealed === "string") {
      try {
        args = JSON.parse(openSecret(row.args_sealed, laneSealKey()));
      } catch {
        args = null;
      }
    }
    const { data: claimed } = await supabase
      .from(lane.table)
      .update({ state: "sent", sent_at: nowIso, args_sealed: null })
      .eq("id", row.id as string)
      .eq("state", "queued")
      .select("id");
    if (!claimed?.length) continue;
    const fields = {
      id: row.id as string,
      group: row.cmd_group as string,
      verb: row[lane.verbColumn] as string,
      args,
      issuedAt: row.issued_at as string,
      expiresAt: row.expires_at as string,
      singleUse: true as const,
    };
    envelopes.push({ ...fields, sig: signEnvelope(envelopeKey, fields) });
  }
  return { envelopes, expiredIds };
}

export interface CompletedEnvelope {
  id: string;
  resourceId: string;
  group: string;
  verb: string;
}

/** Mark a sent envelope done/failed. Returns the row's names so the caller
 * can reconcile the box document's pending entry; null if the envelope is
 * not this user's or not awaiting a result (replays land here). */
export async function completeEnvelope(
  supabase: SupabaseClient,
  lane: LaneConfig,
  link: LinkRow,
  envelopeId: string,
  ok: boolean,
  note: string | null
): Promise<CompletedEnvelope | null> {
  const { data } = await supabase
    .from(lane.table)
    .update({
      state: ok ? "done" : "failed",
      completed_at: new Date().toISOString(),
      note,
    })
    .eq("id", envelopeId)
    .eq("user_id", link.user_id)
    .eq("state", "sent")
    .select(`id, resource_id, cmd_group, ${lane.verbColumn}`);
  const row = asRecord((data ?? [])[0]);
  if (!row) return null;
  return {
    id: row.id as string,
    resourceId: row.resource_id as string,
    group: row.cmd_group as string,
    verb: row[lane.verbColumn] as string,
  };
}
