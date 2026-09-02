/**
 * Store-initiated MasterKey runs. "Pay & run" files a masterkey_runs intent
 * plus a run_approval decision — nothing is charged until the owner approves
 * in Needs you (same lane as wallet sends, lib/wallet/send.ts). Approval
 * executes run_service server-side through the per-user MCP token and the
 * result text lands back on the row for the Store to show.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  callMasterkeyTool,
  findCatalogEntry,
  MasterkeyError,
  resultText,
  runCostUsd,
} from "./client";
import { checkMasterkeySpend, recordMasterkeyRun } from "./spend";

export type MasterkeyRunStatus =
  | "pending"
  | "approved"
  | "succeeded"
  | "failed"
  | "denied"
  | "unknown";

export interface MasterkeyRun {
  id: string;
  user_id: string;
  service_id: string;
  service_name: string | null;
  operation: string | null;
  input: Record<string, unknown> | null;
  source: "mcp" | "store";
  status: MasterkeyRunStatus;
  estimate_usd: number | string | null;
  cost_usd: number | string | null;
  result_text: string | null;
  error_code: string | null;
  decision_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

const RUN_COLUMNS =
  "id, user_id, service_id, service_name, operation, input, source, status, estimate_usd, cost_usd, result_text, error_code, decision_id, created_at, resolved_at";

const RESULT_TEXT_MAX = 8000;

export class MasterkeyRunError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "MasterkeyRunError";
  }
}

/** Parse the optional JSON input typed into the Store form. */
export function parseRunInput(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new MasterkeyRunError(400, "input must be a JSON object");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MasterkeyRunError(400, "input must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export async function createRunRequest(
  supabase: SupabaseClient,
  userId: string,
  params: { serviceId: string; operation?: string | null; input: Record<string, unknown> | null }
): Promise<{ runId: string; decisionId: string }> {
  const entry = await findCatalogEntry(params.serviceId);
  if (!entry) throw new MasterkeyRunError(404, "unknown service");
  const verdict = await checkMasterkeySpend(supabase, userId, entry.id);
  if (!verdict.ok) throw new MasterkeyRunError(verdict.status, verdict.message);

  const { data: run, error } = await supabase
    .from("masterkey_runs")
    .insert({
      user_id: userId,
      service_id: entry.id,
      service_name: entry.name,
      operation: params.operation ?? null,
      input: params.input,
      source: "store",
      status: "pending",
      estimate_usd: verdict.estimateUsd,
    })
    .select("id")
    .single();
  if (error || !run) throw new MasterkeyRunError(500, "could not record the run");

  const price = entry.price.display || "price varies";
  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "run_approval",
      ref: run.id,
      label: `Run ${entry.name} on MasterKey (${price})`,
      payload: {
        masterkey_run: true,
        service_id: entry.id,
        service_name: entry.name,
        category: entry.category,
        price_display: entry.price.display,
        estimate_usd: verdict.estimateUsd,
      },
    })
    .select("id")
    .single();
  if (decisionError || !decision) {
    await supabase
      .from("masterkey_runs")
      .update({ status: "failed", error_code: "no_decision", resolved_at: new Date().toISOString() })
      .eq("id", run.id);
    throw new MasterkeyRunError(500, "could not create the approval");
  }
  await supabase.from("masterkey_runs").update({ decision_id: decision.id }).eq("id", run.id);
  return { runId: run.id as string, decisionId: decision.id as string };
}

/** The pending Store run a run_approval ref points at, if it is one. */
export async function findPendingMasterkeyRun(
  supabase: SupabaseClient,
  userId: string,
  ref: string
): Promise<MasterkeyRun | null> {
  const { data } = await supabase
    .from("masterkey_runs")
    .select(RUN_COLUMNS)
    .eq("id", ref)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  return (data as MasterkeyRun | null) ?? null;
}

/**
 * Execute an approved run. Claims the row first (pending → approved) so a
 * double-approve can never charge twice; the spend gate is re-checked at
 * execution time because the cap may have moved since the request was filed.
 */
export async function executeMasterkeyRun(
  supabase: SupabaseClient,
  userId: string,
  run: MasterkeyRun
): Promise<MasterkeyRun> {
  const { data: claimed } = await supabase
    .from("masterkey_runs")
    .update({ status: "approved" })
    .eq("id", run.id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) {
    throw new MasterkeyRunError(409, "this run was already handled");
  }
  const verdict = await checkMasterkeySpend(supabase, userId, run.service_id);
  if (!verdict.ok) {
    await supabase
      .from("masterkey_runs")
      .update({ status: "failed", error_code: "spend_cap", resolved_at: new Date().toISOString() })
      .eq("id", run.id);
    throw new MasterkeyRunError(verdict.status, verdict.message);
  }

  const startedAt = Date.now();
  let ok = false;
  let unknown = false;
  let costUsd: number | null = null;
  let errorCode: string | null = null;
  let text = "";
  try {
    const result = await callMasterkeyTool(supabase, userId, "run_service", {
      serviceId: run.service_id,
      ...(run.operation ? { operation: run.operation } : {}),
      ...(run.input ? { input: run.input } : {}),
      idempotencyKey: `airv2-store-${run.id}`,
    });
    ok = !result.isError && !result.structuredContent?.["error"];
    costUsd = runCostUsd(result);
    text = resultText(result).slice(0, RESULT_TEXT_MAX);
    if (!ok) {
      const code = result.structuredContent?.["code"];
      errorCode = typeof code === "string" ? code : "tool_error";
    }
  } catch (error) {
    if (error instanceof MasterkeyError) {
      // MasterKey answered with an error envelope — the run did not complete.
      errorCode = "upstream";
      text = error.message.slice(0, 500);
    } else {
      // The request may have reached MasterKey and been charged before the
      // connection died — the outcome is unknown, not a failure. The
      // idempotency key above means a retry cannot double-charge.
      unknown = true;
      errorCode = "submit_unknown";
      text =
        "The run was submitted but the reply was lost — it may have completed and been charged. Check the service wallet before retrying.";
    }
  }
  await supabase
    .from("masterkey_runs")
    .update({ result_text: text })
    .eq("id", run.id);
  await recordMasterkeyRun(supabase, userId, {
    runId: run.id,
    serviceId: run.service_id,
    operation: run.operation,
    source: "store",
    ok,
    unknown,
    costUsd,
    latencyMs: Date.now() - startedAt,
    errorCode,
  });
  const { data } = await supabase
    .from("masterkey_runs")
    .select(RUN_COLUMNS)
    .eq("id", run.id)
    .single();
  return data as MasterkeyRun;
}

export async function denyMasterkeyRun(
  supabase: SupabaseClient,
  userId: string,
  runId: string
): Promise<void> {
  await supabase
    .from("masterkey_runs")
    .update({ status: "denied", resolved_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("status", "pending");
}

export async function listMasterkeyRuns(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<MasterkeyRun[]> {
  const { data } = await supabase
    .from("masterkey_runs")
    .select(RUN_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as MasterkeyRun[] | null) ?? [];
}
