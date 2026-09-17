/**
 * V12 §8.2 progress relay (CR19: progress is derived, never self-reported).
 *
 * `percentFor` turns build / QA / test state into the `{ percent, stage,
 * detail }` triple the owner's card and the web Progress pane show — a
 * model's "I'm 80% done" is text, not state. `readProgress` gathers that
 * state (intake stage, latest build, the draft's version row); `relayTick`
 * pushes it to the owner's `app` card through `sendOrUpdateAppCard` (one
 * bubble per app, updated in place, tick ≥ CREATE_PROGRESS_TICK_MS) and
 * falls back to a text every CREATE_PROGRESS_TEXT_MS after three
 * consecutive failed card updates; `runProgressRelay` is the loop the flush
 * job runs while it owns the owner's open Create run (lane A wires it).
 *
 * Content-free throughout: names, stage words, percents, rule ids and
 * counts. Never a finding hint, a URL or a test's text.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import { sendOrUpdateAppCard } from "../miniapps/cards";
import type { RegistryApp } from "../miniapps/registry";
import { latestBuild, type BuildRecord } from "./build";
import { createConfig } from "./config";
import { isIntakeStage, type IntakeStage } from "./intake";
import { getVersion, type VersionRow } from "./versions";

/** §8.2 "p50 from the last 50 builds, floor 20 s". */
export const P50_BUILD_FLOOR_MS = 20_000;
/** With no succeeded build to learn from, a typical Kit build. */
export const P50_BUILD_DEFAULT_MS = 60_000;
export const P50_BUILD_SAMPLE = 50;

export interface Progress {
  percent: number;
  stage: IntakeStage;
  /** One short content-free line: a rule id, `retry 2/3`, `tests 3/4`. */
  detail: string | null;
}

export interface ProgressInput {
  /** `create_intakes.stage`; a missing row reads as `confirmed`. */
  stage: IntakeStage;
  /** The latest `create_builds` row for the app. */
  build: BuildRecord | null;
  /** The version row the build produced (or the draft), for QA/test state. */
  version: VersionRow | null;
  now: number;
  p50BuildMs: number;
  /** `air.json` + `src/main.tsx` exist in the workspace (scaffold written). */
  scaffold?: boolean;
  /** `create_intakes.failed_builds` — drives the `retry n/3` detail. */
  failedBuilds?: number;
  /** When the current stage began (`create_intakes.updated_at`); the QA and
   * test curves run from here. Falls back to the build's finish time. */
  stageSince?: number | null;
  /** The dev channel: promoting now, or already serving this version. */
  dev?: "none" | "deploying" | "live";
}

const PRE_CONFIRMED: ReadonlySet<IntakeStage> = new Set<IntakeStage>([
  "asking",
  "planning",
  "plan_sent",
  "revising",
]);
const PAST_DEV: ReadonlySet<IntakeStage> = new Set<IntakeStage>([
  "dev_ready",
  "finalizing",
  "decision_sent",
  "production",
]);
/** Stages the relay keeps ticking through (a `confirmed` intake is waiting
 * for its first build). */
export const RELAY_STAGES: ReadonlySet<IntakeStage> = new Set<IntakeStage>([
  "confirmed",
  "building",
  "qa",
  "testing",
]);

/** 0..1 along an elapsed-time curve that saturates at the p50. */
function curve(elapsedMs: number, p50Ms: number): number {
  const p50 = Math.max(P50_BUILD_FLOOR_MS, p50Ms);
  return Math.min(1, Math.max(0, elapsedMs) / p50);
}

function ramp(from: number, to: number, fraction: number): number {
  return Math.round(from + (to - from) * fraction);
}

function epoch(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The §8.2 table. Pure and monotonic in `now` for a fixed state; the
 * per-attempt hold (`holdMonotonic`) lives in the relay state, since a
 * retry legitimately resets to 15.
 */
export function percentFor(input: ProgressInput): Progress {
  const { stage, build, version, now } = input;
  if (PRE_CONFIRMED.has(stage) || stage === "abandoned") {
    return { percent: 0, stage, detail: null };
  }
  if (PAST_DEV.has(stage) || input.dev === "live") {
    return { percent: 100, stage: PAST_DEV.has(stage) ? stage : "dev_ready", detail: "dev live" };
  }
  const maxBuilds = createConfig.maxFailedBuilds();
  const failed = Math.max(0, input.failedBuilds ?? 0);
  const retry = failed > 0 ? `retry ${Math.min(failed + 1, maxBuilds)}/${maxBuilds}` : null;

  let derived: Progress;
  if (!build) {
    derived = input.scaffold
      ? { percent: 10, stage: "confirmed", detail: "scaffold written" }
      : { percent: 5, stage: "confirmed", detail: null };
  } else if (build.status === "queued") {
    derived = { percent: 15, stage: "building", detail: retry ?? "build queued" };
  } else if (build.status === "running") {
    const elapsed = now - (epoch(build.started_at) ?? now);
    derived = {
      percent: ramp(15, 40, curve(elapsed, input.p50BuildMs)),
      stage: "building",
      detail: retry ?? "build running",
    };
  } else if (build.status === "failed") {
    const hardFinding = build.findings.find((finding) => finding.severity === "hard");
    derived = hardFinding
      ? { percent: 45, stage: "building", detail: hardFinding.rule }
      : { percent: 15, stage: "building", detail: retry ?? "build failed" };
  } else {
    // succeeded: QA, then tests, then the dev deploy.
    const since = input.stageSince ?? epoch(build.finished_at) ?? now;
    const qaScore = version?.qa_score ?? null;
    const total = version?.tests_total ?? null;
    const passed = version?.tests_passed ?? null;
    if (qaScore === null) {
      derived = { percent: ramp(45, 65, curve(now - since, input.p50BuildMs)), stage: "qa", detail: "qa running" };
    } else if (total === null || passed === null) {
      derived =
        stage === "testing"
          ? { percent: ramp(65, 85, curve(now - since, input.p50BuildMs)), stage: "testing", detail: "tests running" }
          : { percent: 65, stage: "qa", detail: `qa ${qaScore}` };
    } else if (passed < total) {
      derived = { percent: 65, stage: "testing", detail: `tests ${passed}/${total}` };
    } else if (input.dev === "deploying") {
      derived = { percent: ramp(90, 99, curve(now - since, input.p50BuildMs)), stage: "testing", detail: "dev deploy" };
    } else {
      derived = { percent: 85, stage: "testing", detail: `tests ${passed}/${total}` };
    }
  }
  if (stage === "failed") {
    return { percent: derived.percent, stage: "failed", detail: derived.detail ?? "needs you" };
  }
  return derived;
}

/**
 * Median wall time of the owner's last 50 succeeded builds, floored at 20 s
 * (§8.2). No history → a typical Kit build.
 */
export async function p50BuildMs(supabase: SupabaseClient, userId: string): Promise<number> {
  let rows: { started_at?: unknown; finished_at?: unknown }[] = [];
  try {
    const { data, error } = await supabase
      .from("create_builds")
      .select("started_at, finished_at")
      .eq("user_id", userId)
      .eq("status", "succeeded")
      .order("started_at", { ascending: false })
      .limit(P50_BUILD_SAMPLE);
    if (!error && Array.isArray(data)) rows = data as typeof rows;
  } catch {
    rows = [];
  }
  const durations = rows
    .map((row) => {
      const started = epoch(typeof row.started_at === "string" ? row.started_at : null);
      const finished = epoch(typeof row.finished_at === "string" ? row.finished_at : null);
      return started !== null && finished !== null ? finished - started : null;
    })
    .filter((ms): ms is number => ms !== null && ms > 0)
    .sort((a, b) => a - b);
  if (durations.length === 0) return P50_BUILD_DEFAULT_MS;
  const middle = Math.floor(durations.length / 2);
  const median =
    durations.length % 2 === 1 ? durations[middle]! : (durations[middle - 1]! + durations[middle]!) / 2;
  return Math.max(P50_BUILD_FLOOR_MS, Math.round(median));
}

export interface ProgressSnapshot {
  progress: Progress;
  /** The intake's own stage, for the relay's stop rule. */
  intakeStage: IntakeStage;
  /** Changes with every build: the unit the monotonic hold applies to. */
  attemptKey: string | null;
  /** Newest state timestamp we saw (intake, build, version), ISO. */
  updated_at: string;
}

/**
 * The `GET /api/create/status`-equivalent read the relay and the Progress
 * pane share: intake stage (state column only — lane A owns the writer; no
 * row or no table reads as `confirmed`), the latest build and the version
 * row the build produced.
 */
export async function readProgress(
  supabase: SupabaseClient,
  userId: string,
  app: RegistryApp,
  options: { now?: number | undefined; p50BuildMs?: number | undefined } = {}
): Promise<ProgressSnapshot> {
  const now = options.now ?? Date.now();
  let intakeStage: IntakeStage = "confirmed";
  let failedBuilds = 0;
  let stageSince: number | null = null;
  let intakeUpdatedAt: string | null = null;
  if (app.appname) {
    try {
      const { data } = await supabase
        .from("create_intakes")
        .select("stage, failed_builds, updated_at")
        .eq("user_id", userId)
        .eq("appname", app.appname)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = (data ?? null) as { stage?: unknown; failed_builds?: unknown; updated_at?: unknown } | null;
      if (row && isIntakeStage(row.stage)) {
        intakeStage = row.stage;
        failedBuilds = typeof row.failed_builds === "number" ? row.failed_builds : 0;
        intakeUpdatedAt = typeof row.updated_at === "string" ? row.updated_at : null;
        stageSince = epoch(intakeUpdatedAt);
      }
    } catch {
      // No intake table or a transient read failure: derive from the build alone.
    }
  }
  const [build, p50] = await Promise.all([
    latestBuild(supabase, app.id),
    options.p50BuildMs !== undefined ? Promise.resolve(options.p50BuildMs) : p50BuildMs(supabase, userId),
  ]);
  const versionId = build?.version ?? app.draft_version ?? null;
  const version = versionId ? await getVersion(supabase, app.id, versionId) : null;
  const dev: ProgressInput["dev"] = versionId && app.dev_version === versionId ? "live" : "none";
  const progress = percentFor({
    stage: intakeStage,
    build,
    version,
    now,
    p50BuildMs: p50,
    failedBuilds,
    stageSince,
    dev,
  });
  const stamps = [intakeUpdatedAt, build?.finished_at ?? build?.started_at ?? null, version?.created_at ?? null]
    .map(epoch)
    .filter((ms): ms is number => ms !== null);
  const updated_at = new Date(stamps.length > 0 ? Math.max(...stamps) : now).toISOString();
  return { progress, intakeStage, attemptKey: build?.id ?? null, updated_at };
}

/* ------------------------------------------------------------ relay */

export interface RelayState {
  /** Build id the monotonic hold is scoped to. */
  attemptKey: string | null;
  lastPercent: number;
  /** Consecutive card updates that failed; ≥ 3 turns on the text fallback. */
  consecutiveFailures: number;
  lastTextAt: number | null;
  ticks: number;
}

export function newRelayState(): RelayState {
  return { attemptKey: null, lastPercent: 0, consecutiveFailures: 0, lastTextAt: null, ticks: 0 };
}

/**
 * §8.2 — percent never goes down within a build attempt; a new attempt
 * (a different build id) may reset it. Mutates and returns `state`.
 */
export function holdMonotonic(state: RelayState, progress: Progress, attemptKey: string | null): Progress {
  if (state.attemptKey !== attemptKey) {
    state.attemptKey = attemptKey;
    state.lastPercent = progress.percent;
    return progress;
  }
  if (progress.percent < state.lastPercent) {
    return { ...progress, percent: state.lastPercent };
  }
  state.lastPercent = progress.percent;
  return progress;
}

/** The caption's stage word: `dev_ready` → "dev ready", `failed` → "needs you" (§8.5). */
export function stageLabel(stage: IntakeStage): string {
  return stage === "failed" ? "needs you" : stage.replace(/_/g, " ");
}

export function progressCaption(name: string, progress: Progress): { caption: string; subcaption: string } {
  return {
    caption: `${name} · ${stageLabel(progress.stage)} · ${progress.percent}%`,
    subcaption: progress.detail ?? "",
  };
}

export type RelayOutcome = "updated" | "sent" | "cooldown" | "failed" | "text";

export interface RelayOwner {
  userId: string;
  spaceId: string;
  phone: string;
}

/**
 * One tick: hold the percent monotonic, then update (or first send) the
 * owner's `app` card with `<name> · <stage> · <percent>%` / detail. A thrown
 * update counts as `failed`; from the third consecutive failure on, a text
 * goes out instead, at most every CREATE_PROGRESS_TEXT_MS (0 disables).
 * Never throws: a relay must not take the flush job down with it.
 */
export async function relayTick(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  owner: RelayOwner,
  app: Pick<RegistryApp, "slug" | "name">,
  state: RelayState,
  snapshot: Pick<ProgressSnapshot, "progress" | "attemptKey">,
  now = Date.now(),
  textMs = createConfig.progressTextMs()
): Promise<RelayOutcome> {
  state.ticks += 1;
  const progress = holdMonotonic(state, snapshot.progress, snapshot.attemptKey);
  const { caption, subcaption } = progressCaption(app.name, progress);
  const summary = subcaption ? `${caption} — ${subcaption}` : caption;
  try {
    const outcome = await sendOrUpdateAppCard(supabase, owner, app.slug, { caption, subcaption, summary });
    state.consecutiveFailures = 0;
    return outcome;
  } catch (error) {
    state.consecutiveFailures += 1;
    console.warn(
      JSON.stringify({
        msg: "create progress card failed",
        user_id: owner.userId,
        slug: app.slug,
        consecutive: state.consecutiveFailures,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  }
  if (
    state.consecutiveFailures >= 3 &&
    textMs > 0 &&
    (state.lastTextAt === null || now - state.lastTextAt >= textMs)
  ) {
    try {
      await sender.sendText(owner.spaceId, owner.phone, summary);
      state.lastTextAt = now;
      return "text";
    } catch (error) {
      console.warn(
        JSON.stringify({
          msg: "create progress text failed",
          user_id: owner.userId,
          slug: app.slug,
          error: error instanceof Error ? error.message : "unknown",
        })
      );
    }
  }
  return "failed";
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

export interface RelayOptions {
  signal: AbortSignal;
  /** Defaults to CREATE_PROGRESS_TICK_MS. */
  tickMs?: number;
  /** State reader override (tests); defaults to `readProgress`. */
  read?: () => Promise<ProgressSnapshot>;
  /** Clock override (tests). */
  now?: () => number;
}

/**
 * The relay loop the flush job runs beside the owner's open Create run:
 * read state, tick the card, sleep one tick; stop when the intake leaves
 * `confirmed`/`building`/`qa`/`testing` or the signal fires. Returns the
 * final relay state (for logging). Lane A calls this from
 * lib/orchestrator/flush.ts.
 */
export async function runProgressRelay(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  owner: RelayOwner,
  app: RegistryApp,
  options: RelayOptions
): Promise<RelayState> {
  const state = newRelayState();
  const tickMs = options.tickMs ?? createConfig.progressTickMs();
  const now = options.now ?? Date.now;
  const p50 = options.read ? undefined : await p50BuildMs(supabase, owner.userId);
  const read =
    options.read ??
    (() => readProgress(supabase, owner.userId, app, { now: now(), p50BuildMs: p50 }));
  while (!options.signal.aborted) {
    let snapshot: ProgressSnapshot;
    try {
      snapshot = await read();
    } catch (error) {
      console.warn(
        JSON.stringify({
          msg: "create progress read failed",
          user_id: owner.userId,
          slug: app.slug,
          error: error instanceof Error ? error.message : "unknown",
        })
      );
      await sleep(tickMs, options.signal);
      continue;
    }
    await relayTick(supabase, sender, owner, app, state, snapshot, now());
    if (!RELAY_STAGES.has(snapshot.intakeStage)) break;
    await sleep(tickMs, options.signal);
  }
  return state;
}
