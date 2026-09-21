/**
 * V12 §8.1 Intake — the `/create` conversation's state row.
 *
 * `create_intakes` (migration 0116) holds where an intake is (§4 Stage),
 * which template the Planner picked, counters, content hashes and
 * timestamps. Nothing the owner typed — prompt, answers, plan, goal — ever
 * reaches this module's writes: that content lives in the owner's Box under
 * `~/.hermes/create/<appname>/` (CR21). The stage machine is a pure function
 * so the Planner (in air-main), the Build Service and the routes all agree
 * on what a legal move is; the iMessage hook here is the only place a
 * `/create <text>` opens a row, and it never short-circuits the agent turn
 * (the Planner runs in air-main, V11 §9.2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import { isReservedWord } from "../miniapps/reserved";
import {
  OWNER_ONLY_CARD_LINE,
  parseCreateIntent,
} from "../miniapps/imessageCommand";
import { createConfig } from "./config";

/* ------------------------------------------------------------ vocabulary */

/** §4 Stage — the row order is the golden path; the last two are terminal. */
export const INTAKE_STAGES = [
  "asking",
  "planning",
  "plan_sent",
  "revising",
  "confirmed",
  "building",
  "qa",
  "testing",
  "dev_ready",
  "finalizing",
  "decision_sent",
  "production",
  "abandoned",
  "failed",
] as const;
export type IntakeStage = (typeof INTAKE_STAGES)[number];

/** Stages the partial unique index treats as closed (§14.2 item 1). */
export const TERMINAL_STAGES: ReadonlySet<IntakeStage> = new Set<IntakeStage>([
  "production",
  "abandoned",
  "failed",
]);
export const OPEN_STAGES: readonly IntakeStage[] = INTAKE_STAGES.filter(
  (stage) => !TERMINAL_STAGES.has(stage)
);

/** Stages before any plan exists; `plan_version` is null there. */
const PRE_PLAN_STAGES: ReadonlySet<IntakeStage> = new Set<IntakeStage>(["asking", "planning"]);
/** The appname may still change (owner: "call it tour26") until `confirmed`. */
const RENAMABLE_STAGES: ReadonlySet<IntakeStage> = new Set<IntakeStage>([
  "asking",
  "planning",
  "plan_sent",
  "revising",
]);

export const INTAKE_TEMPLATES = ["landing", "store", "game-2d", "game-3d", "tool", "page"] as const;
export type IntakeTemplate = (typeof INTAKE_TEMPLATES)[number];

export const INTAKE_SOURCES = ["imessage", "web"] as const;
export type IntakeSource = (typeof INTAKE_SOURCES)[number];

export const INTAKE_EVENTS = [
  "owner_reply",
  "plan_written",
  "confirm",
  "revise",
  "cancel",
  "build_started",
  "build_ok",
  "qa_ok",
  "tests_ok",
  "dev_live",
  "ship",
  "finalize_complete",
  "decision_filed",
  "approved",
  "declined",
  "stop",
  "fail",
  "abandon",
] as const;
export type IntakeEvent = (typeof INTAKE_EVENTS)[number];

export function isIntakeStage(value: unknown): value is IntakeStage {
  return typeof value === "string" && (INTAKE_STAGES as readonly string[]).includes(value);
}
export function isIntakeEvent(value: unknown): value is IntakeEvent {
  return typeof value === "string" && (INTAKE_EVENTS as readonly string[]).includes(value);
}
export function isIntakeTemplate(value: unknown): value is IntakeTemplate {
  return typeof value === "string" && (INTAKE_TEMPLATES as readonly string[]).includes(value);
}
export function isIntakeSource(value: unknown): value is IntakeSource {
  return typeof value === "string" && (INTAKE_SOURCES as readonly string[]).includes(value);
}

/* --------------------------------------------------------------- errors */

export class IntakeError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "IntakeError";
    this.status = status;
  }
}

/** A move §5.1 does not list; routes answer 409 `illegal_transition`. */
export class IllegalTransitionError extends IntakeError {
  readonly from: IntakeStage;
  readonly event: IntakeEvent;
  constructor(from: IntakeStage, event: IntakeEvent) {
    super(`illegal_transition: ${from} + ${event}`, 409);
    this.name = "IllegalTransitionError";
    this.from = from;
    this.event = event;
  }
}

/* -------------------------------------------------------- stage machine */

/**
 * §5.1 transition table, one row per stage. `stop` (leaves the stage as is)
 * and `abandon` (the 7-day sweep) apply to every non-terminal stage and are
 * added in `nextStage` rather than listed fourteen times.
 */
const TRANSITIONS: Readonly<Record<IntakeStage, Readonly<Partial<Record<IntakeEvent, IntakeStage>>>>> = {
  asking: { owner_reply: "planning" },
  planning: { plan_written: "plan_sent" },
  plan_sent: { confirm: "confirmed", revise: "revising", cancel: "abandoned" },
  revising: {
    plan_written: "plan_sent",
    confirm: "confirmed",
    revise: "revising",
    cancel: "abandoned",
  },
  confirmed: { build_started: "building" },
  // A retried build stays in `building`; `fail` is the third consecutive
  // failure (advanceIntake counts the first two without moving).
  building: { build_started: "building", build_ok: "qa", fail: "failed", dev_live: "dev_ready" },
  qa: { qa_ok: "testing", fail: "failed", dev_live: "dev_ready" },
  testing: { tests_ok: "dev_ready", fail: "failed", dev_live: "dev_ready" },
  // "more edits" start a new build; the dev pointer moving again is a no-op.
  dev_ready: { ship: "finalizing", build_started: "building", dev_live: "dev_ready" },
  finalizing: { finalize_complete: "decision_sent", decision_filed: "decision_sent" },
  decision_sent: { approved: "production", declined: "dev_ready", decision_filed: "decision_sent" },
  production: {},
  abandoned: {},
  failed: {},
};

/** Pure §5.1 stage machine; throws `IllegalTransitionError` on any other move. */
export function nextStage(current: IntakeStage, event: IntakeEvent): IntakeStage {
  if (!TERMINAL_STAGES.has(current)) {
    if (event === "stop") return current;
    if (event === "abandon") return "abandoned";
  }
  const next = TRANSITIONS[current][event];
  if (!next) throw new IllegalTransitionError(current, event);
  return next;
}

/* ------------------------------------------------------------- appname */

/** Same shape `validateAppName` (lib/miniapps/publish.ts) enforces. */
const APPNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const APPNAME_MAX = 32;
const STOP_WORDS = new Set([
  "a", "an", "and", "app", "build", "can", "create", "for", "i", "in", "it", "make",
  "me", "my", "need", "of", "on", "or", "page", "please", "site", "that", "the",
  "this", "to", "want", "website", "with", "you",
]);

function assertAppName(appname: string): string {
  const name = appname.toLowerCase().trim();
  if (!APPNAME_PATTERN.test(name)) {
    throw new IntakeError("app name must be 1–32 lowercase letters, digits, or hyphens");
  }
  if (isReservedWord(name)) throw new IntakeError("that app name is reserved");
  return name;
}

function trimToAppName(raw: string): string {
  return raw
    .slice(0, APPNAME_MAX)
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * §8.1 provisional appname: ≤ 32 chars from the prompt's first meaningful
 * words, `validateAppName`-compatible, with a numeric suffix on collision
 * with anything in `taken` (the owner's apps and open intakes).
 */
export function provisionalAppname(prompt: string, taken: ReadonlySet<string>): string {
  const words = prompt
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .slice(0, 3);
  return uniqueAppname(trimToAppName(words.join("-")), taken);
}

/** `base` (or `my-app` when it is unusable) with a numeric suffix on collision. */
function uniqueAppname(candidate: string, taken: ReadonlySet<string>): string {
  const base =
    candidate && APPNAME_PATTERN.test(candidate) && !isReservedWord(candidate) ? candidate : "my-app";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${trimToAppName(base.slice(0, APPNAME_MAX - suffix.length))}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/* ----------------------------------------------------------------- rows */

export interface IntakeRow {
  id: string;
  user_id: string;
  app_id: string | null;
  appname: string | null;
  template: IntakeTemplate | null;
  stage: IntakeStage;
  source: IntakeSource;
  questions_asked: number;
  revisions: number;
  plan_sha256: string | null;
  goal_sha256: string | null;
  builds: number;
  failed_builds: number;
  mirror_error: string | null;
  opened_at: string;
  confirmed_at: string | null;
  dev_ready_at: string | null;
  production_at: string | null;
  last_owner_message_at: string | null;
  updated_at: string;
}

const INTAKE_COLUMNS =
  "id, user_id, app_id, appname, template, stage, source, questions_asked, revisions, " +
  "plan_sha256, goal_sha256, builds, failed_builds, mirror_error, opened_at, confirmed_at, " +
  "dev_ready_at, production_at, last_owner_message_at, updated_at";

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function int(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}

/** A row as PostgREST returns it, before validation. */
type RawIntakeRow = Partial<Record<keyof IntakeRow, unknown>>;

export function parseIntakeRow(raw: unknown): IntakeRow {
  const row = (raw ?? {}) as RawIntakeRow;
  const id = str(row.id);
  const userId = str(row.user_id);
  const openedAt = str(row.opened_at);
  const updatedAt = str(row.updated_at);
  if (!id || !userId || !openedAt || !updatedAt || !isIntakeStage(row.stage) || !isIntakeSource(row.source)) {
    throw new IntakeError("malformed intake row", 500);
  }
  return {
    id,
    user_id: userId,
    app_id: str(row.app_id),
    appname: str(row.appname),
    template: isIntakeTemplate(row.template) ? row.template : null,
    stage: row.stage,
    source: row.source,
    questions_asked: int(row.questions_asked),
    revisions: int(row.revisions),
    plan_sha256: str(row.plan_sha256),
    goal_sha256: str(row.goal_sha256),
    builds: int(row.builds),
    failed_builds: int(row.failed_builds),
    mirror_error: str(row.mirror_error),
    opened_at: openedAt,
    confirmed_at: str(row.confirmed_at),
    dev_ready_at: str(row.dev_ready_at),
    production_at: str(row.production_at),
    last_owner_message_at: str(row.last_owner_message_at),
    updated_at: updatedAt,
  };
}

/** The owner-facing view `GET /api/create/intake` returns (§14.1). */
export function intakeStatus(row: IntakeRow): {
  appname: string | null;
  stage: IntakeStage;
  template: IntakeTemplate | null;
  source: IntakeSource;
  questions_asked: number;
  revisions: number;
  plan_version: number | null;
  builds: number;
  failed_builds: number;
  timestamps: {
    opened_at: string;
    confirmed_at: string | null;
    dev_ready_at: string | null;
    production_at: string | null;
    last_owner_message_at: string | null;
    updated_at: string;
  };
} {
  return {
    appname: row.appname,
    stage: row.stage,
    template: row.template,
    source: row.source,
    questions_asked: row.questions_asked,
    revisions: row.revisions,
    plan_version: PRE_PLAN_STAGES.has(row.stage) ? null : row.revisions + 1,
    builds: row.builds,
    failed_builds: row.failed_builds,
    timestamps: {
      opened_at: row.opened_at,
      confirmed_at: row.confirmed_at,
      dev_ready_at: row.dev_ready_at,
      production_at: row.production_at,
      last_owner_message_at: row.last_owner_message_at,
      updated_at: row.updated_at,
    },
  };
}

/* ------------------------------------------------------------ database */

async function loadOpenIntake(
  supabase: SupabaseClient,
  userId: string,
  appname: string
): Promise<IntakeRow | null> {
  const { data, error } = await supabase
    .from("create_intakes")
    .select(INTAKE_COLUMNS)
    .eq("user_id", userId)
    .eq("appname", appname)
    .in("stage", OPEN_STAGES)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new IntakeError("could not look up the intake; try again", 503);
  return data ? parseIntakeRow(data) : null;
}

/** The latest intake for this app, open or closed; null when none exists. */
export async function getIntake(
  supabase: SupabaseClient,
  userId: string,
  appname: string
): Promise<IntakeRow | null> {
  const { data, error } = await supabase
    .from("create_intakes")
    .select(INTAKE_COLUMNS)
    .eq("user_id", userId)
    .eq("appname", assertAppName(appname))
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new IntakeError("could not look up the intake; try again", 503);
  return data ? parseIntakeRow(data) : null;
}

/** Names the provisional appname may not take: the owner's apps and open intakes. */
async function takenAppnames(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const [apps, intakes] = await Promise.all([
    supabase.from("mini_apps").select("appname").eq("owner_user_id", userId),
    supabase.from("create_intakes").select("appname").eq("user_id", userId).in("stage", OPEN_STAGES),
  ]);
  if (apps.error || intakes.error) {
    throw new IntakeError("could not look up existing apps; try again", 503);
  }
  const taken = new Set<string>();
  for (const row of [...(apps.data ?? []), ...(intakes.data ?? [])]) {
    const name = str((row as { appname?: unknown }).appname);
    if (name) taken.add(name);
  }
  return taken;
}

export interface OpenIntakeInput {
  source: IntakeSource;
  /** Only used to derive the provisional appname; never stored. */
  prompt?: string | null | undefined;
  /** A GitHub URL intake (§8.1); its repo name seeds the appname. Never stored. */
  url?: string | null | undefined;
  appname?: string | null | undefined;
  template?: IntakeTemplate | null | undefined;
}

/**
 * Open a `create_intakes` row at `asking`. The prompt and URL only seed the
 * provisional appname; the row records state and counters (CR21).
 */
export async function openIntake(
  supabase: SupabaseClient,
  userId: string,
  input: OpenIntakeInput
): Promise<IntakeRow> {
  let appname: string;
  if (input.appname) {
    appname = assertAppName(input.appname);
    if (await loadOpenIntake(supabase, userId, appname)) {
      throw new IntakeError("an intake for this app is already open", 409);
    }
  } else {
    const taken = await takenAppnames(supabase, userId);
    const prompt = (input.prompt ?? "").trim();
    // A URL-only intake is named after the repository, kept literally.
    const repo = /github\.com\/[^/\s]+\/([^/\s]+)/.exec(input.url ?? "")?.[1] ?? "";
    appname = prompt
      ? provisionalAppname(prompt, taken)
      : uniqueAppname(trimToAppName(repo.toLowerCase().replace(/[^a-z0-9]+/g, "-")), taken);
  }
  const { data: app, error: appError } = await supabase
    .from("mini_apps")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("appname", appname)
    .maybeSingle();
  if (appError) throw new IntakeError("could not look up the app; try again", 503);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("create_intakes")
    .insert({
      user_id: userId,
      app_id: str((app as { id?: unknown } | null)?.id),
      appname,
      template: input.template ?? null,
      stage: "asking",
      source: input.source,
      last_owner_message_at: now,
      updated_at: now,
    })
    .select(INTAKE_COLUMNS)
    .single();
  if (error || !data) {
    const conflict = (error as { code?: string } | null)?.code === "23505";
    throw new IntakeError(
      conflict ? "an intake for this app is already open" : "could not open the intake; try again",
      conflict ? 409 : 503
    );
  }
  const row = parseIntakeRow(data);
  console.log(
    JSON.stringify({ msg: "create intake opened", user_id: userId, appname, source: input.source })
  );
  return row;
}

/** Metadata the Planner/Build Service may stamp alongside an event. */
export interface IntakePatch {
  template?: IntakeTemplate | null;
  questions_asked?: number;
  plan_sha256?: string | null;
  goal_sha256?: string | null;
  app_id?: string | null;
  /** Only honoured before `confirmed` (§8.1: the name is fixed after that). */
  appname?: string;
  mirror_error?: string | null;
}

const SHA256_RE = /^[0-9a-f]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizePatch(patch: IntakePatch, stage: IntakeStage): RawIntakeRow {
  const out: RawIntakeRow = {};
  if ("template" in patch) {
    if (patch.template !== null && !isIntakeTemplate(patch.template)) {
      throw new IntakeError("unknown template");
    }
    out.template = patch.template;
  }
  if (patch.questions_asked !== undefined) {
    const n = patch.questions_asked;
    if (!Number.isInteger(n) || n < 0 || n > createConfig.intakeMaxQuestions()) {
      throw new IntakeError("questions_asked out of range");
    }
    out.questions_asked = n;
  }
  for (const key of ["plan_sha256", "goal_sha256"] as const) {
    if (key in patch) {
      const value = patch[key];
      if (value !== null && !(typeof value === "string" && SHA256_RE.test(value))) {
        throw new IntakeError(`${key} must be a sha256 hex digest`);
      }
      out[key] = value;
    }
  }
  if ("app_id" in patch) {
    if (patch.app_id !== null && !(typeof patch.app_id === "string" && UUID_RE.test(patch.app_id))) {
      throw new IntakeError("app_id must be a uuid");
    }
    out.app_id = patch.app_id;
  }
  if (patch.appname !== undefined) {
    if (!RENAMABLE_STAGES.has(stage)) {
      throw new IntakeError("the app name is fixed once the plan is confirmed", 409);
    }
    out.appname = assertAppName(patch.appname);
  }
  if ("mirror_error" in patch) {
    const value = patch.mirror_error;
    if (value !== null && typeof value !== "string") throw new IntakeError("mirror_error must be text");
    out.mirror_error = value === null ? null : value.slice(0, 200);
  }
  return out;
}

/** Events the owner utters or taps; each stamps `last_owner_message_at`. */
const OWNER_EVENTS: ReadonlySet<IntakeEvent> = new Set<IntakeEvent>([
  "owner_reply",
  "confirm",
  "revise",
  "cancel",
  "ship",
  "approved",
  "declined",
  "stop",
]);

/**
 * Apply one §5.1 event to the open intake for `appname`: the stage moves
 * per `nextStage`, counters and timestamps follow the event, and `patch`
 * lands after validation. Optimistic on the stage the caller saw (409 on a
 * race). `fail` counts a failed build and only moves to `failed` at
 * `CREATE_MAX_FAILED_BUILDS` consecutive failures (§8.5); `build_ok` resets
 * the streak. `revise` past `CREATE_PLAN_MAX_REVISIONS` is refused (409).
 */
export async function advanceIntake(
  supabase: SupabaseClient,
  userId: string,
  appname: string,
  event: IntakeEvent,
  patch: IntakePatch = {}
): Promise<IntakeRow> {
  const row = await loadOpenIntake(supabase, userId, assertAppName(appname));
  if (!row) throw new IntakeError("intake not found", 404);
  if (event === "revise" && row.revisions >= createConfig.planMaxRevisions()) {
    throw new IntakeError("revision_limit", 409);
  }
  let stage = nextStage(row.stage, event);
  const now = new Date().toISOString();
  const update: RawIntakeRow = { updated_at: now };
  if (OWNER_EVENTS.has(event)) update.last_owner_message_at = now;
  switch (event) {
    case "revise":
      update.revisions = row.revisions + 1;
      break;
    case "build_started":
      update.builds = row.builds + 1;
      break;
    case "build_ok":
      update.failed_builds = 0;
      break;
    case "fail": {
      const failed = row.failed_builds + 1;
      update.failed_builds = failed;
      if (failed < createConfig.maxFailedBuilds()) stage = row.stage;
      break;
    }
    default:
      break;
  }
  if (stage === "confirmed" && row.stage !== "confirmed") update.confirmed_at = now;
  if (stage === "dev_ready" && row.dev_ready_at === null) update.dev_ready_at = now;
  if (stage === "production") update.production_at = now;
  update.stage = stage;
  Object.assign(update, sanitizePatch(patch, row.stage));

  const { data, error } = await supabase
    .from("create_intakes")
    .update(update)
    .eq("id", row.id)
    .eq("stage", row.stage)
    .select(INTAKE_COLUMNS)
    .maybeSingle();
  if (error) throw new IntakeError("could not advance the intake; try again", 503);
  if (!data) throw new IntakeError("the intake moved underneath you; reload", 409);
  const next = parseIntakeRow(data);
  console.log(
    JSON.stringify({
      msg: "create intake advanced",
      user_id: userId,
      appname: next.appname,
      from: row.stage,
      event,
      stage: next.stage,
    })
  );
  return next;
}

/**
 * §5.1: an intake with no owner message for `olderThanDays` is `abandoned`
 * (draft kept, dev release untouched). Returns how many rows moved. The
 * cron wiring lives with the other sweeps; this only exposes the sweep.
 */
export async function abandonStale(
  supabase: SupabaseClient,
  olderThanDays: number = createConfig.intakeAbandonDays()
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("create_intakes")
    .update({ stage: "abandoned", updated_at: new Date().toISOString() })
    .in("stage", OPEN_STAGES)
    .lt("last_owner_message_at", cutoff)
    .select("id");
  if (error) throw new IntakeError("could not sweep stale intakes", 503);
  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(JSON.stringify({ msg: "create intakes abandoned", count, older_than_days: olderThanDays }));
  }
  return count;
}

/* -------------------------------------------------------- iMessage hook */

/**
 * The one line prepended to the agent turn's input so the create-miniapp
 * skill knows which intake it is planning for (§8.1). Content-free: the
 * prompt itself follows as the owner's own message.
 */
export function intakeHookInput(appname: string, questionsMax: number): string {
  return `[create-intake ${appname} stage=asking questions_max=${questionsMax}]`;
}

export type IntakeHookResult =
  | { kind: "owner"; appname: string; line: string }
  | { kind: "non_owner" };

/**
 * flush.ts hook for `/create <text>`: null when the burst is not a create
 * command (or the row could not be opened — the turn still runs, without
 * the marker), `non_owner` after the owner-only line was sent to a tier ≠ 0
 * sender, or the marker line the owner's turn should carry.
 */
export async function maybeOpenIntake(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  job: { spaceId: string; userId: string; phone: string; senderTier: number | null },
  input: string
): Promise<IntakeHookResult | null> {
  let parsed: ReturnType<typeof parseCreateIntent>;
  try {
    parsed = parseCreateIntent(input);
  } catch {
    return null;
  }
  if (!parsed) return null;
  if (job.senderTier !== 0) {
    await sender.sendText(job.spaceId, job.phone, OWNER_ONLY_CARD_LINE).catch(() => undefined);
    return { kind: "non_owner" };
  }
  try {
    const row = await openIntake(supabase, job.userId, {
      source: "imessage",
      prompt: parsed.prompt,
      url: parsed.url,
    });
    const appname = row.appname ?? "";
    return {
      kind: "owner",
      appname,
      line: intakeHookInput(appname, createConfig.intakeMaxQuestions()),
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "create intake open failed",
        user_id: job.userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return null;
  }
}
