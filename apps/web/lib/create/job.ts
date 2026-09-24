/**
 * V13 §10 `create_jobs` — the row a CreateJob Workflow mirrors itself into.
 * The job (Cloudflare) is the only writer of pipeline facts (CF2/D3); this
 * module is the control-plane side that creates the row, hands the job to
 * `CREATE_JOBS_ORIGIN` (CF1-signed), and exposes the owner-facing reads the
 * studio and the live-token mint need.
 *
 * Nothing here stores prompt, plan, goal or code text (CF5): the row holds
 * ids, counters, step names, rule ids, timings and percents.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { bridgePost } from "./bridge";
import { createConfig } from "./config";

export const JOB_KINDS = ["initial", "change"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATES = [
  "queued",
  "running",
  "live",
  "stuck",
  "cancelled",
  "superseded",
  "failed",
] as const;
export type JobState = (typeof JOB_STATES)[number];

export const OPEN_JOB_STATES: ReadonlySet<JobState> = new Set<JobState>(["queued", "running"]);
export const TERMINAL_JOB_STATES: ReadonlySet<JobState> = new Set<JobState>([
  "live",
  "stuck",
  "cancelled",
  "superseded",
  "failed",
]);

export function isJobKind(value: unknown): value is JobKind {
  return value === "initial" || value === "change";
}
export function isJobState(value: unknown): value is JobState {
  return typeof value === "string" && (JOB_STATES as readonly string[]).includes(value);
}

export interface JobRow {
  id: string;
  user_id: string;
  app_id: string;
  intake_id: string | null;
  kind: JobKind;
  state: JobState;
  step: string | null;
  step_started_at: string | null;
  percent: number;
  round: number;
  workflow_id: string | null;
  version: string | null;
  dev_url: string | null;
  locked_test_ids: string[];
  error_rule: string | null;
  skill_ver: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export const JOB_COLUMNS =
  "id, user_id, app_id, intake_id, kind, state, step, step_started_at, percent, round, workflow_id, " +
  "version, dev_url, locked_test_ids, error_rule, skill_ver, created_at, started_at, " +
  "finished_at, updated_at";

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null;
}

export function parseJobRow(raw: unknown): JobRow {
  const row = (raw ?? {}) as Partial<Record<keyof JobRow, unknown>>;
  const id = str(row.id);
  const userId = str(row.user_id);
  const appId = str(row.app_id);
  const createdAt = str(row.created_at);
  const updatedAt = str(row.updated_at);
  if (!id || !userId || !appId || !createdAt || !updatedAt) {
    throw new Error("malformed create_jobs row");
  }
  return {
    id,
    user_id: userId,
    app_id: appId,
    intake_id: str(row.intake_id),
    kind: isJobKind(row.kind) ? row.kind : "initial",
    state: isJobState(row.state) ? row.state : "queued",
    step: str(row.step),
    step_started_at: str(row.step_started_at),
    percent: Math.min(100, Math.max(0, num(row.percent) ?? 0)),
    round: num(row.round) ?? 0,
    workflow_id: str(row.workflow_id),
    version: str(row.version),
    dev_url: str(row.dev_url),
    locked_test_ids: Array.isArray(row.locked_test_ids)
      ? row.locked_test_ids.filter((v): v is string => typeof v === "string")
      : [],
    error_rule: str(row.error_rule),
    skill_ver: num(row.skill_ver),
    created_at: createdAt,
    started_at: str(row.started_at),
    finished_at: str(row.finished_at),
    updated_at: updatedAt,
  };
}

export class JobError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rule?: string
  ) {
    super(message);
    this.name = "JobError";
  }
}

/** Owner-facing view the studio and mini-app read. */
export function jobView(row: JobRow): {
  id: string;
  app_id: string;
  kind: JobKind;
  state: JobState;
  step: string | null;
  step_started_at: string | null;
  percent: number;
  round: number;
  dev_url: string | null;
  error_rule: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
} {
  return {
    id: row.id,
    app_id: row.app_id,
    kind: row.kind,
    state: row.state,
    step: row.step,
    step_started_at: row.step_started_at,
    percent: row.percent,
    round: row.round,
    dev_url: row.dev_url,
    error_rule: row.error_rule,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
  };
}

export async function getJob(
  supabase: SupabaseClient,
  jobId: string
): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from("create_jobs")
    .select(JOB_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new JobError("could not look up the job; try again", 503);
  return data ? parseJobRow(data) : null;
}

/** The owner's latest job for one app (any state) — for the studio. */
export async function latestJobForApp(
  supabase: SupabaseClient,
  userId: string,
  appId: string
): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from("create_jobs")
    .select(JOB_COLUMNS)
    .eq("user_id", userId)
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new JobError("could not look up the job; try again", 503);
  return data ? parseJobRow(data) : null;
}

export interface InsertJobInput {
  userId: string;
  appId: string;
  intakeId: string | null;
  kind: JobKind;
  skillVer: number | null;
}

/** Insert a queued job row. The Workflow is started by `startJob`. */
export async function insertJob(
  supabase: SupabaseClient,
  input: InsertJobInput
): Promise<JobRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("create_jobs")
    .insert({
      user_id: input.userId,
      app_id: input.appId,
      intake_id: input.intakeId,
      kind: input.kind,
      skill_ver: input.skillVer,
      created_at: now,
      updated_at: now,
    })
    .select(JOB_COLUMNS)
    .single();
  if (error || !data) {
    throw new JobError("could not create the job; try again", 503);
  }
  return parseJobRow(data);
}

/** Facts the job reports (CF2): state, step, percent, round, version, dev_url, error_rule. */
export interface JobFactPatch {
  state?: JobState;
  step?: string | null;
  percent?: number;
  round?: number;
  version?: string | null;
  dev_url?: string | null;
  error_rule?: string | null;
  locked_test_ids?: string[];
}

/**
 * Mirror one pipeline fact onto the job row. Percent is monotonic within a
 * job (D3): a write that would lower it (other than a retry's reset through
 * `state` → 'running' with round bump, which the job orders itself) keeps
 * the stored value. Terminal states stamp `finished_at`.
 */
export async function applyJobFact(
  supabase: SupabaseClient,
  jobId: string,
  patch: JobFactPatch
): Promise<JobRow> {
  const row = await getJob(supabase, jobId);
  if (!row) throw new JobError("job not found", 404);
  const now = new Date().toISOString();
  const update: Partial<JobRow> = { updated_at: now };
  if (patch.state !== undefined && patch.state !== row.state) {
    update.state = patch.state;
    if (patch.state === "running" && row.started_at === null) update.started_at = now;
    if (TERMINAL_JOB_STATES.has(patch.state)) update.finished_at = now;
  }
  if (patch.step !== undefined && patch.step !== row.step) {
    update.step = patch.step;
    update.step_started_at = now;
  }
  if (patch.percent !== undefined) {
    const pct = Math.min(100, Math.max(0, Math.trunc(patch.percent)));
    update.percent = Math.max(row.percent, pct);
  }
  if (patch.round !== undefined) update.round = Math.max(0, Math.trunc(patch.round));
  if (patch.version !== undefined) update.version = patch.version;
  if (patch.dev_url !== undefined) update.dev_url = patch.dev_url;
  if (patch.error_rule !== undefined) {
    // Ids only — cap and strip whitespace so no sentence ever lands (CF5).
    const rule = patch.error_rule === null ? null : patch.error_rule.replace(/\s+/g, " ").slice(0, 120);
    update.error_rule = rule;
  }
  if (patch.locked_test_ids !== undefined) {
    update.locked_test_ids = patch.locked_test_ids
      .filter((id) => typeof id === "string")
      .map((id) => id.slice(0, 64));
  }
  const { data, error } = await supabase
    .from("create_jobs")
    .update(update)
    .eq("id", jobId)
    .select(JOB_COLUMNS)
    .maybeSingle();
  if (error) throw new JobError("could not record the job state; try again", 503);
  if (!data) throw new JobError("job not found", 404);
  return parseJobRow(data);
}

/** Parameters the Workflow instance is created with (id = job row id). */
export interface WorkflowParams {
  job_id: string;
  user_id: string;
  app_id: string;
  slug: string;
  appname: string;
  kind: JobKind;
  change_file?: string;
}

/**
 * Hand a queued job to `air-create`: `POST /v1/jobs` creates the Workflow
 * instance (id = job id) and registers it with the OwnerRoom queue. Returns
 * the worker's answer; throws BridgeError when the lane is off or refuses.
 */
export async function startJobWorkflow(params: WorkflowParams): Promise<{ ok: boolean }> {
  return bridgePost<{ ok: boolean }>("/v1/jobs", { ...params });
}

/** Terminate a running/queued job on the Workflow side (§4.4 cancel). */
export async function terminateJobWorkflow(jobId: string): Promise<{ ok: boolean }> {
  return bridgePost<{ ok: boolean }>(`/v1/jobs/${jobId}/cancel`, {});
}

/** The dev origin for one slug (CF3): `https://<slug>.dev.wzrd.tech/`. */
export function devLinkUrl(slug: string): string {
  return `https://${slug}.${createConfig.devOriginSuffix()}/`;
}
