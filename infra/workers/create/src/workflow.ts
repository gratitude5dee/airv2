/**
 * CreateJob (V13 §4) — one Workflow instance per create_jobs row (instance
 * id = row id). Steps per §4.2: admit → brief → snapshot-tests → code →
 * build → check → fix loop → publish → notify. Each step is a `step.do`
 * with the spec's retry table; every transition broadcasts
 * `{percent, step, detail, round, state}` to the job's OwnerRoom and
 * mirrors the same facts to the adapter (the row's only writer, CF2).
 *
 * Turn waits use `waitForEvent` in 30 s chunks so the `code` step can ride
 * its time curve 10 → 45% (§4.2); a chunk that times out is progress
 * creep, not failure — the wait's own deadline is `*_WAIT_S` env, and a
 * wait that fully expires just moves the job on (D2).
 */
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
} from "cloudflare:workers";
import {
  adapterBuild,
  adapterFacts,
  adapterNotify,
  adapterPublishDev,
  adapterTests,
  adapterTurn,
  AdapterError,
} from "./adapter";
import { runCheck, type CheckTest } from "./check";

export interface CreateJobParams {
  job_id: string;
  user_id: string;
  app_id: string;
  slug: string;
  appname: string;
  kind: "initial" | "change";
  /** Change jobs: the workspace file the code turn applies (§4.4). */
  change_file?: string;
}

const STEP_TABLE: Record<string, WorkflowStepConfig> = {
  admit: { retries: { limit: 3, delay: "5 seconds" }, timeout: "30 seconds" },
  brief: { retries: { limit: 1, delay: "5 seconds" }, timeout: "5 minutes" },
  snapshot: { retries: { limit: 3, delay: "5 seconds" }, timeout: "30 seconds" },
  code: { retries: { limit: 1, delay: "5 seconds" }, timeout: "5 minutes" },
  build: { retries: { limit: 2, delay: "10 seconds" }, timeout: "2 minutes" },
  publish: { retries: { limit: 3, delay: "10 seconds" }, timeout: "2 minutes" },
  notify: { retries: { limit: 3, delay: "10 seconds" }, timeout: "30 seconds" },
};

const WAIT_CHUNK_S = 30;
// §4.2: the code step's creep curve — 10 → 45 over the p50 floor of 60 s,
// extended over the full wait budget when no p50 is known server-side.
const CURVE_FROM = 10;
const CURVE_TO = 45;

type JobState =
  | "queued"
  | "running"
  | "live"
  | "stuck"
  | "cancelled"
  | "superseded"
  | "failed";

interface ProgressPayload {
  percent: number;
  step: string;
  detail: string;
  round: number;
  state: JobState;
  dev_url?: string;
  shot_url?: string;
}

export class CreateJob extends WorkflowEntrypoint<Env, CreateJobParams> {
  private async broadcast(
    params: CreateJobParams,
    payload: ProgressPayload
  ): Promise<void> {
    const room = this.env.OWNER_ROOM.get(this.env.OWNER_ROOM.idFromName(params.job_id));
    await room
      .fetch("https://room/broadcast", {
        method: "POST",
        body: JSON.stringify({ job: params.job_id, payload }),
      })
      .then(() => undefined)
      .catch(() => undefined);
  }

  /** Mirror a fact onto the job row (CF2) — best-effort, never throws. */
  private async mirror(
    params: CreateJobParams,
    fact: Parameters<typeof adapterFacts>[2]
  ): Promise<void> {
    await adapterFacts(this.env, params.job_id, fact).catch(() => undefined);
  }

  /** Broadcast + mirror in one call; the row and the sockets move together. */
  private async progress(
    params: CreateJobParams,
    payload: ProgressPayload
  ): Promise<void> {
    await this.broadcast(params, payload);
    await this.mirror(params, {
      state: payload.state,
      step: payload.step,
      percent: payload.percent,
      round: payload.round,
      ...(payload.dev_url !== undefined ? { dev_url: payload.dev_url } : {}),
    });
  }

  /**
   * Wait for `turn_done` up to `timeoutS`, broadcasting curve progress
   * between 30 s chunks. Returns the event payload or null on timeout (D2).
   */
  private async waitForTurn(
    step: WorkflowStep,
    params: CreateJobParams,
    name: string,
    timeoutS: number,
    round: number,
    detail: string
  ): Promise<{ outcome: string } | null> {
    const waited = 0;
    for (let at = 0; at < timeoutS; at += WAIT_CHUNK_S) {
      try {
        const event = await step.waitForEvent(`${name}:${at}`, {
          type: "turn_done",
          timeout: `${WAIT_CHUNK_S} seconds`,
        });
        return (event.payload ?? null) as { outcome: string } | null;
      } catch {
        // Chunk timeout = creep the curve; the turn is still running.
        const elapsed = at + WAIT_CHUNK_S;
        const span = Math.max(60, Math.min(timeoutS, 600));
        const t = Math.min(1, elapsed / span);
        const pct = Math.round(CURVE_FROM + (CURVE_TO - CURVE_FROM) * t);
        await this.progress(params, {
          percent: pct,
          step: name.startsWith("code") ? "code" : name.startsWith("fix") ? "fix" : "brief",
          detail,
          round,
          state: "running",
        });
      }
    }
    void waited;
    return null;
  }

  async run(event: WorkflowEvent<CreateJobParams>, step: WorkflowStep) {
    const params = event.payload;
    const jobId = params.job_id;
    const userRoom = this.env.OWNER_ROOM.get(
      this.env.OWNER_ROOM.idFromName(params.user_id)
    );
    const maxRounds = Number(this.env.MAX_FIX_ROUNDS ?? 3);
    const briefWaitS = Number(this.env.BRIEF_WAIT_S ?? 600);
    const codeWaitS = Number(this.env.CODE_WAIT_S ?? 720);
    const fixWaitS = Number(this.env.FIX_WAIT_S ?? 600);

    try {
      // 1 — admit: claim the owner's slot in OwnerRoom (or wait queued).
      await this.progress(params, {
        percent: 2,
        step: "admit",
        detail: "Starting",
        round: 0,
        state: "running",
      });
      let admitted = false;
      for (let attempt = 0; attempt < 120 && !admitted; attempt++) {
        const admission = await step.do(
          `admit:${attempt}`,
          STEP_TABLE.admit!,
          async () => {
            const response = await userRoom.fetch("https://room/admit", {
              method: "POST",
              body: JSON.stringify({ job: jobId, app: params.app_id }),
            });
            return (await response.json()) as { mode: string; superseded?: boolean };
          }
        );
        if (admission.mode === "start") admitted = true;
        else if (admission.mode === "superseded") {
          await this.progress(params, {
            percent: 2,
            step: "admit",
            detail: "Superseded",
            round: 0,
            state: "superseded",
          });
          return;
        } else {
          await step.sleep(`admit wait:${attempt}`, "10 seconds");
        }
      }
      if (!admitted) {
        await this.progress(params, {
          percent: 2,
          step: "admit",
          detail: "Timed out waiting for a slot",
          round: 0,
          state: "failed",
        });
        return;
      }

      // 2 — brief (initial only): write goal.md + tests on create-deep#plan.
      if (params.kind === "initial") {
        await this.progress(params, {
          percent: 5,
          step: "brief",
          detail: "Writing the brief",
          round: 0,
          state: "running",
        });
        const turn = await step.do("brief", STEP_TABLE.brief!, async () => {
          const started = await adapterTurn(this.env, {
            job_id: jobId,
            role: "brief",
            round: 0,
          });
          await userRoom
            .fetch("https://room/run", {
              method: "POST",
              body: JSON.stringify({ job: jobId, run_id: started.run_id }),
            })
            .catch(() => undefined);
          return started;
        });
        await this.waitForTurn(step, params, "brief", briefWaitS, 0, "Writing the brief");
        await this.progress(params, {
          percent: 10,
          step: "brief",
          detail: "Brief done",
          round: 0,
          state: "running",
        });
        void turn;

        // 3 — snapshot-tests: locked ids land on the job row.
        const tests = await step.do("snapshot-tests", STEP_TABLE.snapshot!, async () =>
          adapterTests(this.env, jobId)
        );
        await this.mirror(params, { locked_test_ids: tests.locked });
        this.envSnapshot = { tests };
      }

      let round = 0;
      let lastErrorRule: string | null = null;

      // 4 — code turn.
      await this.progress(params, {
        percent: 10,
        step: "code",
        detail: "Writing code",
        round,
        state: "running",
      });
      await step.do("code", STEP_TABLE.code!, async () => {
        const started = await adapterTurn(this.env, {
          job_id: jobId,
          role: "code",
          round,
          ...(params.change_file ? { change_file: params.change_file } : {}),
        });
        await userRoom
          .fetch("https://room/run", {
            method: "POST",
            body: JSON.stringify({ job: jobId, run_id: started.run_id }),
          })
          .catch(() => undefined);
        return started;
      });
      await this.waitForTurn(step, params, "code", codeWaitS, round, "Writing code");
      await this.progress(params, {
        percent: 50,
        step: "code",
        detail: "Code written",
        round,
        state: "running",
      });

      // 5 + 6 + 7 — build → check → fix loop.
      let published = false;
      while (!published) {
        await this.progress(params, {
          percent: 55,
          step: "build",
          detail: "Building",
          round,
          state: "running",
        });
        let build: { version: string | null; findings: { rule: string }[] };
        try {
          build = await step.do(`build:${round}`, STEP_TABLE.build!, async () =>
            adapterBuild(this.env, jobId)
          );
        } catch (error) {
          if (error instanceof AdapterError && error.status === 422) {
            build = { version: null, findings: [] };
          } else throw error;
        }
        if (build.version !== null) {
          await this.mirror(params, { version: build.version, percent: 60, step: "build" });
        }

        if (build.version === null || build.findings.some((f) => f.rule === "tests.locked-removed")) {
          const failedIds = build.findings.map((f) => f.rule);
          round += 1;
          if (round > maxRounds) {
            lastErrorRule = failedIds[0] ?? "build_failed";
            break;
          }
          await this.progress(params, {
            percent: 55,
            step: "fix",
            detail: `Fixing ${failedIds.length || 1} issue${(failedIds.length || 1) === 1 ? "" : "s"} (round ${round} of ${maxRounds})`,
            round,
            state: "running",
          });
          await step.do(`fix:${round}`, STEP_TABLE.code!, async () => {
            const started = await adapterTurn(this.env, {
              job_id: jobId,
              role: "fix",
              round,
              findings: failedIds,
            });
            await userRoom
              .fetch("https://room/run", {
                method: "POST",
                body: JSON.stringify({ job: jobId, run_id: started.run_id }),
              })
              .catch(() => undefined);
            return started;
          });
          await this.waitForTurn(step, params, `fix`, fixWaitS, round, `Fixing (round ${round} of ${maxRounds})`);
          continue;
        }

        // 6 — check: Browser Run smoke + locked tests on the candidate.
        await this.progress(params, {
          percent: 70,
          step: "check",
          detail: "Checking on a phone-sized screen",
          round,
          state: "running",
        });
        const knownTests = await this.testsFor(params);
        const check = await step.do(`check:${round}`, {
          retries: { limit: 2, delay: "15 seconds" },
          timeout: "3 minutes",
        }, async () =>
          runCheck(this.env, {
            jobId,
            slug: params.slug,
            version: build.version!,
            round,
            tests: knownTests,
          })
        );
        await this.mirror(params, { percent: 85, step: "check" });
        await adapterFacts(this.env, jobId, {}, {
          smoke: check.smoke,
          locked_passed: check.locked_passed,
          locked_total: check.locked_total,
          score: check.score,
          locked_failed_ids: check.locked_failed_ids,
        }).catch(() => undefined);
        await this.broadcast(params, {
          percent: 85,
          step: "check",
          detail: "Checked",
          round,
          state: "running",
          shot_url: check.shot_url,
        });

        const checkFailed = !check.smoke || check.locked_failed_ids.length > 0;
        if (checkFailed) {
          const failedIds = [...check.smoke_issues, ...check.locked_failed_ids];
          round += 1;
          if (round > maxRounds) {
            lastErrorRule = failedIds[0] ?? "check_failed";
            break;
          }
          await this.progress(params, {
            percent: 70,
            step: "fix",
            detail: `Fixing ${failedIds.length} issue${failedIds.length === 1 ? "" : "s"} (round ${round} of ${maxRounds})`,
            round,
            state: "running",
          });
          await step.do(`fix:${round}`, STEP_TABLE.code!, async () => {
            const started = await adapterTurn(this.env, {
              job_id: jobId,
              role: "fix",
              round,
              findings: failedIds,
            });
            await userRoom
              .fetch("https://room/run", {
                method: "POST",
                body: JSON.stringify({ job: jobId, run_id: started.run_id }),
              })
              .catch(() => undefined);
            return started;
          });
          await this.waitForTurn(step, params, `fix`, fixWaitS, round, `Fixing (round ${round} of ${maxRounds})`);
          continue;
        }

        // 8 — publish: the same version to <slug>-dev + the dev pointer.
        await this.progress(params, {
          percent: 90,
          step: "publish",
          detail: "Publishing your link",
          round,
          state: "running",
        });
        const published_ = await step.do("publish", STEP_TABLE.publish!, async () =>
          adapterPublishDev(this.env, jobId, build.version!)
        );
        await this.mirror(params, {
          percent: 99,
          step: "publish",
          version: build.version,
          dev_url: published_.dev_url,
        });
        await this.progress(params, {
          percent: 99,
          step: "publish",
          detail: "Published",
          round,
          state: "running",
          dev_url: published_.dev_url,
        });
        published = true;
      }

      if (!published) {
        // needs_you — terminal stuck state.
        await this.progress(params, {
          percent: 90,
          step: "check",
          detail: "I got stuck — tap to try again or tell me what to change",
          round,
          state: "stuck",
        });
        await this.mirror(params, { error_rule: lastErrorRule ?? "stuck" });
        await step.do("notify-stuck", STEP_TABLE.notify!, async () =>
          adapterNotify(this.env, jobId, "stuck")
        );
        return;
      }

      // 9 — notify + 100%.
      await step.do("notify", STEP_TABLE.notify!, async () =>
        adapterNotify(this.env, jobId, "live")
      );
      const devUrl = `https://${params.slug}.${this.env.DEV_ORIGIN_SUFFIX}/`;
      await this.progress(params, {
        percent: 100,
        step: "publish",
        detail: "Live",
        round,
        state: "live",
        dev_url: devUrl,
      });
    } catch (error) {
      const message = error instanceof AdapterError ? error.message : "worker_error";
      await this.mirror(params, {
        state: "failed",
        error_rule: typeof message === "string" ? message.slice(0, 120) : "worker_error",
      });
      await this.broadcast(params, {
        percent: 0,
        step: "failed",
        detail: "Something went wrong — tap to try again",
        round: 0,
        state: "failed",
      });
      await adapterNotify(this.env, jobId, "failed").catch(() => undefined);
      throw error;
    } finally {
      await userRoom
        .fetch("https://room/release", {
          method: "POST",
          body: JSON.stringify({ job: jobId }),
        })
        .catch(() => undefined);
    }
  }

  /** The tests snapshot taken at step 3 (initial jobs only). */
  private envSnapshot: { tests?: { ids: string[]; locked: string[]; tests?: CheckTest[] } } = {};

  /**
   * The DSL tests for the check step: the snapshot's full set when the job
   * snapshotted it, otherwise read live from the workspace (change jobs
   * skip step 3). Locked flags mark the gate.
   */
  private async testsFor(params: CreateJobParams): Promise<CheckTest[]> {
    const snap = this.envSnapshot.tests;
    const source = snap ?? (await adapterTests(this.env, params.job_id).catch(() => null));
    if (!source) return [];
    if (source.tests && source.tests.length > 0) {
      return source.tests.map((test) => ({
        ...test,
        locked: test.locked === true || source.locked.includes(test.id),
      }));
    }
    return source.ids.map((id) => ({ id, locked: source.locked.includes(id) }));
  }
}
