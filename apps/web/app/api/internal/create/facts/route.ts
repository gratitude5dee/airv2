/**
 * V13 §9.1 `POST /api/internal/create/facts` — the job's mirror into
 * Supabase (CF2): pipeline facts (`job`) land on `create_jobs`, and the
 * check step's result (`check`) stamps the version row and advances the
 * intake the V12 funnel still reads (D3, §10).
 *
 * Body: `{job_id, job?, check?}` where `check` is
 * `{smoke, locked_passed, locked_total, score, locked_failed_ids?}` —
 * counters, booleans and ids only (CF5).
 */
import type { NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { adapterErrorResponse, adapterJob, AdapterError } from "@/lib/create/adapter";
import { applyJobFact, isJobState, type JobFactPatch } from "@/lib/create/job";
import {
  advanceIntake,
  IntakeError,
  type IntakeEvent,
} from "@/lib/create/intake";
import { getRegistryAppById } from "@/lib/miniapps/registry";
import { recordCheckScore, QaError } from "@/lib/create/qa";
import { TestResultsSchema } from "@/lib/create/tests";

export const maxDuration = 60;

const STEP_RE = /^[a-z0-9_-]{1,40}$/;
const ID_RE = /^[a-z0-9._-]{1,64}$/i;

function jobFactPatch(value: unknown): JobFactPatch {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Partial<Record<keyof JobFactPatch, unknown>>;
  const patch: JobFactPatch = {};
  if (raw.state !== undefined) {
    if (!isJobState(raw.state)) throw new AdapterError("invalid job.state", 400);
    patch.state = raw.state;
  }
  if (raw.step !== undefined) {
    if (raw.step !== null && (typeof raw.step !== "string" || !STEP_RE.test(raw.step))) {
      throw new AdapterError("invalid job.step", 400);
    }
    patch.step = raw.step as string | null;
  }
  for (const key of ["percent", "round"] as const) {
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== "number" || !Number.isFinite(raw[key])) {
        throw new AdapterError(`invalid job.${key}`, 400);
      }
      patch[key] = raw[key] as number;
    }
  }
  for (const key of ["version", "dev_url", "error_rule"] as const) {
    if (raw[key] !== undefined) {
      const v = raw[key];
      if (v !== null && (typeof v !== "string" || v.length > 300)) {
        throw new AdapterError(`invalid job.${key}`, 400);
      }
      patch[key] = v as string | null;
    }
  }
  if (raw.locked_test_ids !== undefined) {
    if (!Array.isArray(raw.locked_test_ids) || raw.locked_test_ids.length > 40) {
      throw new AdapterError("invalid job.locked_test_ids", 400);
    }
    patch.locked_test_ids = raw.locked_test_ids.filter(
      (id): id is string => typeof id === "string" && ID_RE.test(id)
    );
  }
  return patch;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = serviceClient();
    const { job, body } = await adapterJob<{
      job_id?: unknown;
      job?: unknown;
      check?: {
        smoke?: unknown;
        locked_passed?: unknown;
        locked_total?: unknown;
        score?: unknown;
        locked_failed_ids?: unknown;
      };
    }>(supabase, request);

    const patch = jobFactPatch(body.job);
    if (Object.keys(patch).length > 0) {
      await applyJobFact(supabase, job.id, patch);
    }

    const check = body.check;
    if (check !== undefined && check !== null) {
      const score =
        typeof check.score === "number" && Number.isFinite(check.score)
          ? check.score
          : null;
      const version = patch.version ?? job.version;
      if (score === null || !version) {
        throw new AdapterError("check needs a score and a built version", 409);
      }

      // Tests counts stamp only when the failed ids are honest — a locked
      // set that didn't all pass without its failing ids can't satisfy
      // TestResultsSchema, so the counts stay unset rather than fabricated.
      const total = typeof check.locked_total === "number" ? check.locked_total : 0;
      const passed = typeof check.locked_passed === "number" ? check.locked_passed : 0;
      const failedIds = Array.isArray(check.locked_failed_ids)
        ? check.locked_failed_ids.filter(
            (id): id is string => typeof id === "string" && ID_RE.test(id)
          )
        : [];
      let tests = null;
      if (total === 0 || (passed === total && failedIds.length === 0)) {
        tests = TestResultsSchema.parse({ total, passed, failed_ids: [] });
      } else if (failedIds.length === total - passed) {
        tests = TestResultsSchema.parse({ total, passed, failed_ids: failedIds });
      }
      try {
        await recordCheckScore(supabase, job.app_id, version, score, tests);
      } catch (error) {
        if (error instanceof QaError) throw new AdapterError(error.message, error.status);
        throw error;
      }

      // The intake mirror is best-effort: a stage that has already moved on
      // (retry, supersede, intake closed) logs rather than fails the write.
      const app = await getRegistryAppById(supabase, job.app_id).catch(() => null);
      const events: IntakeEvent[] = [
        check.smoke === true ? "qa_ok" : check.smoke === false ? "fail" : null,
        total > 0 ? (passed === total ? "tests_ok" : "fail") : null,
      ].filter((event): event is IntakeEvent => event !== null);
      if (app?.appname) {
        for (const event of events) {
          try {
            await advanceIntake(supabase, job.user_id, app.appname, event, { app_id: job.app_id });
          } catch (error) {
            if (!(error instanceof IntakeError)) throw error;
            console.log(
              JSON.stringify({ msg: "create facts intake skipped", event, job_id: job.id })
            );
          }
        }
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    const mapped = adapterErrorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
