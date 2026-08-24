/**
 * Berd mini-app document (berd.goal.md §4.2, §MA-B1). A cache plus intent:
 * the user's own Berd instance is authoritative for agents, projects, skills
 * and sessions; this document mirrors the last sync so the view renders with
 * the desktop offline and the agent can read it with plain file tools (C4,
 * MA10). Nothing here is a secret — provider rows carry a `configured`
 * boolean and never key material (C18), and the normalizer drops anything
 * key-shaped that a hostile payload tries to plant (C9).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAppState, writeAppState } from "../store";

export type BerdLinkStatus = "unpaired" | "pending" | "paired" | "revoked";
export type BerdPendingState = "queued" | "sent" | "done" | "failed";

export interface BerdLink {
  status: BerdLinkStatus;
  deviceLabel: string | null;
  protocolVersion: number | null;
  lastSyncAt: string | null;
}

export interface BerdAgent {
  id: string;
  name: string;
  description?: string;
  harness?: string;
  model?: string;
}

export interface BerdProject {
  id: string;
  name: string;
  startupMode?: string;
  archived?: boolean;
}

export interface BerdSkill {
  id: string;
  name: string;
  summary?: string;
}

/** Never a key, only whether Berd has one (C18). */
export interface BerdProvider {
  id: string;
  name: string;
  configured: boolean;
}

export interface BerdSession {
  id: string;
  title: string;
  projectId?: string | null;
  updatedAt?: string;
}

export interface BerdAutomation {
  id: string;
  name: string;
  enabled: boolean;
}

export interface BerdPending {
  id: string;
  group: string;
  action: string;
  requestedAt: string;
  state: BerdPendingState;
  note?: string;
}

export interface BerdDoc {
  schemaVersion: 1;
  title: string;
  link: BerdLink;
  agents: BerdAgent[];
  projects: BerdProject[];
  skills: BerdSkill[];
  providers: BerdProvider[];
  sessions: BerdSession[];
  automations: BerdAutomation[];
  pending: BerdPending[];
}

export const DEFAULT_BERD_DOC: BerdDoc = {
  schemaVersion: 1,
  title: "Berd",
  link: {
    status: "unpaired",
    deviceLabel: null,
    protocolVersion: null,
    lastSyncAt: null,
  },
  agents: [],
  projects: [],
  skills: [],
  providers: [],
  sessions: [],
  automations: [],
  pending: [],
};

/** Everything a mirrored list may hold: enough to render, no more. */
const MAX_ROWS = 200;
const LINK_STATUSES: readonly BerdLinkStatus[] = [
  "unpaired",
  "pending",
  "paired",
  "revoked",
];
const PENDING_STATES: readonly BerdPendingState[] = [
  "queued",
  "sent",
  "done",
  "failed",
];

/**
 * Values that look like credentials never belong in this document. Berd's
 * broker has no tokens today, but a prompt-injected agent or a future payload
 * could try to park one here, and every surface the owner opens can read it.
 */
const KEY_ENCODED =
  /(sk-[A-Za-z0-9_-]{12,}|nsec1[a-z0-9]{20,}|-----BEGIN|bunker:\/\/)/i;
/** Free text also rejects a bare 64-hex value (could be a raw key); id
 * fields use `ident` since hex identifiers are legitimate there. */
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

function ident(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || KEY_ENCODED.test(trimmed)) return null;
  return trimmed.slice(0, max);
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (row): row is Record<string, unknown> =>
        typeof row === "object" && row !== null
    )
    .slice(0, MAX_ROWS);
}

function optional(
  key: string,
  row: Record<string, unknown>,
  max: number
): Record<string, string> {
  const value = str(row[key], max);
  return value ? { [key]: value } : {};
}

function normalizeLink(value: unknown): BerdLink {
  const link = (typeof value === "object" && value !== null ? value : {}) as
    Record<string, unknown>;
  const status = LINK_STATUSES.find((candidate) => candidate === link.status);
  const protocolVersion =
    typeof link.protocolVersion === "number" &&
    Number.isInteger(link.protocolVersion) &&
    link.protocolVersion > 0
      ? link.protocolVersion
      : null;
  return {
    status: status ?? "unpaired",
    deviceLabel: str(link.deviceLabel, 80),
    protocolVersion,
    lastSyncAt: str(link.lastSyncAt, 40),
  };
}

/**
 * Coerce whatever is on disk into a renderable document. Berd payloads are
 * reduced-trust input (C9): unknown fields are dropped, strings are bounded,
 * and a row without an id/name is not a row.
 */
export function normalizeBerdDoc(raw: unknown): BerdDoc {
  const doc = (typeof raw === "object" && raw !== null ? raw : {}) as
    Record<string, unknown>;
  const named = <T>(
    key: string,
    build: (row: Record<string, unknown>, id: string, name: string) => T
  ): T[] => {
    const out: T[] = [];
    for (const row of rows(doc[key])) {
      const id = ident(row.id, 128);
      const name = str(row.name, 200);
      if (id && name) out.push(build(row, id, name));
    }
    return out;
  };
  return {
    schemaVersion: 1,
    title: str(doc.title, 120) ?? DEFAULT_BERD_DOC.title,
    link: normalizeLink(doc.link),
    agents: named("agents", (row, id, name) => ({
      id,
      name,
      ...optional("description", row, 400),
      ...optional("harness", row, 80),
      ...optional("model", row, 120),
    })),
    projects: named("projects", (row, id, name) => ({
      id,
      name,
      ...optional("startupMode", row, 40),
      ...(row.archived === true ? { archived: true } : {}),
    })),
    skills: named("skills", (row, id, name) => ({
      id,
      name,
      ...optional("summary", row, 400),
    })),
    providers: named("providers", (row, id, name) => ({
      id,
      name,
      configured: row.configured === true,
    })),
    sessions: rows(doc.sessions).flatMap((row) => {
      const id = ident(row.id, 128);
      const title = str(row.title, 200);
      if (!id || !title) return [];
      const projectId = ident(row.projectId, 128);
      return [
        {
          id,
          title,
          ...(projectId ? { projectId } : {}),
          ...optional("updatedAt", row, 40),
        },
      ];
    }),
    automations: named("automations", (row, id, name) => ({
      id,
      name,
      enabled: row.enabled === true,
    })),
    pending: rows(doc.pending).flatMap((row) => {
      const id = ident(row.id, 128);
      const group = str(row.group, 80);
      const action = str(row.action, 80);
      if (!id || !group || !action) return [];
      const state = PENDING_STATES.find((candidate) => candidate === row.state);
      return [
        {
          id,
          group,
          action,
          requestedAt: str(row.requestedAt, 40) ?? new Date(0).toISOString(),
          state: state ?? "queued",
          ...optional("note", row, 200),
        },
      ];
    }),
  };
}

export async function getBerdDoc(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string
): Promise<BerdDoc> {
  return normalizeBerdDoc(
    await readAppState(supabase, userId, "berd", resourceId)
  );
}

export async function putBerdDoc(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  doc: BerdDoc
): Promise<void> {
  await writeAppState(
    supabase,
    userId,
    "berd",
    resourceId,
    normalizeBerdDoc(doc)
  );
}
