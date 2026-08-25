/**
 * Personal CRM store (MA6 #9). Rich people records live box-side at
 * .hermes/miniapps/crm/people.json (C4) — names, photo refs, notes, tags,
 * and links to the senders rows Postgres already has. Postgres never gains
 * content: the only shared-DB rows involved are the existing senders links
 * and the crm_update decisions that gate tier-derived edits.
 *
 * Every agent-written change carries provenance ({source:'agent', at, note})
 * so the detail view can show where a fact came from.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "../box/client";
import { asRecord } from "../records";
import { ensureBoxAwake } from "../orchestrator/boxes";

export const PEOPLE_PATH = ".hermes/miniapps/crm/people.json";

export interface CrmProvenance {
  source: "owner" | "agent";
  at: string;
  note?: string | undefined;
}

export interface CrmPerson {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
  sender_ids: string[];
  /** Refs only (owner R2 prefix or box-private paths) — never inlined. */
  photos: string[];
  notes: string;
  tags: string[];
  provenance: CrmProvenance[];
  created_at: string;
  updated_at: string;
}

export interface CrmStore {
  version: 1;
  people: CrmPerson[];
}

const EMPTY: CrmStore = { version: 1, people: [] };

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

/** Normalize one raw entry from the box-side file, or drop it. The file is
 * ordinary box state the agent may write directly, so every field is
 * validated on read — one malformed record must not take the app down. */
export function asPerson(raw: unknown): CrmPerson | null {
  const value = asRecord(raw);
  if (!value) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.name !== "string" || !value.name) return null;
  const provenance = Array.isArray(value.provenance)
    ? value.provenance.filter(
        (p): p is CrmProvenance =>
          typeof p === "object" &&
          p !== null &&
          ((p as CrmProvenance).source === "owner" ||
            (p as CrmProvenance).source === "agent") &&
          typeof (p as CrmProvenance).at === "string"
      )
    : [];
  return {
    id: value.id,
    name: value.name,
    emails: strings(value.emails),
    phones: strings(value.phones),
    sender_ids: strings(value.sender_ids),
    photos: strings(value.photos),
    notes: typeof value.notes === "string" ? value.notes : "",
    tags: strings(value.tags),
    provenance,
    created_at:
      typeof value.created_at === "string" ? value.created_at : "",
    updated_at:
      typeof value.updated_at === "string" ? value.updated_at : "",
  };
}

export async function readPeople(boxId: string): Promise<CrmStore> {
  try {
    const raw = await readFile(boxId, PEOPLE_PATH);
    const parsed = JSON.parse(raw) as CrmStore;
    if (!Array.isArray(parsed.people)) return EMPTY;
    return {
      version: 1,
      people: parsed.people
        .map(asPerson)
        .filter((p): p is CrmPerson => p !== null),
    };
  } catch {
    return EMPTY;
  }
}

export async function writePeople(
  boxId: string,
  store: CrmStore
): Promise<void> {
  await writeFile(boxId, PEOPLE_PATH, JSON.stringify(store, null, 2));
}

const clean = (values: unknown): string[] =>
  Array.isArray(values)
    ? values
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

export interface CrmPatch {
  person_id?: string;
  name?: string;
  emails?: string[];
  phones?: string[];
  sender_ids?: string[];
  photos?: string[];
  notes?: string;
  tags?: string[];
  delete?: boolean;
}

export function sanitizePatch(raw: Record<string, unknown>): CrmPatch {
  const patch: CrmPatch = {};
  if (typeof raw.person_id === "string") patch.person_id = raw.person_id;
  if (typeof raw.name === "string") patch.name = raw.name.slice(0, 200);
  if (raw.emails !== undefined) patch.emails = clean(raw.emails);
  if (raw.phones !== undefined) patch.phones = clean(raw.phones);
  if (raw.sender_ids !== undefined) patch.sender_ids = clean(raw.sender_ids);
  if (raw.photos !== undefined) patch.photos = clean(raw.photos);
  if (typeof raw.notes === "string") patch.notes = raw.notes.slice(0, 10_000);
  if (raw.tags !== undefined) patch.tags = clean(raw.tags);
  if (raw.delete === true) patch.delete = true;
  return patch;
}

/** Apply a patch to the store (upsert / delete). Deleting a person removes
 * the whole record including its photo refs — no orphaned image refs
 * survive the person. Returns the updated store and the affected person. */
export function applyPatch(
  store: CrmStore,
  patch: CrmPatch,
  provenance: CrmProvenance
): { store: CrmStore; person: CrmPerson | null } {
  const now = new Date().toISOString();
  const people = [...store.people];
  const index = patch.person_id
    ? people.findIndex((p) => p.id === patch.person_id)
    : -1;

  if (patch.delete) {
    if (index < 0) return { store, person: null };
    people.splice(index, 1);
    return { store: { version: 1, people }, person: null };
  }

  const existing = index >= 0 ? people[index] : null;
  const person: CrmPerson = {
    id: existing?.id ?? patch.person_id ?? crypto.randomUUID(),
    name: patch.name ?? existing?.name ?? "Unnamed",
    emails: patch.emails ?? existing?.emails ?? [],
    phones: patch.phones ?? existing?.phones ?? [],
    sender_ids: patch.sender_ids ?? existing?.sender_ids ?? [],
    photos: patch.photos ?? existing?.photos ?? [],
    notes: patch.notes ?? existing?.notes ?? "",
    tags: patch.tags ?? existing?.tags ?? [],
    provenance: [...(existing?.provenance ?? []), provenance].slice(-50),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  if (index >= 0) {
    people[index] = person;
  } else {
    people.push(person);
  }
  return { store: { version: 1, people }, person };
}

/** Wake-and-apply helper shared by the mini-app action path and the
 * crm_update approval path. */
export async function applyPatchOnBox(
  supabase: SupabaseClient,
  userId: string,
  patch: CrmPatch,
  provenance: CrmProvenance
): Promise<CrmPerson | null> {
  const box = await ensureBoxAwake(supabase, userId);
  const store = await readPeople(box.boxId);
  const result = applyPatch(store, patch, provenance);
  await writePeople(box.boxId, result.store);
  return result.person;
}

export interface CrmAvatar {
  name: string;
  initials: string;
  color: string;
}

const AVATAR_COLORS = [
  "#2b7fff",
  "#7c5cff",
  "#00a884",
  "#e0679a",
  "#e08a00",
  "#4593a3",
];

export function ditherColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? "#2b7fff";
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/** email (lowercased) → avatar, for calendar attendee chips (MA6 #6).
 * Owner-scoped by construction: the store came from the owner's own box. */
export function avatarIndex(store: CrmStore): Map<string, CrmAvatar> {
  const index = new Map<string, CrmAvatar>();
  for (const person of store.people) {
    for (const email of person.emails) {
      index.set(email.toLowerCase(), {
        name: person.name,
        initials: initialsFor(person.name),
        color: ditherColor(person.id),
      });
    }
  }
  return index;
}
