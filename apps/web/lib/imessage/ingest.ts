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
import { BoxApiError, readFile } from "../box/client";
import { asRecord } from "../records";
import { withStateLease } from "../miniapps/stateLease";
import { migrateLegacyArchive } from "./archiveMigrateStore";
import { storeArchiveMessages } from "./archiveStore";
import { writeArchiveFile } from "./archiveWrite";
import { archivePartition } from "./archive";
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
  id?: string;
  chat_id?: string;
  ts: string;
  chat: string;
  from: string;
  is_from_me: boolean;
  text: string;
}

export interface IngestChunk {
  threads?: Array<{ id: string; label: string }>;
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
    threads?: unknown;
    messages?: unknown;
    from_date?: unknown;
    to_date?: unknown;
  };
  let threads: IngestChunk["threads"];
  if (doc.threads !== undefined) {
    if (!Array.isArray(doc.threads) || doc.threads.length > 20_000) {
      throw new IngestInputError("threads must be an array with at most 20000 entries");
    }
    threads = doc.threads.map((entry: unknown) => {
      const thread = asRecord(entry);
      if (!thread || typeof thread["id"] !== "string" || !thread["id"] || typeof thread["label"] !== "string") {
        throw new IngestInputError("each thread needs a nonempty id and a label");
      }
      return { id: thread["id"], label: thread["label"] };
    });
  }
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
      typeof m["ts"] !== "string" ||
      typeof m["chat"] !== "string" ||
      typeof m["from"] !== "string" ||
      typeof m["is_from_me"] !== "boolean" ||
      typeof m["text"] !== "string"
    ) {
      throw new IngestInputError(
        "each message needs ts, chat, from, is_from_me, text"
      );
    }
    const message: IngestMessage = {
      ...(typeof m["id"] === "string" && m["id"] ? { id: m["id"] } : {}),
      ...(typeof m["chat_id"] === "string" && m["chat_id"] ? { chat_id: m["chat_id"] } : {}),
      ts: m["ts"],
      chat: m["chat"],
      from: m["from"],
      is_from_me: m["is_from_me"],
      text: m["text"],
    };
    try { archivePartition(message); }
    catch { throw new IngestInputError("each message needs a valid timestamp and thread identity"); }
    messages.push(message);
  }
  return {
    messages,
    ...(threads ? { threads } : {}),
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

export function normalizeIngestStatus(raw: unknown): IngestStatus {
  const status = defaultStatus();
  const doc = asRecord(raw);
  if (!doc) return status;
  if (typeof doc["chunks"] === "number") status.chunks = doc["chunks"];
  if (typeof doc["messages"] === "number") status.messages = doc["messages"];
  if (typeof doc["last_upload_at"] === "string") {
    status.last_upload_at = doc["last_upload_at"];
  }
  if (typeof doc["from_date"] === "string") status.from_date = doc["from_date"];
  if (typeof doc["to_date"] === "string") status.to_date = doc["to_date"];
  return status;
}

export async function readIngestStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<IngestStatus> {
  const box = await ensureBoxAwake(supabase, userId);
  return readBoxIngestStatus(box.boxId);
}

async function readBoxIngestStatus(boxId: string): Promise<IngestStatus> {
  try {
    const raw: unknown = JSON.parse(await readFile(boxId, STATUS_PATH));
    const doc = asRecord(raw);
    if (!doc || !Number.isSafeInteger(doc["chunks"]) || Number(doc["chunks"]) < 0 ||
        !Number.isSafeInteger(doc["messages"]) || Number(doc["messages"]) < 0) {
      throw new Error("Invalid iMessage archive status");
    }
    return normalizeIngestStatus(doc);
  } catch (error) {
    if (error instanceof BoxApiError && error.status === 404) return defaultStatus();
    throw error;
  }
}

/** Write one validated chunk into the box and bump the status document. */
export async function storeChunk(
  supabase: SupabaseClient,
  userId: string,
  chunk: IngestChunk
): Promise<IngestStatus> {
  return withStateLease(supabase, userId, "imessage", "archive", {}, async (boxId, renew) => {
    await readBoxIngestStatus(boxId);
    await migrateLegacyArchive(boxId, chunk.threads ?? [], renew);
    const archive = await storeArchiveMessages(boxId, chunk.messages, renew);
    const status: IngestStatus = {
      chunks: archive.partitions,
      messages: archive.messages,
      last_upload_at: new Date().toISOString(),
      from_date: archive.from || null,
      to_date: archive.to || null,
    };
    await writeArchiveFile(boxId, STATUS_PATH, JSON.stringify(status), renew);
    return status;
  });
}
