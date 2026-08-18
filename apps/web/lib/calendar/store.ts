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
  url?: string;
  notes_ref?: string;
  /** email invites start pending until the calendar_add decision resolves */
  status?: "pending" | "confirmed";
}

function asEvent(value: unknown): CalendarEvent | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.starts_at !== "string"
  ) {
    return undefined;
  }
  return record as unknown as CalendarEvent;
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
    .map(asEvent)
    .filter((event): event is CalendarEvent => event !== undefined);
}

export interface BoxSource {
  id: string;
  provider: "apple_ics" | "calcom";
  /** apple_ics: the https ICS URL. calcom: the API key. Box-only (C4). */
  secret: string;
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
  // default (world-readable) permissions, even briefly.
  await command(
    boxId,
    `mkdir -p ${INBOX_DIR} && chmod 700 ${CALENDAR_DIR} && ` +
      `touch ${SOURCES_PATH} && chmod 600 ${SOURCES_PATH}`
  );
  let sources: BoxSource[] = [];
  try {
    const raw = await readFile(boxId, SOURCES_PATH);
    if (raw.trim() !== "") {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) sources = parsed as BoxSource[];
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
  await command(boxId, `chmod 600 ${SOURCES_PATH}`);
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
  const next = (parsed as BoxSource[]).filter(
    (entry) => entry.id !== sourceId
  );
  await writeFile(
    boxId,
    ".hermes/calendar/sources.json",
    JSON.stringify(next)
  );
  await command(boxId, `chmod 600 ${SOURCES_PATH}`);
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
  await command(boxId, `mkdir -p ${INBOX_DIR}`);
  await writeFile(boxId, relative, bytes.toString("base64"));
  await command(
    boxId,
    `base64 -d /home/user/${relative} > /home/user/${relative}.bin && mv /home/user/${relative}.bin /home/user/${relative}`
  );
  return `/home/user/${relative}`;
}
