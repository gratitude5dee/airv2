/**
 * V3 box event store access. Events live in the box (C4 / §3.2): the
 * canonical store is ~/.hermes/calendar/events.json, raw .ics drops land in
 * ~/.hermes/calendar/inbox/, and source credentials live in
 * ~/.hermes/calendar/sources.json (mode 600) — never in Postgres. The
 * control plane reads the store per-request and never caches event content.
 */
import type { HermesBoxTarget } from "../hermes/client";
import { createJob, listJobs, runJob } from "../hermes/client";
import { BoxApiError, command, readFile, writeFile } from "../box/client";

export const CALENDAR_DIR = "/home/user/.hermes/calendar";
export const EVENTS_PATH = `${CALENDAR_DIR}/events.json`;
export const INBOX_DIR = `${CALENDAR_DIR}/inbox`;
export const SOURCES_PATH = `${CALENDAR_DIR}/sources.json`;
export const SYNC_JOB_NAME = "[air] calendar-sync";
export const SYNC_SCHEDULE = "*/15 * * * *";

/** Normalized event shape the sync job writes and every surface reads. */
export interface CalendarEvent {
  id: string;
  source: "google" | "apple_ics" | "calcom" | "email";
  source_ref: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location?: string;
  attendees_count?: number;
  /** Attendee emails, when the source provides them (MA6 #6 avatars). */
  attendees?: string[];
  url?: string;
  notes_ref?: string;
  /** email invites start pending until the calendar_add decision resolves */
  status?: "pending" | "confirmed";
}

function isCalendarSource(value: unknown): value is CalendarEvent["source"] {
  return (
    value === "google" ||
    value === "apple_ics" ||
    value === "calcom" ||
    value === "email"
  );
}

export function parseCalendarEvent(value: unknown): CalendarEvent | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !isCalendarSource(record.source) ||
    typeof record.source_ref !== "string" ||
    typeof record.title !== "string" ||
    typeof record.starts_at !== "string" ||
    typeof record.ends_at !== "string" ||
    typeof record.all_day !== "boolean" ||
    (record.location !== null &&
      record.location !== undefined &&
      typeof record.location !== "string") ||
    (record.attendees_count !== null &&
      record.attendees_count !== undefined &&
      (typeof record.attendees_count !== "number" ||
        !Number.isInteger(record.attendees_count))) ||
    (record.attendees !== null &&
      record.attendees !== undefined &&
      (!Array.isArray(record.attendees) ||
        record.attendees.some((entry) => typeof entry !== "string"))) ||
    (record.url !== null &&
      record.url !== undefined &&
      typeof record.url !== "string") ||
    (record.notes_ref !== null &&
      record.notes_ref !== undefined &&
      typeof record.notes_ref !== "string") ||
    (record.status !== null &&
      record.status !== undefined &&
      record.status !== "pending" &&
      record.status !== "confirmed")
  ) {
    return undefined;
  }
  const location =
    typeof record.location === "string" ? record.location : undefined;
  const attendeesCount =
    typeof record.attendees_count === "number"
      ? record.attendees_count
      : undefined;
  const attendees = Array.isArray(record.attendees)
    ? record.attendees.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : undefined;
  const url = typeof record.url === "string" ? record.url : undefined;
  const notesRef =
    typeof record.notes_ref === "string" ? record.notes_ref : undefined;
  const status =
    record.status === "pending" || record.status === "confirmed"
      ? record.status
      : undefined;
  return {
    id: record.id,
    source: record.source,
    source_ref: record.source_ref,
    title: record.title,
    starts_at: record.starts_at,
    ends_at: record.ends_at,
    all_day: record.all_day,
    ...(location !== undefined ? { location } : {}),
    ...(attendeesCount !== undefined
      ? { attendees_count: attendeesCount }
      : {}),
    ...(attendees !== undefined ? { attendees } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(notesRef !== undefined ? { notes_ref: notesRef } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

/** Read + validate the box event store. A missing store is an empty feed. */
export async function readEventsStore(
  boxId: string
): Promise<CalendarEvent[]> {
  let raw: string;
  try {
    raw = await readFile(boxId, EVENTS_PATH);
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed)
    ? parsed
    : ((parsed as Record<string, unknown>)?.events ?? []);
  if (!Array.isArray(list)) return [];
  return list
    .map(parseCalendarEvent)
    .filter((event): event is CalendarEvent => event !== undefined);
}

export interface BoxSource {
  id: string;
  provider: "apple_ics" | "calcom";
  /** apple_ics: the https ICS URL. calcom: the API key. Box-only (C4). */
  secret: string;
}

export function parseBoxSource(value: unknown): BoxSource | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    (record.provider !== "apple_ics" && record.provider !== "calcom") ||
    typeof record.secret !== "string"
  ) {
    return undefined;
  }
  return {
    id: record.id,
    provider: record.provider,
    secret: record.secret,
  };
}

function parseBoxSources(value: unknown): BoxSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources = value.map(parseBoxSource);
  return sources.every((source): source is BoxSource => source !== undefined)
    ? sources
    : undefined;
}

/**
 * Upsert a source credential into the box-side sources file. The secret
 * transits this process but is never persisted control-plane-side.
 */
export async function upsertBoxSource(
  boxId: string,
  source: BoxSource
): Promise<void> {
  // Pre-create the file with mode 600 so the secret is never on disk with
  // default (world-readable) permissions, even briefly. A failed mkdir/chmod
  // must abort the write — command() only throws on API-level failures.
  const prep = await command(
    boxId,
    `mkdir -p ${INBOX_DIR} && chmod 700 ${CALENDAR_DIR} && ` +
      `touch ${SOURCES_PATH} && chmod 600 ${SOURCES_PATH}`
  );
  if (prep.exitCode !== 0) {
    throw new Error(`sources prep failed: ${prep.stderr}`);
  }
  let sources: BoxSource[] = [];
  try {
    const raw = await readFile(boxId, SOURCES_PATH);
    if (raw.trim() !== "") {
      const parsed = JSON.parse(raw) as unknown;
      const parsedSources = parseBoxSources(parsed);
      if (!parsedSources) throw new Error("sources file has an invalid shape");
      sources = parsedSources;
    }
  } catch (error) {
    // Only a missing file means "first source". A transient box/API failure
    // must not be mistaken for an empty list — that would overwrite (and
    // destroy) the user's other source credentials.
    if (!(error instanceof BoxApiError && error.status === 404)) throw error;
  }
  const next = sources.filter((entry) => entry.id !== source.id);
  next.push(source);
  await writeFile(boxId, ".hermes/calendar/sources.json", JSON.stringify(next));
  const mode = await command(boxId, `chmod 600 ${SOURCES_PATH}`);
  if (mode.exitCode !== 0) {
    throw new Error(`sources chmod failed: ${mode.stderr}`);
  }
}

export async function removeBoxSource(
  boxId: string,
  sourceId: string
): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(boxId, SOURCES_PATH);
  } catch (error) {
    // No sources file — nothing to remove. Any other failure propagates.
    if (error instanceof BoxApiError && error.status === 404) return;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(parsed)) return;
  const sources = parseBoxSources(parsed);
  if (!sources) return;
  const next = sources.filter((entry) => entry.id !== sourceId);
  await writeFile(
    boxId,
    ".hermes/calendar/sources.json",
    JSON.stringify(next)
  );
  const mode = await command(boxId, `chmod 600 ${SOURCES_PATH}`);
  if (mode.exitCode !== 0) {
    throw new Error(`sources chmod failed: ${mode.stderr}`);
  }
}

/**
 * Ensure the box-side `[air] calendar-sync` cron job exists (every 15 min
 * while awake); returns its id. In-box cron is allowed for exactly this job
 * — it has no delivery (C12).
 */
export async function ensureSyncJob(target: HermesBoxTarget): Promise<string> {
  const jobs = await listJobs(target);
  const existing = jobs.find((job) => job.name === SYNC_JOB_NAME);
  if (existing) return existing.id;
  const created = await createJob(target, {
    name: SYNC_JOB_NAME,
    schedule: SYNC_SCHEDULE,
    prompt:
      "Run `python3 ~/.hermes/calendar/sync.py pull` in the terminal. If a " +
      "Google Calendar Composio toolkit is connected, fetch the next 30 days " +
      "of events, write them as normalized JSON to " +
      "~/.hermes/calendar/google.json, then run the pull again. Print " +
      "[SILENT] when done.",
  });
  return created.id;
}

/**
 * The control-plane nudge: run the sync job now (on wake, on connect, on a
 * cal.com webhook). Falls back to invoking sync.py directly when the jobs
 * API shape differs from the pinned snapshot.
 */
export async function nudgeSync(
  target: HermesBoxTarget,
  boxId: string
): Promise<void> {
  try {
    const jobId = await ensureSyncJob(target);
    await runJob(target, jobId);
  } catch {
    await command(
      boxId,
      "python3 /home/user/.hermes/calendar/sync.py pull",
      120
    ).catch(() => undefined);
  }
}

// Refs are box paths the control plane itself minted (materializeIcs).
// Validate before shell interpolation — JSON/double quotes are NOT a safe
// shell escaping primitive ($(), backticks and $VAR still expand).
const SAFE_REF = /^[A-Za-z0-9._/-]+$/;

function shellQuote(ref: string): string {
  if (!SAFE_REF.test(ref)) {
    throw new Error("invalid calendar ref");
  }
  return `'${ref}'`;
}

/** Approve a pending (emailed) event: flips it to confirmed in the store. */
export async function approveInboxEvent(
  boxId: string,
  ref: string
): Promise<void> {
  const result = await command(
    boxId,
    `python3 /home/user/.hermes/calendar/sync.py approve ${shellQuote(ref)}`,
    120
  );
  if (result.exitCode !== 0) {
    throw new Error(`calendar approve failed: ${result.stderr}`);
  }
}

/** Dismiss: tombstone the invite so a re-sync cannot resurrect it. */
export async function dismissInboxEvent(
  boxId: string,
  ref: string
): Promise<void> {
  const result = await command(
    boxId,
    `python3 /home/user/.hermes/calendar/sync.py dismiss ${shellQuote(ref)}`,
    120
  );
  if (result.exitCode !== 0) {
    throw new Error(`calendar dismiss failed: ${result.stderr}`);
  }
}

/** Drop raw (hostile, I5) ICS bytes into the box calendar inbox. */
export async function materializeIcs(
  boxId: string,
  fileName: string,
  bytes: Buffer
): Promise<string> {
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  const relative = `.hermes/calendar/inbox/${Date.now()}-${safeName}`;
  // shellQuote also re-validates the sanitized path before interpolation.
  const quoted = shellQuote(`/home/user/${relative}`);
  const quotedBin = shellQuote(`/home/user/${relative}.bin`);
  await command(boxId, `mkdir -p ${INBOX_DIR}`);
  await writeFile(boxId, relative, bytes.toString("base64"));
  await command(
    boxId,
    `base64 -d ${quoted} > ${quotedBin} && mv ${quotedBin} ${quoted}`
  );
  return `/home/user/${relative}`;
}
