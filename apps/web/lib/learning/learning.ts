/**
 * Air Learning Plane (goal.md V10) — control-plane side.
 *
 * The Box owns all learning content; this module only (a) keeps the
 * content-free per-owner settings/receipt rows in shared Postgres and
 * (b) talks to the Box's air-learningd through `learningctl` over the
 * compute abstraction (never a provider API in a route handler — C24).
 * Everything that crosses this boundary is validated against the
 * receipt allowlist before it is persisted (L4/C4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadTarget,
  runCommand,
  writeComputeFile,
  type ComputeTarget,
} from "@/lib/compute/runtime";

export const LEARNING_MODES = ["off", "observe", "suggest", "auto_safe"] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

export const FEEDBACK_REASONS = [
  "worked",
  "wrong_result",
  "did_not_finish",
  "missed_context",
  "unnecessary_question",
  "unsafe_or_unapproved",
  "too_slow",
  "too_expensive",
  "style_or_preference",
  "other",
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

export function isLearningMode(value: string): value is LearningMode {
  return (LEARNING_MODES as readonly string[]).includes(value);
}

export function isFeedbackReason(value: string): value is FeedbackReason {
  return (FEEDBACK_REASONS as readonly string[]).includes(value);
}

export interface LearningSettings {
  mode: LearningMode;
  daily_budget_usd: number;
  retention_raw_days: number;
  schedule: "idle_only" | "scheduled" | "manual";
}

const DEFAULT_SETTINGS: LearningSettings = {
  mode: "observe",
  daily_budget_usd: 1.0,
  retention_raw_days: 30,
  schedule: "idle_only",
};

export async function getSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<LearningSettings> {
  const { data } = await supabase
    .from("learning_settings")
    .select("mode, daily_budget_usd, retention_raw_days, schedule")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    mode: data.mode as LearningMode,
    daily_budget_usd: Number(data.daily_budget_usd),
    retention_raw_days: data.retention_raw_days as number,
    schedule: data.schedule as LearningSettings["schedule"],
  };
}

export async function updateSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<LearningSettings>,
): Promise<LearningSettings> {
  const current = await getSettings(supabase, userId);
  const next: LearningSettings = { ...current, ...patch };
  // auto_safe is gated until V10 M8 lands plus an operator flag (§5).
  if (next.mode === "auto_safe") next.mode = current.mode === "auto_safe" ? current.mode : "suggest";
  const { error } = await supabase.from("learning_settings").upsert({
    user_id: userId,
    ...next,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`learning settings update failed: ${error.message}`);
  // Mirror to the Box daemon so its scheduler/budgets honor the new mode.
  // Best effort: the Box is authoritative for enforcement on its side and
  // re-syncs at reconciliation; a sleeping box must not fail the request.
  await callDaemon(supabase, userId, "settings.set", {
    mode: next.mode,
    daily_budget_usd: String(next.daily_budget_usd),
    retention_raw_days: String(next.retention_raw_days),
    schedule: next.schedule,
  }).catch(() => undefined);
  return next;
}

interface DaemonResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
  error_class?: string;
}

/** Daemon methods the control plane may invoke (never interpolate free text). */
const DAEMON_METHODS = [
  "status",
  "settings.set",
  "turn.completed",
  "feedback.record",
  "receipts.drain",
  "receipts.ack",
  "candidates.list",
  "candidate.approve",
  "candidate.reject",
  "profile.rollback",
] as const;
export type DaemonMethod = (typeof DAEMON_METHODS)[number];

/** Invoke learningctl on the owner's Box through the compute abstraction. */
export async function callDaemon(
  supabase: SupabaseClient,
  userId: string,
  method: DaemonMethod,
  params?: Record<string, unknown>,
  target?: ComputeTarget,
): Promise<DaemonResponse> {
  if (!(DAEMON_METHODS as readonly string[]).includes(method)) {
    return { ok: false, error: "unknown daemon method", error_class: "daemon_protocol" };
  }
  const resolved = target ?? (await loadTarget(supabase, userId));
  // Params travel base64-encoded (shell-safe alphabet), so no owner-supplied
  // byte ever needs shell quoting; learningctl decodes the b64: prefix.
  const args = params
    ? ` b64:${Buffer.from(JSON.stringify(params), "utf8").toString("base64")}`
    : "";
  const result = await runCommand(resolved, `learningctl ${method}${args}`, 60);
  const text = (result.stdout ?? "").trim();
  try {
    return JSON.parse(text) as DaemonResponse;
  } catch {
    return { ok: false, error: "unparseable daemon response", error_class: "daemon_protocol" };
  }
}

export interface LearningStatus {
  settings: LearningSettings;
  daemon: {
    reachable: boolean;
    daemon_version?: string;
    mode?: string;
    counts?: Record<string, number>;
    active_profile_id?: string | null;
    promotion_policy_version?: string;
    error_class?: string;
  };
}

export async function getStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<LearningStatus> {
  const settings = await getSettings(supabase, userId);
  let daemon: LearningStatus["daemon"] = { reachable: false };
  try {
    const response = await callDaemon(supabase, userId, "status");
    if (response.ok && response.result && typeof response.result === "object") {
      const r = response.result as Record<string, unknown>;
      daemon = { reachable: true };
      if (typeof r["daemon_version"] === "string") daemon.daemon_version = r["daemon_version"];
      if (typeof r["mode"] === "string") daemon.mode = r["mode"];
      if (r["counts"] && typeof r["counts"] === "object") {
        daemon.counts = r["counts"] as Record<string, number>;
      }
      daemon.active_profile_id =
        typeof r["active_profile_id"] === "string" ? r["active_profile_id"] : null;
      if (typeof r["promotion_policy_version"] === "string") {
        daemon.promotion_policy_version = r["promotion_policy_version"];
      }
    } else {
      daemon = {
        reachable: false,
        error_class: response.error_class ?? "daemon_error",
      };
    }
  } catch {
    daemon = { reachable: false, error_class: "compute_unreachable" };
  }
  return { settings, daemon };
}

export interface FeedbackInput {
  trace_id: string;
  reason: FeedbackReason;
  rating?: number;
  /** Free-text correction: forwarded to the Box only, NEVER stored centrally. */
  correction?: string;
}

export async function recordFeedback(
  supabase: SupabaseClient,
  userId: string,
  input: FeedbackInput,
): Promise<{ id: string; delivery: "forwarded" | "failed" }> {
  const { data, error } = await supabase
    .from("run_feedback")
    .insert({
      user_id: userId,
      trace_id: input.trace_id,
      reason: input.reason,
      rating: input.rating ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`feedback insert failed: ${error?.message ?? "no row"}`);
  }
  let delivery: "forwarded" | "failed" = "failed";
  try {
    const target = await loadTarget(supabase, userId);
    // Free-text corrections travel as a Box-private file; only its path
    // crosses the daemon protocol, and nothing of it touches Postgres.
    let correctionPath: string | undefined;
    if (input.correction) {
      correctionPath = `.hermes/learning/corrections/${data.id as string}.txt`;
      await writeComputeFile(target, correctionPath, input.correction);
    }
    const response = await callDaemon(
      supabase,
      userId,
      "feedback.record",
      {
        trace_id: input.trace_id,
        reason: input.reason,
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(correctionPath ? { correction_path: correctionPath } : {}),
      },
      target,
    );
    if (response.ok) delivery = "forwarded";
  } catch {
    delivery = "failed";
  }
  await supabase.from("run_feedback").update({ delivery }).eq("id", data.id);
  return { id: data.id as string, delivery };
}

/** Keys a receipt row may carry into learning_events (L4 allowlist). */
const RECEIPT_COLUMNS = [
  "idempotency_key",
  "event_type",
  "trace_id",
  "experiment_id",
  "candidate_id",
  "profile_id",
  "status",
  "backend",
  "error_class",
  "rollback_reason",
  "occurred_at",
] as const;

/**
 * Drain the Box's content-free receipt outbox into learning_events.
 * The drain is a peek: rows are only acknowledged (removed from the
 * outbox) after the central upsert succeeds, so delivery is
 * at-least-once and (user_id, idempotency_key) deduplicates retries.
 * Unknown keys are dropped (never stored); rows without the required
 * fields are skipped but still acknowledged.
 */
export async function drainReceipts(
  supabase: SupabaseClient,
  userId: string,
  target?: ComputeTarget,
): Promise<number> {
  const resolved = target ?? (await loadTarget(supabase, userId));
  const response = await callDaemon(supabase, userId, "receipts.drain", { limit: 100 }, resolved);
  if (!response.ok || !Array.isArray(response.result)) return 0;
  const rows = [];
  const ackKeys: string[] = [];
  for (const raw of response.result) {
    if (typeof raw !== "object" || raw === null) continue;
    const receipt = raw as Record<string, unknown>;
    if (typeof receipt["idempotency_key"] !== "string") continue;
    ackKeys.push(receipt["idempotency_key"]);
    if (typeof receipt["event_type"] !== "string") continue;
    if (typeof receipt["occurred_at"] !== "string") continue;
    const row: Record<string, unknown> = { user_id: userId };
    for (const key of RECEIPT_COLUMNS) {
      const value = receipt[key];
      if (typeof value === "string") row[key] = value;
    }
    rows.push(row);
  }
  if (rows.length > 0) {
    const { error } = await supabase
      .from("learning_events")
      .upsert(rows, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true });
    if (error) throw new Error(`receipt drain insert failed: ${error.message}`);
  }
  if (ackKeys.length > 0) {
    await callDaemon(supabase, userId, "receipts.ack", { idempotency_keys: ackKeys }, resolved);
  }
  return rows.length;
}
