/**
 * Fleet sync engine: converge a channel's boxes to its release, in place,
 * with canary-first waves swept by the cron. Each box step downloads the
 * immutable artifact over a short-lived presigned URL, checks the sha256,
 * runs sync-box.sh (idempotent; preserves all user state), then the
 * verify-box.sh health gate. baseline_version is written only after the gate
 * passes. A failed canary or too many wave failures pauses the job — failed
 * boxes keep working on their old baseline.
 *
 * Rate-limit aware: boxes are processed a few per sweep tick (the platform
 * caps machine starts per minute), stopped boxes are resumed then re-stopped,
 * and boxes in an active conversation window are deferred to their idle
 * window rather than having services restarted under a live turn.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  command,
  getBox,
  isStartLimit,
  resume,
  stop,
  waitForBox,
  waitForHomeSteady,
} from "../box/client";
import { presignGet } from "../storage/r2";
import { FleetError, getRelease, type TemplateRelease } from "./releases";
import { getChannel, type ChannelName } from "./channels";

export const DEFAULT_WAVE_SIZE = 3;
// The box provider rejects command timeouts above 600 seconds, so every
// on-box step must fit in one 600s command; longer work is split into
// sequential commands (see hermesCommands).
const SYNC_TIMEOUT_SECONDS = 600;
const HERMES_STEP_TIMEOUT_SECONDS = 600;
const ARTIFACT_URL_TTL_SECONDS = 900;
// A claim is a lease. The sweep route is killed at maxDuration, and the one
// box command it may have had in flight keeps running on the box until the
// provider's cap kills it too, so a 'syncing' row whose started_at is older
// than both together has no live owner anywhere and is safe to hand back.
const SWEEP_MAX_DURATION_SECONDS = 800;
export const CLAIM_LEASE_MS =
  (SWEEP_MAX_DURATION_SECONDS +
    Math.max(SYNC_TIMEOUT_SECONDS, HERMES_STEP_TIMEOUT_SECONDS) +
    60) *
  1000;

export interface SyncJob {
  id: string;
  channel: ChannelName;
  release_id: string;
  state: "canary" | "rolling" | "paused" | "done" | "failed" | "aborted";
  include_hermes: boolean;
  wave_size: number;
  canary_box_ids: string[];
  failure_threshold: number;
  failures: number;
}

export interface StartSyncJobInput {
  channel: ChannelName;
  canaryBoxIds?: string[] | undefined;
  waveSize?: number | undefined;
  includeHermes?: boolean;
  failureThreshold?: number | undefined;
}

interface JobBoxRow {
  provider_box_id: string;
  is_canary: boolean;
}

const SYNCABLE_STATES = ["ready", "stopped"];

export async function startSyncJob(
  supabase: SupabaseClient,
  input: StartSyncJobInput,
): Promise<SyncJob> {
  const channel = await getChannel(supabase, input.channel);
  if (!channel.release_id) {
    throw new FleetError(`channel ${input.channel} has no release`, 409);
  }
  const { data: active } = await supabase
    .from("sync_jobs")
    .select("id")
    .in("state", ["canary", "rolling", "paused"])
    .limit(1);
  if ((active ?? []).length > 0) {
    throw new FleetError("a sync job is already in progress", 409);
  }
  const { data: boxes, error: boxError } = await supabase
    .from("boxes")
    .select("provider_box_id, state")
    .eq("channel", input.channel)
    .in("state", SYNCABLE_STATES);
  if (boxError) {
    throw new FleetError(`box list failed: ${boxError.message}`, 500);
  }
  const boxIds = (boxes ?? []).map((row) => row.provider_box_id as string);
  if (boxIds.length === 0) {
    throw new FleetError(`no syncable boxes on ${input.channel}`, 409);
  }
  const canaries = new Set(
    (input.canaryBoxIds ?? []).filter((id) => boxIds.includes(id)),
  );
  if ((input.canaryBoxIds ?? []).length > 0 && canaries.size === 0) {
    throw new FleetError(
      `no requested canary box is syncable on ${input.channel}`,
      409,
    );
  }
  const { data: job, error: jobError } = await supabase
    .from("sync_jobs")
    .insert({
      channel: input.channel,
      release_id: channel.release_id,
      state: canaries.size > 0 ? "canary" : "rolling",
      include_hermes: input.includeHermes ?? false,
      wave_size: input.waveSize ?? DEFAULT_WAVE_SIZE,
      canary_box_ids: [...canaries],
      failure_threshold: input.failureThreshold ?? 1,
    })
    .select()
    .single();
  if (jobError) {
    throw new FleetError(`job insert failed: ${jobError.message}`, 500);
  }
  const typedJob = job as SyncJob;
  const { error: rowError } = await supabase.from("sync_job_boxes").insert(
    boxIds.map((boxId) => ({
      job_id: typedJob.id,
      provider_box_id: boxId,
      is_canary: canaries.has(boxId),
    })),
  );
  if (rowError) {
    throw new FleetError(`job box insert failed: ${rowError.message}`, 500);
  }
  return typedJob;
}

export async function setJobState(
  supabase: SupabaseClient,
  jobId: string,
  state: "canary" | "rolling" | "paused" | "aborted",
): Promise<void> {
  const { error } = await supabase
    .from("sync_jobs")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("state", ["canary", "rolling", "paused"]);
  if (error) throw new FleetError(`job update failed: ${error.message}`, 500);
}

/** Resume a paused job into the right phase (canary if canaries remain). */
export async function resumeJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<void> {
  const { data: pendingCanary } = await supabase
    .from("sync_job_boxes")
    .select("provider_box_id")
    .eq("job_id", jobId)
    .eq("is_canary", true)
    .eq("state", "pending")
    .limit(1);
  const state = (pendingCanary ?? []).length > 0 ? "canary" : "rolling";
  const { error } = await supabase
    .from("sync_jobs")
    .update({ state, failures: 0, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("state", "paused");
  if (error) throw new FleetError(`job resume failed: ${error.message}`, 500);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** The on-box step: download, checksum, extract, sync, health-gate. */
export function syncCommand(release: TemplateRelease): string {
  const url = presignGet(release.artifact_key, ARTIFACT_URL_TTL_SECONDS);
  return [
    `curl -fsSL ${shellQuote(url)} -o /tmp/air-template.tgz`,
    `echo "${release.checksum}  /tmp/air-template.tgz" | sha256sum -c -`,
    "rm -rf /tmp/air-template && mkdir -p /tmp/air-template",
    "tar xzf /tmp/air-template.tgz -C /tmp/air-template",
    "bash /tmp/air-template/template/sync-box.sh",
    "bash /tmp/air-template/template/verify-box.sh",
  ].join(" && ");
}

/**
 * UPGRADE.md §2 in-place Hermes re-pin, gated on the release's hermes_ref.
 * Split into sequential commands so each fits the provider's 600s cap:
 * checkout, dependency install, then ref write + service restart.
 */
export function hermesCommands(hermesRef: string): string[] {
  return [
    [
      `cd ~/hermes-agent`,
      `git fetch --depth 1 origin ${shellQuote(hermesRef)}`,
      "git checkout --force FETCH_HEAD",
    ].join(" && "),
    [
      `cd ~/hermes-agent`,
      `UV_PROJECT_ENVIRONMENT=~/.hermes-venv uv pip install -e ".[all]" --python ~/.hermes-venv/bin/python`,
    ].join(" && "),
    [
      `cd ~/hermes-agent`,
      "git rev-parse HEAD > ~/.hermes/.template-hermes-ref",
      "sudo systemctl restart hermes-gateway hermes-dashboard hermes-host",
    ].join(" && "),
  ];
}

type BoxOutcome = "ok" | "failed" | "deferred";

async function syncOneBox(
  supabase: SupabaseClient,
  job: SyncJob,
  release: TemplateRelease,
  boxId: string,
): Promise<{ outcome: BoxOutcome; error?: string }> {
  const box = await getBox(boxId).catch(() => null);
  if (!box) return { outcome: "failed", error: "box lookup failed" };
  // Long-stopped boxes age into "archived" at the provider; resume() wakes
  // both, so treat archived like stopped rather than deferring forever.
  const wasStopped = box.state === "stopped" || box.state === "archived";
  if (box.state === "ready" || box.state === "idle") {
    // Active conversation window (stop_after in the future) — defer to the
    // idle window so services are not restarted under a live turn.
    const { data: row } = await supabase
      .from("boxes")
      .select("stop_after")
      .eq("provider_box_id", boxId)
      .maybeSingle();
    const stopAfter = row?.stop_after as string | null | undefined;
    if (stopAfter && Date.parse(stopAfter) > Date.now()) {
      return { outcome: "deferred" };
    }
  } else if (wasStopped) {
    try {
      await resume(boxId);
    } catch (error) {
      if (isStartLimit(error)) return { outcome: "deferred" };
      return { outcome: "failed", error: "resume failed" };
    }
  } else {
    return { outcome: "deferred" };
  }
  try {
    await waitForBox(boxId);
    // A resumed box comes back ready while its snapshot is still being
    // hydrated onto /home/user; sync-box.sh started inside that window is
    // killed when the platform swaps the real disk back in.
    if (wasStopped) await waitForHomeSteady(boxId);
    const result = await command(
      boxId,
      syncCommand(release),
      SYNC_TIMEOUT_SECONDS,
    );
    if (result.exitCode !== 0) {
      return {
        outcome: "failed",
        error: `sync exit ${result.exitCode}: ${result.stderr.slice(-500)}`,
      };
    }
    if (job.include_hermes && release.hermes_ref) {
      for (const step of hermesCommands(release.hermes_ref)) {
        const hermes = await command(boxId, step, HERMES_STEP_TIMEOUT_SECONDS);
        if (hermes.exitCode !== 0) {
          return {
            outcome: "failed",
            error: `hermes repin exit ${hermes.exitCode}: ${hermes.stderr.slice(-500)}`,
          };
        }
      }
      const verify = await command(
        boxId,
        "bash /tmp/air-template/template/verify-box.sh",
        SYNC_TIMEOUT_SECONDS,
      );
      if (verify.exitCode !== 0) {
        return {
          outcome: "failed",
          error: `post-repin verify exit ${verify.exitCode}: ${verify.stderr.slice(-500)}`,
        };
      }
    }
    await supabase
      .from("boxes")
      .update({
        baseline_version: release.version,
        baseline_synced_at: new Date().toISOString(),
        ...(job.include_hermes && release.hermes_ref
          ? { template_version: release.hermes_ref }
          : {}),
      })
      .eq("provider_box_id", boxId);
    return { outcome: "ok" };
  } finally {
    if (wasStopped) {
      await stop(boxId).catch(() => undefined);
    }
  }
}

/**
 * Move a wave's rows pending→syncing before any of them runs. Sweeps overlap
 * (a tick fires every minute, a box sync takes several), so the transition is
 * conditional on the row still being pending; a row another sweep already
 * took is dropped here rather than synced twice on the same box.
 */
async function claimWave(
  supabase: SupabaseClient,
  jobId: string,
  candidates: JobBoxRow[],
): Promise<JobBoxRow[]> {
  const claimed: JobBoxRow[] = [];
  try {
    for (const row of candidates) {
      const { data, error } = await supabase
        .from("sync_job_boxes")
        .update({ state: "syncing", started_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("provider_box_id", row.provider_box_id)
        .eq("state", "pending")
        .select("provider_box_id");
      if (error) {
        throw new FleetError(`wave claim failed: ${error.message}`, 500);
      }
      if ((data ?? []).length > 0) claimed.push(row);
    }
  } catch (error) {
    await releaseClaims(supabase, jobId, claimed);
    throw error;
  }
  return claimed;
}

/**
 * Hand back claims whose lease has expired: the invocation that took them was
 * killed before its cleanup ran, so the rows would otherwise sit in 'syncing'
 * forever and block every later sweep from advancing the job.
 */
async function reclaimExpiredLeases(
  supabase: SupabaseClient,
  jobId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - CLAIM_LEASE_MS).toISOString();
  const { data, error } = await supabase
    .from("sync_job_boxes")
    .update({ state: "pending", started_at: null })
    .eq("job_id", jobId)
    .eq("state", "syncing")
    .lt("started_at", cutoff)
    .select("provider_box_id");
  if (error) {
    throw new FleetError(`lease reclaim failed: ${error.message}`, 500);
  }
  for (const row of data ?? []) {
    console.warn(
      JSON.stringify({
        msg: "fleet sync claim expired",
        job_id: jobId,
        box_id: row.provider_box_id,
      }),
    );
  }
}

/**
 * Hand claimed rows that never ran (still 'syncing') back to 'pending' so a
 * resume or the next sweep can pick them up. Rows already finalized by this
 * sweep are untouched.
 */
async function releaseClaims(
  supabase: SupabaseClient,
  jobId: string,
  rows: JobBoxRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("sync_job_boxes")
    .update({ state: "pending", started_at: null })
    .eq("job_id", jobId)
    .eq("state", "syncing")
    .in(
      "provider_box_id",
      rows.map((row) => row.provider_box_id),
    );
  if (error) {
    throw new FleetError(`claim release failed: ${error.message}`, 500);
  }
}

/** True while the job is still canary/rolling; sweeps stop between boxes otherwise. */
async function jobActive(
  supabase: SupabaseClient,
  jobId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("state")
    .eq("id", jobId)
    .single();
  if (error || !data) {
    throw new FleetError(
      `job state read failed: ${error?.message ?? "no job"}`,
      500,
    );
  }
  return data.state === "canary" || data.state === "rolling";
}

/**
 * Add one to sync_jobs.failures with a compare-and-set loop, so sweeps that
 * run boxes side by side never overwrite each other's count. Returns the new
 * total.
 */
async function bumpFailures(
  supabase: SupabaseClient,
  jobId: string,
): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data: current, error: readError } = await supabase
      .from("sync_jobs")
      .select("failures")
      .eq("id", jobId)
      .single();
    if (readError || !current) {
      throw new FleetError(
        `failure count read failed: ${readError?.message ?? "no job"}`,
        500,
      );
    }
    const seen = current.failures as number;
    const { data: written, error: writeError } = await supabase
      .from("sync_jobs")
      .update({ failures: seen + 1, updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("failures", seen)
      .select("failures");
    if (writeError) {
      throw new FleetError(
        `failure count write failed: ${writeError.message}`,
        500,
      );
    }
    if ((written ?? []).length > 0) return seen + 1;
  }
  throw new FleetError("failure count contended", 500);
}

/**
 * One sweep tick of the active sync job: process up to wave_size boxes
 * (canaries first while in the canary phase), advance canary→rolling when
 * every canary passed, and pause the job when failures cross the threshold.
 * Returns counts for the sweep log.
 */
export async function runSyncJobs(
  supabase: SupabaseClient,
): Promise<{ synced: number; failed: number; deferred: number }> {
  const totals = { synced: 0, failed: 0, deferred: 0 };
  const { data: jobs } = await supabase
    .from("sync_jobs")
    .select()
    .in("state", ["canary", "rolling"])
    .order("created_at", { ascending: true })
    .limit(1);
  const job = (jobs ?? [])[0] as SyncJob | undefined;
  if (!job) return totals;
  const release = await getRelease(supabase, job.release_id);

  await reclaimExpiredLeases(supabase, job.id);

  let query = supabase
    .from("sync_job_boxes")
    .select("provider_box_id, is_canary")
    .eq("job_id", job.id)
    .eq("state", "pending")
    .limit(job.wave_size);
  if (job.state === "canary") query = query.eq("is_canary", true);
  const { data: pending } = await query;
  const rows = await claimWave(
    supabase,
    job.id,
    (pending ?? []) as JobBoxRow[],
  );

  if (rows.length === 0) {
    // A live 'syncing' row belongs to a sweep still inside its lease — don't
    // advance the phase past it; an expired one was handed back above.
    const { data: inFlight } = await supabase
      .from("sync_job_boxes")
      .select("provider_box_id")
      .eq("job_id", job.id)
      .eq("state", "syncing")
      .limit(1);
    if ((inFlight ?? []).length > 0) return totals;
    if (job.state === "canary") {
      const { data: badCanary } = await supabase
        .from("sync_job_boxes")
        .select("provider_box_id")
        .eq("job_id", job.id)
        .eq("is_canary", true)
        .eq("state", "failed")
        .limit(1);
      const next = (badCanary ?? []).length > 0 ? "failed" : "rolling";
      await supabase
        .from("sync_jobs")
        .update({ state: next, updated_at: new Date().toISOString() })
        .eq("id", job.id);
    } else {
      await supabase
        .from("sync_jobs")
        .update({ state: "done", updated_at: new Date().toISOString() })
        .eq("id", job.id);
    }
    return totals;
  }

  // `next` is the first claimed row this sweep has not finalized; whatever is
  // left from it on is released in `finally`, on every exit path.
  let next = 0;
  try {
    for (const [index, row] of rows.entries()) {
      next = index;
      if (!(await jobActive(supabase, job.id))) return totals;
      const boxId = row.provider_box_id;
      let outcome: BoxOutcome;
      let boxError: string | undefined;
      try {
        const result = await syncOneBox(supabase, job, release, boxId);
        outcome = result.outcome;
        boxError = result.error;
      } catch (error) {
        outcome = "failed";
        boxError = error instanceof Error ? error.message : "sync threw";
      }
      if (outcome === "deferred") {
        totals.deferred += 1;
        await supabase
          .from("sync_job_boxes")
          .update({ state: "pending", started_at: null })
          .eq("job_id", job.id)
          .eq("provider_box_id", boxId);
        continue;
      }
      await supabase
        .from("sync_job_boxes")
        .update({
          state: outcome,
          error: boxError ?? null,
          finished_at: new Date().toISOString(),
        })
        .eq("job_id", job.id)
        .eq("provider_box_id", boxId);
      if (outcome !== "failed") {
        totals.synced += 1;
        continue;
      }
      totals.failed += 1;
      const failures = await bumpFailures(supabase, job.id);
      console.error(
        JSON.stringify({
          msg: "fleet sync box failed",
          job_id: job.id,
          box_id: boxId,
          error: boxError ?? "unknown",
        }),
      );
      if (failures >= job.failure_threshold) {
        // Pause before releasing: once the job is off canary/rolling no sweep
        // claims (runSyncJobs only picks active jobs) and sweeps mid-wave stop
        // at their next jobActive check.
        await supabase
          .from("sync_jobs")
          .update({ state: "paused", updated_at: new Date().toISOString() })
          .eq("id", job.id)
          .in("state", ["canary", "rolling"]);
        next += 1;
        return totals;
      }
    }
    next = rows.length;
  } finally {
    await releaseClaims(supabase, job.id, rows.slice(next));
  }
  await supabase
    .from("sync_jobs")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", job.id);
  return totals;
}
