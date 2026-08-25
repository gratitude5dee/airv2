/**
 * iMessage history ingestion (onboarding "Context" step). The history file
 * lives ONLY on the user's box (C4): a short-TTL HMAC upload ticket — same
 * token discipline as fill tickets (lib/vault/tickets) with its own
 * domain-separating `use` claim — authorizes the extractor script running on
 * the owner's Mac to POST extracted chat.db rows to
 * /api/me/imessage-history, which writes them under
 * `.hermes/context/imessage-history/` in the box. Postgres never sees a
 * message byte; logs carry counts only.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "../box/client";
import { asRecord } from "../records";
import { deepMemoryIndex, OV_IMESSAGE_URI } from "../memory/deep";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { env } from "../env";

export const IMESSAGE_INGEST_USE = "imessage_ingest";
/** Long enough to run the extractor, short enough to bound exposure. */
export const INGEST_TTL_MINUTES = 30;
/** Cap one upload at 4 MB of JSON — the extractor chunks beyond that. */
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
export const MAX_MESSAGES_PER_CHUNK = 20_000;

const HISTORY_DIR = ".hermes/context/imessage-history";
const STATUS_PATH = `${HISTORY_DIR}/status.json`;

export interface IngestTicketClaims {
  use: typeof IMESSAGE_INGEST_USE;
  userId: string;
  jti: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env.miniappSigningKey())
    .update(payload)
    .digest("base64url");
}

export function mintIngestTicket(userId: string): string {
  const claims: IngestTicketClaims = {
    use: IMESSAGE_INGEST_USE,
    userId,
    jti: randomBytes(12).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + INGEST_TTL_MINUTES * 60,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  console.log(
    JSON.stringify({
      msg: "imessage ingest ticket minted",
      user_id: userId,
      jti: claims.jti,
    })
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyIngestTicket(token: string): IngestTicketClaims | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: IngestTicketClaims;
  try {
    claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as IngestTicketClaims;
  } catch {
    return null;
  }
  if (claims.use !== IMESSAGE_INGEST_USE) return null;
  if (!claims.userId || !claims.jti) return null;
  if (typeof claims.exp !== "number") return null;
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}

export interface IngestMessage {
  ts: string;
  chat: string;
  from: string;
  is_from_me: boolean;
  text: string;
}

export interface IngestChunk {
  messages: IngestMessage[];
  /** Extractor-reported range, echoed into the status document. */
  from_date?: string;
  to_date?: string;
}

export class IngestInputError extends Error {}

/** Strict shape validation — reject rather than coerce anything odd. */
export function parseChunk(raw: unknown): IngestChunk {
  if (typeof raw !== "object" || raw === null) {
    throw new IngestInputError("body must be a JSON object");
  }
  const doc = raw as {
    messages?: unknown;
    from_date?: unknown;
    to_date?: unknown;
  };
  if (!Array.isArray(doc.messages)) {
    throw new IngestInputError("messages must be an array");
  }
  if (doc.messages.length === 0) {
    throw new IngestInputError("messages is empty");
  }
  if (doc.messages.length > MAX_MESSAGES_PER_CHUNK) {
    throw new IngestInputError(
      `messages exceeds ${MAX_MESSAGES_PER_CHUNK} per upload`
    );
  }
  const messages: IngestMessage[] = [];
  for (const entry of doc.messages) {
    if (typeof entry !== "object" || entry === null) {
      throw new IngestInputError("each message must be an object");
    }
    const m = asRecord(entry) ?? {};
    if (
      typeof m.ts !== "string" ||
      typeof m.chat !== "string" ||
      typeof m.from !== "string" ||
      typeof m.is_from_me !== "boolean" ||
      typeof m.text !== "string"
    ) {
      throw new IngestInputError(
        "each message needs ts, chat, from, is_from_me, text"
      );
    }
    messages.push({
      ts: m.ts,
      chat: m.chat,
      from: m.from,
      is_from_me: m.is_from_me,
      text: m.text,
    });
  }
  return {
    messages,
    ...(typeof doc.from_date === "string" ? { from_date: doc.from_date } : {}),
    ...(typeof doc.to_date === "string" ? { to_date: doc.to_date } : {}),
  };
}

export interface IngestStatus {
  chunks: number;
  messages: number;
  last_upload_at: string | null;
  from_date: string | null;
  to_date: string | null;
}

function defaultStatus(): IngestStatus {
  return {
    chunks: 0,
    messages: 0,
    last_upload_at: null,
    from_date: null,
    to_date: null,
  };
}

function normalizeStatus(raw: unknown): IngestStatus {
  const status = defaultStatus();
  const doc = asRecord(raw);
  if (!doc) return status;
  if (typeof doc.chunks === "number") status.chunks = doc.chunks;
  if (typeof doc.messages === "number") status.messages = doc.messages;
  if (typeof doc.last_upload_at === "string") {
    status.last_upload_at = doc.last_upload_at;
  }
  if (typeof doc.from_date === "string") status.from_date = doc.from_date;
  if (typeof doc.to_date === "string") status.to_date = doc.to_date;
  return status;
}

export async function readIngestStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<IngestStatus> {
  const box = await ensureBoxAwake(supabase, userId);
  try {
    return normalizeStatus(JSON.parse(await readFile(box.boxId, STATUS_PATH)));
  } catch {
    return defaultStatus();
  }
}

/** Write one validated chunk into the box and bump the status document. */
export async function storeChunk(
  supabase: SupabaseClient,
  userId: string,
  chunk: IngestChunk
): Promise<IngestStatus> {
  const box = await ensureBoxAwake(supabase, userId);
  let status = defaultStatus();
  try {
    status = normalizeStatus(JSON.parse(await readFile(box.boxId, STATUS_PATH)));
  } catch {
    // first upload
  }
  const stamp = Date.now();
  const chunkPath = `${HISTORY_DIR}/chunk-${stamp}.json`;
  await writeFile(box.boxId, chunkPath, JSON.stringify(chunk.messages));
  status.chunks += 1;
  status.messages += chunk.messages.length;
  status.last_upload_at = new Date(stamp).toISOString();
  if (chunk.from_date) status.from_date = chunk.from_date;
  if (chunk.to_date) status.to_date = chunk.to_date;
  await writeFile(box.boxId, STATUS_PATH, JSON.stringify(status, null, 2));
  // Deep memory (docs/memory-upgrade.md): make the chunk semantically
  // searchable in the box-local OpenViking store. Runs after the durable
  // chunk + status writes and is best-effort — a slow or degraded
  // deep-memory layer never fails or double-counts an upload; `ovctl
  // reindex` re-adds the whole directory at its stable URI later.
  await deepMemoryIndex(
    box.boxId,
    chunkPath,
    `${OV_IMESSAGE_URI}/chunk-${stamp}`
  );
  console.log(
    JSON.stringify({
      msg: "imessage history chunk stored",
      user_id: userId,
      box_id: box.boxId,
      messages: chunk.messages.length,
      chunks_total: status.chunks,
    })
  );
  return status;
}
