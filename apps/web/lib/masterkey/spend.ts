/**
 * Control-plane spend gate for MasterKey runs. Mirrors the inference
 * gateway's monthly-cap gating (app/api/gateway/v1/[...path]) and adds a
 * per-call ceiling so a prompt-injected agent cannot drain the wallet with
 * one expensive service or a loop of cheap ones. Every run — from the box
 * via the MCP proxy or from the Store — lands in masterkey_runs (the receipt)
 * and agent_runs (metadata only: no inputs, no outputs, C4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { currentPeriodSpend } from "../entitlements/spend";
import { findCatalogEntry } from "./client";

export type SpendVerdict =
  | { ok: true; estimateUsd: number | null }
  | { ok: false; status: 429 | 401; message: string };

export async function checkMasterkeySpend(
  supabase: SupabaseClient,
  userId: string,
  serviceId: string
): Promise<SpendVerdict> {
  const { data: entitlement } = await supabase
    .from("entitlements")
    .select("monthly_cap_usd, spend_mtd_usd, spend_period_start, suspended_reason")
    .eq("user_id", userId)
    .maybeSingle();
  if (!entitlement || entitlement.suspended_reason) {
    return { ok: false, status: 401, message: "account suspended" };
  }
  const cap = Number(entitlement.monthly_cap_usd);
  const spend = await currentPeriodSpend(supabase, userId, {
    spend_mtd_usd: entitlement.spend_mtd_usd as number | string,
    spend_period_start: String(entitlement.spend_period_start),
  });
  const entry = await findCatalogEntry(serviceId).catch(() => null);
  const estimate = entry?.price.amount ?? null;
  const perCallMax = env.masterkeyPerCallMaxUsd();
  if (estimate !== null && estimate > perCallMax) {
    return {
      ok: false,
      status: 429,
      message: `This service costs $${estimate} per call, above the $${perCallMax} per-call limit.`,
    };
  }
  if (spend >= cap || spend + (estimate ?? 0) > cap) {
    return {
      ok: false,
      status: 429,
      message: "Monthly usage limit reached. Ask your human to raise the cap in Billing & Usage.",
    };
  }
  return { ok: true, estimateUsd: estimate };
}

export type MasterkeySource = "mcp" | "store";

export interface RunReceipt {
  runId?: string | null;
  serviceId: string;
  operation?: string | null;
  source: MasterkeySource;
  ok: boolean;
  /** The reply was lost after submission — the run may have completed and charged. */
  unknown?: boolean;
  costUsd: number | null;
  latencyMs: number;
  errorCode?: string | null;
}

function receiptStatus(receipt: RunReceipt): "succeeded" | "failed" | "unknown" {
  if (receipt.ok) return "succeeded";
  return receipt.unknown ? "unknown" : "failed";
}

/** Persist the receipt + the metadata-only agent_runs row and meter spend. */
export async function recordMasterkeyRun(
  supabase: SupabaseClient,
  userId: string,
  receipt: RunReceipt
): Promise<void> {
  const now = new Date().toISOString();
  const cost = receipt.costUsd ?? 0;
  const { error: runError } = await supabase.from("agent_runs").insert({
    user_id: userId,
    trigger: receipt.source === "mcp" ? "mcp" : "web",
    started_at: new Date(Date.now() - receipt.latencyMs).toISOString(),
    ended_at: now,
    outcome: receipt.ok ? "ok" : `error:${receipt.errorCode ?? "unknown"}`,
    cost_usd: cost,
    label: `masterkey:${receipt.serviceId}`,
    latency_ms: receipt.latencyMs,
  });
  if (runError) {
    console.error(JSON.stringify({ msg: "agent_runs insert failed", user_id: userId, error: runError.message }));
  }
  if (receipt.runId) {
    await supabase
      .from("masterkey_runs")
      .update({
        status: receiptStatus(receipt),
        cost_usd: receipt.costUsd,
        error_code: receipt.errorCode ?? null,
        latency_ms: receipt.latencyMs,
        resolved_at: now,
      })
      .eq("id", receipt.runId)
      .eq("user_id", userId);
  } else {
    const { error } = await supabase.from("masterkey_runs").insert({
      user_id: userId,
      service_id: receipt.serviceId,
      operation: receipt.operation ?? null,
      source: receipt.source,
      status: receiptStatus(receipt),
      cost_usd: receipt.costUsd,
      error_code: receipt.errorCode ?? null,
      latency_ms: receipt.latencyMs,
      resolved_at: now,
    });
    if (error) {
      console.error(JSON.stringify({ msg: "masterkey_runs insert failed", user_id: userId, error: error.message }));
    }
  }
  if (cost > 0) {
    const { error: spendError } = await supabase.rpc("add_spend", {
      p_user_id: userId,
      p_cost_usd: cost,
    });
    if (spendError) {
      console.error(JSON.stringify({ msg: "add_spend failed", user_id: userId, error: spendError.message }));
    }
  }
}
