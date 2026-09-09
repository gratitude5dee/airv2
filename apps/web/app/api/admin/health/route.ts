/**
 * Per-user operator health snapshot. Every selected field is metadata:
 * lifecycle, counts, timestamps, statuses, usage, and cost. Message bodies,
 * prompts, memory text, documents, credentials, and provider account ids are
 * never selected.
 *
 * Deep-memory status is the only live Box read. It is skipped by default,
 * checks an already-awake Box with `memory=1`, and wakes compute only when the
 * operator explicitly adds `wake=1`.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { deepMemoryStatus, type DeepMemoryStatus } from "@/lib/memory/deep";
import {
  armStopAfter,
  ensureBoxAwake,
  peekBoxState,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { REPLACE_CLAIM_TTL_MS } from "@/lib/provisioning/provision";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 365;
const RUN_STUCK_MS = 15 * 60 * 1000;
const STORAGE_CENTS_PER_GB_MONTH = 2.1;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Row =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
  );
}

function row(value: unknown): Row | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function windowDays(request: NextRequest): number | null {
  const raw = request.nextUrl.searchParams.get("days");
  if (!raw) return DEFAULT_WINDOW_DAYS;
  const days = Number(raw);
  return Number.isInteger(days) && days >= 1 && days <= MAX_WINDOW_DAYS
    ? days
    : null;
}

function booleanParam(
  request: NextRequest,
  name: string
): boolean | null {
  const raw = request.nextUrl.searchParams.get(name);
  if (raw === null || raw === "0") return false;
  if (raw === "1") return true;
  return null;
}

function percentile95(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ordered.length * 0.95) - 1] ?? null;
}

function outcomeKind(
  outcome: string | null,
  endedAt: string | null
): "open" | "success" | "failed" | "other" {
  if (!endedAt) return "open";
  if (!outcome) return "other";
  const value = outcome.toLowerCase();
  if (
    value.includes("fail") ||
    value.includes("error") ||
    value.includes("interrupt") ||
    value.includes("cancel")
  ) {
    return "failed";
  }
  if (
    value === "ok" ||
    value === "success" ||
    value === "completed" ||
    value === "gateway_completion"
  ) {
    return "success";
  }
  return "other";
}

function countStatuses(values: Row[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const status = stringValue(value["status"]) ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

interface MemorySnapshot extends DeepMemoryStatus {
  enabled: boolean;
  status:
    | "not_checked"
    | "asleep"
    | "healthy"
    | "unhealthy"
    | "busy"
    | "unavailable";
  checked_at: string | null;
  woke: boolean;
}

function emptyMemory(
  enabled: boolean,
  status: MemorySnapshot["status"]
): MemorySnapshot {
  return {
    enabled,
    status,
    checked_at: null,
    woke: false,
    healthy: false,
    resources: 0,
    memories: null,
    workspace_bytes: 0,
    pending: null,
    truncated: false,
  };
}

async function memorySnapshot(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  requested: boolean,
  wake: boolean
): Promise<MemorySnapshot> {
  if (!requested) return emptyMemory(true, "not_checked");
  try {
    const peek = await peekBoxState(supabase, userId);
    if (!peek?.awake && !wake) return emptyMemory(true, "asleep");
    const box = peek?.awake ? peek : await ensureBoxAwake(supabase, userId);
    try {
      const status = await deepMemoryStatus(box.boxId);
      return {
        enabled: true,
        status: status.healthy ? "healthy" : "unhealthy",
        checked_at: new Date().toISOString(),
        woke: !peek?.awake,
        ...status,
      };
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof StartLimitError) {
      return emptyMemory(true, "busy");
    }
    return emptyMemory(true, "unavailable");
  }
}

function computeDrift(
  box: Row | null,
  target: Row | null
): "current" | "behind" | "hermes_behind" | "unsynced" | "no_target" {
  if (!target) return "no_target";
  const baseline = stringValue(box?.["baseline_version"]);
  if (!baseline) return "unsynced";
  if (baseline !== stringValue(target["version"])) return "behind";
  const targetHermes = stringValue(target["hermes_ref"]);
  if (
    targetHermes &&
    stringValue(box?.["template_version"]) !== targetHermes
  ) {
    return "hermes_behind";
  }
  return "current";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = request.nextUrl.searchParams.get("user_id");
  const days = windowDays(request);
  const memoryRequested = booleanParam(request, "memory");
  const wake = booleanParam(request, "wake");
  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json(
      { error: "valid user_id required" },
      { status: 400 }
    );
  }
  if (days === null) {
    return NextResponse.json(
      { error: `days must be an integer 1-${MAX_WINDOW_DAYS}` },
      { status: 400 }
    );
  }
  if (memoryRequested === null || wake === null || (wake && !memoryRequested)) {
    return NextResponse.json(
      { error: "memory and wake must be 0 or 1; wake requires memory=1" },
      { status: 400 }
    );
  }

  const now = Date.now();
  const sinceIso = new Date(now - days * 86_400_000).toISOString();
  const sinceDate = sinceIso.slice(0, 10);
  const supabase = serviceClient();

  const [
    boxResult,
    runsResult,
    inboundResult,
    connectionsResult,
    boxEventsResult,
    entitlementResult,
    rendersResult,
    assetsResult,
    adSpendResult,
    adSettingsResult,
    cortexResult,
  ] = await Promise.all([
    supabase
      .from("boxes")
      .select(
        "provider, provider_box_id, environment, state, channel, template_version, baseline_version, baseline_synced_at, last_active_at, stop_after, replace_claimed_at, created_at"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("agent_runs")
      .select(
        "started_at, ended_at, outcome, latency_ms, prompt_tokens, completion_tokens, cost_usd"
      )
      .eq("user_id", userId)
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: false })
      .limit(10_000),
    supabase
      .from("inbound_events")
      .select("received_at, status")
      .eq("user_id", userId)
      .gte("received_at", sinceIso)
      .order("received_at", { ascending: false })
      .limit(10_000),
    supabase
      .from("connections")
      .select("provider, toolkit, status, connected_at")
      .eq("user_id", userId)
      .order("toolkit", { ascending: true }),
    supabase
      .from("box_state_events")
      .select("state, created_at")
      .eq("user_id", userId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(10_000),
    supabase
      .from("entitlements")
      .select("speed_tier, spend_mtd_usd, monthly_cap_usd")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("cost_events")
      .select("amount_cents")
      .eq("user_id", userId)
      .eq("kind", "render")
      .gte("occurred_at", sinceIso)
      .limit(10_000),
    supabase
      .from("creative_assets")
      .select("bytes")
      .eq("user_id", userId)
      .limit(10_000),
    supabase
      .from("spend_reports")
      .select("spend_cents")
      .eq("user_id", userId)
      .gte("report_date", sinceDate)
      .limit(10_000),
    supabase
      .from("ad_settings")
      .select("spend_ceiling_cents")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("cortex_calls")
      .select("ok")
      .eq("user_id", userId)
      .gte("created_at", sinceIso)
      .limit(10_000),
  ]);

  const box = row(boxResult.data);
  const runs = rows(runsResult.data);
  const inbound = rows(inboundResult.data);
  const connections = rows(connectionsResult.data);
  const boxEvents = rows(boxEventsResult.data);
  const entitlement = row(entitlementResult.data);
  const adSettings = row(adSettingsResult.data);

  const channelName = stringValue(box?.["channel"]) ?? "prod";
  const { data: channelData } = await supabase
    .from("box_channels")
    .select("release_id, updated_at")
    .eq("name", channelName)
    .maybeSingle();
  const channel = row(channelData);
  const releaseId = stringValue(channel?.["release_id"]);
  const { data: targetData } = releaseId
    ? await supabase
        .from("template_releases")
        .select("version, hermes_ref")
        .eq("id", releaseId)
        .maybeSingle()
    : { data: null };
  const target = row(targetData);

  const runCounts = { success: 0, failed: 0, other: 0, open: 0, stuck: 0 };
  const failureOutcomes: Record<string, number> = {};
  const latencies: number[] = [];
  let lastSuccessAt: string | null = null;
  let lastFailureAt: string | null = null;
  let promptTokens = 0;
  let completionTokens = 0;
  let gatewayCostUsd = 0;
  for (const run of runs) {
    const startedAt = stringValue(run["started_at"]);
    const endedAt = stringValue(run["ended_at"]);
    const outcome = stringValue(run["outcome"]);
    const kind = outcomeKind(outcome, endedAt);
    runCounts[kind] += 1;
    if (
      kind === "open" &&
      startedAt &&
      now - (timestamp(startedAt) ?? now) >= RUN_STUCK_MS
    ) {
      runCounts.stuck += 1;
    }
    if (kind === "success" && !lastSuccessAt) lastSuccessAt = endedAt;
    if (kind === "failed") {
      if (!lastFailureAt) lastFailureAt = endedAt;
      const label = outcome ?? "unknown";
      failureOutcomes[label] = (failureOutcomes[label] ?? 0) + 1;
    }
    const latency = numberValue(run["latency_ms"]);
    if (latency > 0) latencies.push(latency);
    promptTokens += numberValue(run["prompt_tokens"]);
    completionTokens += numberValue(run["completion_tokens"]);
    gatewayCostUsd += numberValue(run["cost_usd"]);
  }

  const inboundCounts = countStatuses(inbound);
  const queued = inbound.filter((event) => event["status"] === "received");
  const oldestQueuedAt =
    queued
      .map((event) => stringValue(event["received_at"]))
      .filter((value): value is string => value !== null)
      .sort()[0] ?? null;
  const oldestQueuedMs = oldestQueuedAt
    ? timestamp(oldestQueuedAt)
    : null;

  const connectorCounts = countStatuses(connections);
  const replacementClaimedAt = stringValue(box?.["replace_claimed_at"]);
  const replacementAgeMs =
    replacementClaimedAt === null
      ? null
      : now - (timestamp(replacementClaimedAt) ?? now);
  const starts = boxEvents.filter(
    (event) =>
      event["state"] === "ready" || event["state"] === "keepawake"
  ).length;
  const stops = boxEvents.filter((event) => event["state"] === "stopped").length;
  const boxFailures = boxEvents.filter(
    (event) => event["state"] === "failed"
  ).length;

  const renderCents = rows(rendersResult.data).reduce(
    (sum, value) => sum + numberValue(value["amount_cents"]),
    0
  );
  const storageBytes = rows(assetsResult.data).reduce(
    (sum, value) => sum + numberValue(value["bytes"]),
    0
  );
  const adSpendCents = rows(adSpendResult.data).reduce(
    (sum, value) => sum + numberValue(value["spend_cents"]),
    0
  );
  const cortexCalls = rows(cortexResult.data);
  const monthlyCapUsd = entitlement
    ? numberValue(entitlement["monthly_cap_usd"])
    : null;
  const spendMtdUsd = entitlement
    ? numberValue(entitlement["spend_mtd_usd"])
    : null;

  const memory = box
    ? await memorySnapshot(
        supabase,
        userId,
        memoryRequested,
        wake
      )
    : emptyMemory(false, "unavailable");

  return NextResponse.json(
    {
      user_id: userId,
      window_days: days,
      since: sinceIso,
      checked_at: new Date().toISOString(),
      memory,
      hermes: {
        runs: runs.length,
        ...runCounts,
        last_run_at: stringValue(runs[0]?.["started_at"]),
        last_success_at: lastSuccessAt,
        last_failure_at: lastFailureAt,
        p95_latency_ms: percentile95(latencies),
        failure_outcomes: failureOutcomes,
      },
      connectors: {
        total: connections.length,
        counts: connectorCounts,
        connections: connections.map((connection) => ({
          provider: stringValue(connection["provider"]),
          toolkit: stringValue(connection["toolkit"]),
          status: stringValue(connection["status"]) ?? "unknown",
          connected_at: stringValue(connection["connected_at"]),
        })),
      },
      transport: {
        total: inbound.length,
        received: inboundCounts["received"] ?? 0,
        dispatched: inboundCounts["dispatched"] ?? 0,
        failed: inboundCounts["failed"] ?? 0,
        ignored: inboundCounts["ignored"] ?? 0,
        queued: queued.length,
        oldest_queued_at: oldestQueuedAt,
        oldest_queued_age_seconds:
          oldestQueuedMs === null
            ? null
            : Math.max(0, Math.floor((now - oldestQueuedMs) / 1000)),
        latest_received_at: stringValue(inbound[0]?.["received_at"]),
      },
      compute: {
        provider: stringValue(box?.["provider"]),
        provider_box_id: stringValue(box?.["provider_box_id"]),
        environment: stringValue(box?.["environment"]),
        state: stringValue(box?.["state"]),
        channel: channelName,
        template_version: stringValue(box?.["template_version"]),
        baseline_version: stringValue(box?.["baseline_version"]),
        baseline_synced_at: stringValue(box?.["baseline_synced_at"]),
        target_version: stringValue(target?.["version"]),
        target_hermes_ref: stringValue(target?.["hermes_ref"]),
        channel_updated_at: stringValue(channel?.["updated_at"]),
        drift: computeDrift(box, target),
        last_active_at: stringValue(box?.["last_active_at"]),
        stop_after: stringValue(box?.["stop_after"]),
        created_at: stringValue(box?.["created_at"]),
        starts,
        stops,
        failures: boxFailures,
        last_event_state: stringValue(boxEvents[0]?.["state"]),
        last_event_at: stringValue(boxEvents[0]?.["created_at"]),
        replacement_claimed_at: replacementClaimedAt,
        replacement_claim_status:
          replacementAgeMs === null
            ? "none"
            : replacementAgeMs > REPLACE_CLAIM_TTL_MS
              ? "stale"
              : "active",
      },
      spend: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        gateway_cost_usd: Number(gatewayCostUsd.toFixed(6)),
        speed_tier: stringValue(entitlement?.["speed_tier"]),
        spend_mtd_usd: spendMtdUsd,
        monthly_cap_usd: monthlyCapUsd,
        monthly_cap_ratio:
          spendMtdUsd !== null && monthlyCapUsd !== null && monthlyCapUsd > 0
            ? spendMtdUsd / monthlyCapUsd
            : null,
        render_cents: renderCents,
        storage_bytes: storageBytes,
        storage_cents_month: Math.ceil(
          (storageBytes / 1_073_741_824) * STORAGE_CENTS_PER_GB_MONTH
        ),
        ad_spend_cents: adSpendCents,
        ad_ceiling_cents: adSettings
          ? numberValue(adSettings["spend_ceiling_cents"])
          : null,
        cortex_calls: cortexCalls.length,
        cortex_errors: cortexCalls.filter(
          (call) => !booleanValue(call["ok"])
        ).length,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
