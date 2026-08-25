/**
 * Buzz mini-app document (buzz.goal.md §4.2, §MA-Z1). A cache plus intent:
 * the relay is authoritative for channels, threads, DMs, canvases, workflows
 * and agent membership; this mirror lets the view render when the relay is
 * unreachable and lets the agent read the same state with plain file tools
 * (C4, MA10).
 *
 * Buzz identity is a keypair, so the invariant here is blunt: this document
 * holds the owner's **public** identity (`npub`) and never any private
 * material. Relay payloads are hostile input (C9) and a planted `nsec1…`,
 * bunker URI, or key-shaped free-text value is dropped at the normalizer
 * rather than written to a file every surface the owner opens can read (C18).
 * Identifier fields keep bare 64-hex values, since Nostr event ids and
 * pubkeys share that shape.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readAppState, writeAppState } from "../store";

export type BuzzLinkStatus = "unbound" | "pending" | "connected" | "revoked";
export type BuzzSignerKind = "box" | "desktop" | "nip46";
export type BuzzPendingState = "queued" | "sent" | "done" | "failed";
export type BuzzDraftState = "ready-for-review" | "saved";

export interface BuzzLink {
  status: BuzzLinkStatus;
  /** The community: one relay URL selects one workspace. */
  relayUrl: string | null;
  /** NIP-11 name, display only. */
  communityLabel: string | null;
  /** Public identity. Never the key. */
  npub: string | null;
  signerKind: BuzzSignerKind | null;
  lastSyncAt: string | null;
}

export interface BuzzChannel {
  id: string;
  name: string;
  kind?: "stream" | "forum";
  visibility?: "open" | "private";
  topic?: string;
  unread?: number;
}

export interface BuzzThread {
  channelId: string;
  rootEventId: string;
  excerpt: string;
  replyCount?: number;
  updatedAt?: string;
}

export interface BuzzDm {
  id: string;
  participants: string[];
  updatedAt?: string;
}

export interface BuzzCanvas {
  channelId: string;
  updatedAt?: string;
}

export interface BuzzWorkflow {
  id: string;
  name: string;
  channelId?: string;
  pendingApprovals?: number;
}

export interface BuzzAgent {
  name: string;
  npub?: string;
  access?: string;
  draftState?: BuzzDraftState;
}

export interface BuzzPending {
  id: string;
  group: string;
  verb: string;
  requestedAt: string;
  state: BuzzPendingState;
  note?: string;
}

export interface BuzzDoc {
  schemaVersion: 1;
  title: string;
  link: BuzzLink;
  channels: BuzzChannel[];
  threads: BuzzThread[];
  dms: BuzzDm[];
  canvases: BuzzCanvas[];
  workflows: BuzzWorkflow[];
  agents: BuzzAgent[];
  pending: BuzzPending[];
}

export const DEFAULT_BUZZ_DOC: BuzzDoc = {
  schemaVersion: 1,
  title: "Buzz",
  link: {
    status: "unbound",
    relayUrl: null,
    communityLabel: null,
    npub: null,
    signerKind: null,
    lastSyncAt: null,
  },
  channels: [],
  threads: [],
  dms: [],
  canvases: [],
  workflows: [],
  agents: [],
  pending: [],
};

const MAX_ROWS = 200;
const LINK_STATUSES: readonly BuzzLinkStatus[] = [
  "unbound",
  "pending",
  "connected",
  "revoked",
];
const SIGNER_KINDS: readonly BuzzSignerKind[] = ["box", "desktop", "nip46"];
const PENDING_STATES: readonly BuzzPendingState[] = [
  "queued",
  "sent",
  "done",
  "failed",
];

/** Explicit private-key encodings never belong anywhere in this document. */
const KEY_ENCODED =
  /(nsec1[a-z0-9]{20,}|bunker:\/\/|-----BEGIN|\bncryptsec1[a-z0-9]{10,})/i;
/**
 * Free text additionally rejects a bare 64-hex value: it could be a raw key.
 * Nostr event ids and pubkeys are also 64-hex, so identifier fields use
 * `ident` instead.
 */
const SECRET_SHAPED = new RegExp(
  `(${KEY_ENCODED.source}|\\b[0-9a-f]{64}\\b)`,
  "i"
);

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || SECRET_SHAPED.test(trimmed)) return null;
  return trimmed.slice(0, max);
}

/** Identifier fields (event ids, channel ids, pubkeys) may be bare 64-hex. */
function ident(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || KEY_ENCODED.test(trimmed)) return null;
  return trimmed.slice(0, max);
}

function count(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 ? Math.min(rounded, 9999) : null;
}

/**
 * Loose row schemas: relay payloads are hostile, so fields stay `unknown`
 * and every value passes through str/ident/count. The schema only names
 * the fields each normalizer reads.
 */
const ChannelRow = z.object({
  id: z.unknown(),
  name: z.unknown(),
  kind: z.unknown(),
  visibility: z.unknown(),
  topic: z.unknown(),
  unread: z.unknown(),
});
const ThreadRow = z.object({
  channelId: z.unknown(),
  rootEventId: z.unknown(),
  excerpt: z.unknown(),
  replyCount: z.unknown(),
  updatedAt: z.unknown(),
});
const DmRow = z.object({
  id: z.unknown(),
  participants: z.unknown(),
  updatedAt: z.unknown(),
});
const CanvasRow = z.object({ channelId: z.unknown(), updatedAt: z.unknown() });
const WorkflowRow = z.object({
  id: z.unknown(),
  name: z.unknown(),
  channelId: z.unknown(),
  pendingApprovals: z.unknown(),
});
const AgentRow = z.object({
  name: z.unknown(),
  npub: z.unknown(),
  access: z.unknown(),
  draftState: z.unknown(),
});
const PendingRow = z.object({
  id: z.unknown(),
  group: z.unknown(),
  verb: z.unknown(),
  requestedAt: z.unknown(),
  state: z.unknown(),
  note: z.unknown(),
});

function rows<T>(value: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((row) => {
      const parsed = schema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    })
    .slice(0, MAX_ROWS);
}

/** Only a `wss://`/`https://` relay is a community (C5 allowlisting is the
 * link lane's job; this is the shape gate). */
function relayUrl(value: unknown): string | null {
  const raw = str(value, 300);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["wss:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const LinkRow = z.object({
  status: z.unknown(),
  relayUrl: z.unknown(),
  communityLabel: z.unknown(),
  npub: z.unknown(),
  signerKind: z.unknown(),
  lastSyncAt: z.unknown(),
});

function normalizeLink(value: unknown): BuzzLink {
  const parsed = LinkRow.safeParse(value);
  const link: z.infer<typeof LinkRow> = parsed.success ? parsed.data : {};
  const npub = str(link.npub, 80);
  return {
    status: LINK_STATUSES.find((s) => s === link.status) ?? "unbound",
    relayUrl: relayUrl(link.relayUrl),
    communityLabel: str(link.communityLabel, 120),
    npub: npub && npub.startsWith("npub1") ? npub : null,
    signerKind: SIGNER_KINDS.find((s) => s === link.signerKind) ?? null,
    lastSyncAt: str(link.lastSyncAt, 40),
  };
}

const DocRow = z.object({
  title: z.unknown(),
  link: z.unknown(),
  channels: z.unknown(),
  threads: z.unknown(),
  dms: z.unknown(),
  canvases: z.unknown(),
  workflows: z.unknown(),
  agents: z.unknown(),
  pending: z.unknown(),
});

export function normalizeBuzzDoc(raw: unknown): BuzzDoc {
  const parsed = DocRow.safeParse(raw);
  const doc: z.infer<typeof DocRow> = parsed.success ? parsed.data : {};
  return {
    schemaVersion: 1,
    title: str(doc.title, 120) ?? DEFAULT_BUZZ_DOC.title,
    link: normalizeLink(doc.link),
    channels: rows(doc.channels, ChannelRow).flatMap((row) => {
      const id = ident(row.id, 128);
      const name = str(row.name, 120);
      if (!id || !name) return [];
      const topic = str(row.topic, 400);
      const unread = count(row.unread);
      return [
        {
          id,
          name,
          ...(row.kind === "stream" || row.kind === "forum"
            ? { kind: row.kind }
            : {}),
          ...(row.visibility === "open" || row.visibility === "private"
            ? { visibility: row.visibility }
            : {}),
          ...(topic ? { topic } : {}),
          ...(unread ? { unread } : {}),
        },
      ];
    }),
    threads: rows(doc.threads, ThreadRow).flatMap((row) => {
      const channelId = ident(row.channelId, 128);
      const rootEventId = ident(row.rootEventId, 128);
      if (!channelId || !rootEventId) return [];
      const replyCount = count(row.replyCount);
      const updatedAt = str(row.updatedAt, 40);
      return [
        {
          channelId,
          rootEventId,
          excerpt: str(row.excerpt, 300) ?? "",
          ...(replyCount ? { replyCount } : {}),
          ...(updatedAt ? { updatedAt } : {}),
        },
      ];
    }),
    dms: rows(doc.dms, DmRow).flatMap((row) => {
      const id = ident(row.id, 128);
      if (!id) return [];
      const participants = (Array.isArray(row.participants)
        ? row.participants
        : []
      )
        .map((participant) => ident(participant, 80))
        .filter((participant): participant is string => participant !== null)
        .slice(0, 9);
      const updatedAt = str(row.updatedAt, 40);
      return [{ id, participants, ...(updatedAt ? { updatedAt } : {}) }];
    }),
    canvases: rows(doc.canvases, CanvasRow).flatMap((row) => {
      const channelId = ident(row.channelId, 128);
      if (!channelId) return [];
      const updatedAt = str(row.updatedAt, 40);
      return [{ channelId, ...(updatedAt ? { updatedAt } : {}) }];
    }),
    workflows: rows(doc.workflows, WorkflowRow).flatMap((row) => {
      const id = ident(row.id, 128);
      const name = str(row.name, 120);
      if (!id || !name) return [];
      const channelId = ident(row.channelId, 128);
      const pendingApprovals = count(row.pendingApprovals);
      return [
        {
          id,
          name,
          ...(channelId ? { channelId } : {}),
          ...(pendingApprovals ? { pendingApprovals } : {}),
        },
      ];
    }),
    agents: rows(doc.agents, AgentRow).flatMap((row) => {
      const name = str(row.name, 120);
      if (!name) return [];
      const npub = str(row.npub, 80);
      const access = str(row.access, 80);
      return [
        {
          name,
          ...(npub && npub.startsWith("npub1") ? { npub } : {}),
          ...(access ? { access } : {}),
          ...(row.draftState === "ready-for-review" || row.draftState === "saved"
            ? { draftState: row.draftState }
            : {}),
        },
      ];
    }),
    pending: rows(doc.pending, PendingRow).flatMap((row) => {
      const id = ident(row.id, 128);
      const group = str(row.group, 80);
      const verb = str(row.verb, 80);
      if (!id || !group || !verb) return [];
      const note = str(row.note, 200);
      return [
        {
          id,
          group,
          verb,
          requestedAt: str(row.requestedAt, 40) ?? new Date(0).toISOString(),
          state: PENDING_STATES.find((s) => s === row.state) ?? "queued",
          ...(note ? { note } : {}),
        },
      ];
    }),
  };
}

/** Bound: pending is a status strip, not a history. */
const MAX_PENDING = 20;

/** Record a freshly queued intent in the document's pending strip. */
export function queueBuzzPending(
  doc: BuzzDoc,
  id: string,
  group: string,
  verb: string
): BuzzDoc {
  const pending = [
    ...doc.pending.filter((op) => op.id !== id),
    {
      id,
      group,
      verb,
      requestedAt: new Date().toISOString(),
      state: "queued" as const,
    },
  ];
  return { ...doc, pending: pending.slice(-MAX_PENDING) };
}

export function markBuzzPending(
  doc: BuzzDoc,
  id: string,
  state: BuzzPendingState,
  note?: string
): BuzzDoc {
  return {
    ...doc,
    pending: doc.pending.map((op) =>
      op.id === id ? { ...op, state, ...(note ? { note } : {}) } : op
    ),
  };
}

/**
 * Merge a signer result into the mirror. The signer reports whichever lists
 * the intent touched as full replacements — the relay is authoritative, the
 * mirror only renders — and the whole document passes back through the
 * normalizer, so a hostile relay payload is bounded and anything key-shaped
 * is dropped (C9/C18) before a byte is written.
 */
const ResultPayload = z.object({
  channels: z.unknown(),
  threads: z.unknown(),
  dms: z.unknown(),
  canvases: z.unknown(),
  workflows: z.unknown(),
  agents: z.unknown(),
});

export function mergeBuzzResult(doc: BuzzDoc, data: unknown): BuzzDoc {
  const parsed = ResultPayload.safeParse(data);
  if (!parsed.success) return doc;
  const payload = parsed.data;
  const merged = {
    ...doc,
    ...(Array.isArray(payload.channels) ? { channels: payload.channels } : {}),
    ...(Array.isArray(payload.threads) ? { threads: payload.threads } : {}),
    ...(Array.isArray(payload.dms) ? { dms: payload.dms } : {}),
    ...(Array.isArray(payload.canvases) ? { canvases: payload.canvases } : {}),
    ...(Array.isArray(payload.workflows)
      ? { workflows: payload.workflows }
      : {}),
    ...(Array.isArray(payload.agents) ? { agents: payload.agents } : {}),
    link: { ...doc.link, lastSyncAt: new Date().toISOString() },
  };
  return normalizeBuzzDoc(merged);
}

export async function getBuzzDoc(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string
): Promise<BuzzDoc> {
  return normalizeBuzzDoc(
    await readAppState(supabase, userId, "buzz", resourceId)
  );
}

export async function putBuzzDoc(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  doc: BuzzDoc
): Promise<void> {
  await writeAppState(
    supabase,
    userId,
    "buzz",
    resourceId,
    normalizeBuzzDoc(doc)
  );
}
