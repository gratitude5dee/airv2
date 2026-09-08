/**
 * Owner resolution of legacy thread labels the catalogue cannot settle.
 * Both documents live box-side under the archive state directory: labels are
 * message content (C4) and travel only box → owner-session response. Nothing
 * here is logged or mirrored to Postgres.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { BoxApiError, readFile } from "../box/client";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { withStateLease } from "../miniapps/stateLease";
import { asRecord } from "../records";
import { writeArchiveFile } from "./archiveWrite";
import type { ThreadResolution, UnresolvedThread } from "./archiveMigration";

const STATE = ".hermes/context/imessage-archive-state";
export const PENDING_RESOLUTION_PATH = `${STATE}/pending-resolution.json`;
export const RESOLUTIONS_PATH = `${STATE}/resolutions.json`;

export const MAX_RESOLUTIONS = 20_000;
export const MAX_LABEL_CHARS = 4_096;
export const MAX_THREAD_ID_CHARS = 512;

export class ResolutionInputError extends Error {}

export interface PendingResolution {
  schema: 1;
  unresolved: UnresolvedThread[];
  reported_at: string;
}

async function readJson(boxId: string, path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(boxId, path)) as unknown;
  } catch (error) {
    if (error instanceof BoxApiError && error.status === 404) return null;
    throw error;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0);
}

/** Strict shape validation of `{resolutions: [{label, id}]}`; `id: null`
 * keeps the label as its own thread. Rejects rather than coerces. */
export function parseThreadResolutions(raw: unknown): ThreadResolution[] {
  const doc = asRecord(raw);
  if (!doc || !Array.isArray(doc["resolutions"])) {
    throw new ResolutionInputError("body must be {resolutions: [...]}");
  }
  if (doc["resolutions"].length === 0 || doc["resolutions"].length > MAX_RESOLUTIONS) {
    throw new ResolutionInputError(`resolutions must hold 1–${MAX_RESOLUTIONS} entries`);
  }
  const seen = new Set<string>();
  return doc["resolutions"].map((entry: unknown) => {
    const item = asRecord(entry);
    const label = item?.["label"];
    const id = item?.["id"];
    if (typeof label !== "string" || label.length > MAX_LABEL_CHARS) {
      throw new ResolutionInputError(`each resolution needs a label of at most ${MAX_LABEL_CHARS} characters`);
    }
    if (id !== null && (typeof id !== "string" || !id || id.length > MAX_THREAD_ID_CHARS)) {
      throw new ResolutionInputError("each resolution needs a nonempty thread id, or null to keep the label as its own thread");
    }
    if (seen.has(label)) throw new ResolutionInputError("each label may be resolved once per request");
    seen.add(label);
    return { label, id };
  });
}

export async function readPendingResolution(boxId: string): Promise<PendingResolution | null> {
  const doc = asRecord(await readJson(boxId, PENDING_RESOLUTION_PATH));
  if (!doc) return null;
  const unresolved = doc["unresolved"];
  if (doc["schema"] !== 1 || !Array.isArray(unresolved) || typeof doc["reported_at"] !== "string") {
    throw new Error("Invalid pending resolution document");
  }
  return {
    schema: 1,
    reported_at: doc["reported_at"],
    unresolved: unresolved.map((entry: unknown) => {
      const item = asRecord(entry);
      if (!item || typeof item["label"] !== "string" || !isStringArray(item["candidates"])) {
        throw new Error("Invalid pending resolution document");
      }
      return { label: item["label"], candidates: item["candidates"] };
    }),
  };
}

/** Caller holds the archive lease. */
export async function writePendingResolution(
  boxId: string, unresolved: UnresolvedThread[], renew: () => Promise<void>
): Promise<void> {
  const doc: PendingResolution = { schema: 1, unresolved, reported_at: new Date().toISOString() };
  await writeArchiveFile(boxId, PENDING_RESOLUTION_PATH, JSON.stringify(doc), renew);
}

export async function readThreadResolutions(boxId: string): Promise<ThreadResolution[]> {
  const doc = asRecord(await readJson(boxId, RESOLUTIONS_PATH));
  if (!doc) return [];
  if (doc["schema"] !== 1 || !Array.isArray(doc["resolutions"])) {
    throw new Error("Invalid thread resolutions document");
  }
  return doc["resolutions"].map((entry: unknown) => {
    const item = asRecord(entry);
    if (!item || typeof item["label"] !== "string" ||
        (item["id"] !== null && (typeof item["id"] !== "string" || !item["id"]))) {
      throw new Error("Invalid thread resolutions document");
    }
    return { label: item["label"], id: item["id"] };
  });
}

/** Caller holds the archive lease. Later resolutions for a label replace
 * earlier ones; other labels are kept. */
export async function writeThreadResolutions(
  boxId: string, incoming: ThreadResolution[], renew: () => Promise<void>
): Promise<ThreadResolution[]> {
  const merged = new Map<string, ThreadResolution>();
  for (const resolution of [...await readThreadResolutions(boxId), ...incoming]) {
    merged.set(resolution.label, resolution);
  }
  const resolutions = [...merged.values()].sort((a, b) => a.label.localeCompare(b.label));
  await writeArchiveFile(boxId, RESOLUTIONS_PATH, JSON.stringify({ schema: 1, resolutions }), renew);
  return resolutions;
}

/** A resolution is only accepted for a label the last migration preflight
 * reported, and — when that preflight offered candidates — for one of them. */
export function checkResolutionsAgainstPending(
  resolutions: ThreadResolution[], pending: PendingResolution | null
): void {
  const candidates = new Map(pending?.unresolved.map((entry) => [entry.label, entry.candidates]));
  for (const resolution of resolutions) {
    const offered = candidates.get(resolution.label);
    if (!offered) throw new ResolutionInputError("a resolution names a label that is not awaiting resolution");
    if (resolution.id !== null && offered.length > 0 && !offered.includes(resolution.id)) {
      throw new ResolutionInputError("a resolution picks a thread id that was not offered for its label");
    }
  }
}

/** What the owner still has to decide, plus what they already decided. */
export interface ResolutionView {
  unresolved: UnresolvedThread[];
  reported_at: string | null;
  resolutions: ThreadResolution[];
}

function view(pending: PendingResolution | null, resolutions: ThreadResolution[]): ResolutionView {
  const decided = new Set(resolutions.map((resolution) => resolution.label));
  return {
    unresolved: (pending?.unresolved ?? []).filter((entry) => !decided.has(entry.label)),
    reported_at: pending?.reported_at ?? null,
    resolutions,
  };
}

export async function readResolutionView(supabase: SupabaseClient, userId: string): Promise<ResolutionView> {
  const box = await ensureBoxAwake(supabase, userId);
  const [pending, resolutions] = await Promise.all([
    readPendingResolution(box.boxId), readThreadResolutions(box.boxId),
  ]);
  return view(pending, resolutions);
}

/** Validate an owner's `{resolutions}` body against the pending report and
 * persist it under the archive lease so no migration runs mid-write. */
export async function saveResolutions(
  supabase: SupabaseClient, userId: string, raw: unknown
): Promise<ResolutionView> {
  const incoming = parseThreadResolutions(raw);
  return withStateLease(supabase, userId, "imessage", "archive", {}, async (boxId, renew) => {
    const pending = await readPendingResolution(boxId);
    checkResolutionsAgainstPending(incoming, pending);
    await renew();
    return view(pending, await writeThreadResolutions(boxId, incoming, renew));
  });
}
