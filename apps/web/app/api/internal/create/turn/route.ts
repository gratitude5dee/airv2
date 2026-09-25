/**
 * V13 §9.1 `POST /api/internal/create/turn` — the job asks for one Hermes
 * turn on the workspace. Body (CF1-signed):
 *
 *   { job_id, role: "brief" | "code" | "fix", round, findings?, change_file? }
 *
 * The route starts the run (`create-deep:<slug>#plan` for brief,
 * `create-balanced:<slug>#build` for code/fix — §8 model routing), returns
 * the run id, and keeps working in `after()`: it consumes the run's event
 * stream until the terminal frame, closes the `agent_runs` row (the V12
 * leak this replaces), then POSTs `turn_done` back to the job so its
 * `waitForEvent` unblocks. Any failure on that path still fires
 * `turn_done` — a job must never hang waiting on a callback that died.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { adapterErrorResponse, adapterJob } from "@/lib/create/adapter";
import { getRegistryAppById, type RegistryApp } from "@/lib/miniapps/registry";
import { ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { runEvents } from "@/lib/hermes/client";
import { createTerminalScanner, type TerminalOutcome } from "@/lib/hermes/terminal";
import { bridgePost } from "@/lib/create/bridge";
import {
  closeCreateRunRow,
  jobTurnContract,
  startCreateTurn,
  stopCreateTurn,
} from "@/lib/create/turn";
import { projectBudget } from "@/lib/create/budget";
import { PublishError } from "@/lib/miniapps/publish";
import type { JobRow } from "@/lib/create/job";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// §4.3: the stream consumer keeps the function warm up to 800 s.
export const maxDuration = 800;

type TurnRole = "brief" | "code" | "fix";
const ROLES = new Set<TurnRole>(["brief", "code", "fix"]);
const FINDING_RE = /^[a-z0-9][a-z0-9._-]{0,99}$/i;
const CHANGE_FILE_RE = /^intake\/changes\/[a-z0-9._/-]{1,80}$/;

interface TurnBody {
  job_id?: unknown;
  role?: unknown;
  round?: unknown;
  findings?: unknown;
  change_file?: unknown;
  /** §4.4 cancel: `{stop: true, run_id}` kills a turn still streaming. */
  stop?: unknown;
  run_id?: unknown;
}

function turnInput(role: TurnRole, findings: string[], changeFile: string | null): string {
  switch (role) {
    case "brief":
      return "Write the app's goal.md from the plan the owner approved.";
    case "code":
      return changeFile
        ? `Apply the change in ${changeFile} to the app.`
        : "Build the app per goal.md.";
    case "fix":
      return findings.length > 0
        ? `Fix the check failures: ${findings.join(", ")}.`
        : "Fix the check failures.";
  }
}

/** The `after()` half: stream → row close → turn_done. Never throws. */
async function consumeAndReport(
  userId: string,
  jobId: string,
  runId: string,
  rowId: string
): Promise<void> {
  const supabase = serviceClient();
  let outcome: TerminalOutcome | null = null;
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const stream = await runEvents(box.target, runId);
    const scanner = createTerminalScanner();
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const seen = scanner.push(decoder.decode(value, { stream: true }));
        if (seen) {
          outcome = seen;
          break;
        }
      }
      outcome ??= scanner.flush();
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  } catch {
    outcome = null;
  }
  const closed = outcome ?? "failed";
  await closeCreateRunRow(supabase, userId, rowId, closed);
  // The job waits on this event; on the failure path it still fires, with
  // the outcome the job records as its step result (§4.3).
  await bridgePost(`/v1/jobs/${jobId}/events`, {
    type: "turn_done",
    run_id: runId,
    outcome: closed,
  }).catch((error: unknown) => {
    log.error("turn_done post failed", {job_id: jobId,
        error: error instanceof Error ? error.name : "unknown",});
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  try {
    const { job, body } = await adapterJob<TurnBody>(supabase, request);

    // §4.4 — cancel stops the turn the job named before its terminate()
    // lands; the row closes as interrupted and the stream consumer's
    // turn_done post (which will 404 against the terminated instance) is
    // harmless by contract.
    if (body.stop === true) {
      const runId = typeof body.run_id === "string" ? body.run_id : "";
      const stopped = runId
        ? await stopCreateTurn(supabase, job.user_id, runId)
        : false;
      return NextResponse.json({ ok: true, stopped });
    }

    const role =
      typeof body.role === "string" && ROLES.has(body.role as TurnRole)
        ? (body.role as TurnRole)
        : null;
    if (!role) {
      return NextResponse.json(
        { error: "role must be brief, code or fix" },
        { status: 400 }
      );
    }
    const findings = Array.isArray(body.findings)
      ? body.findings
          .filter((f): f is string => typeof f === "string" && FINDING_RE.test(f))
          .slice(0, 40)
      : [];
    const changeFile =
      typeof body.change_file === "string" && CHANGE_FILE_RE.test(body.change_file)
        ? body.change_file
        : null;
    const app: RegistryApp | null = await getRegistryAppById(supabase, job.app_id);
    if (!app || !app.appname) {
      return NextResponse.json({ error: "app not found" }, { status: 404 });
    }

    const budget = await projectBudget(supabase, job.user_id, app.slug);
    const turn = await startCreateTurn(
      supabase,
      job.user_id,
      {
        appname: app.appname,
        input: turnInput(role, findings, changeFile),
        tier: role === "brief" ? "deep" : "balanced",
        trigger: "job",
        stage: role === "brief" ? "plan" : "build",
        instructions: jobTurnContract(role, changeFile ?? undefined),
      },
      { budget }
    );
    const jobRow: JobRow = job;
    after(() => consumeAndReport(jobRow.user_id, jobRow.id, turn.run_id, turn.row_id));
    return NextResponse.json({ run_id: turn.run_id, session: turn.session });
  } catch (error) {
    const response = adapterErrorResponse(error);
    if (response) return response as NextResponse;
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
