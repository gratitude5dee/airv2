/**
 * What the Functions tab (goal-create-v11 §5.1) and `air-create functions`
 * see for one app: status, declared vs approved manifest, resources,
 * secret names + set-at, the daily cap meter, the runtime-token reference
 * (never the token) and the last request status codes from the content-free
 * `fn_request` ring in ops_events. Metadata only (CR5, CR14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistryApp } from "../miniapps/registry";
import { type FunctionsRow, pendingProposal } from "./backend";
import { FN_DAILY_CAP_MAX_USD, FN_DAILY_CAP_MIN_USD, EGRESS_MAX_HOSTS } from "./egress";
import { isPendingMarker } from "./provision";
import { appDailyCapUsd, appSpentTodayUsd } from "./runtime";
import { SECRET_MAX_PER_APP, secretsMissingOn, summarizeSecrets } from "./secrets";

export const REQUEST_RING_SIZE = 20;

export interface RecentRequest {
  status: number;
  at: string;
}

export async function recentRequests(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<RecentRequest[]> {
  const { data } = await supabase
    .from("ops_events")
    .select("ref, created_at")
    .eq("user_id", userId)
    .eq("kind", "fn_request")
    .like("ref", `${slug}:%`)
    .order("created_at", { ascending: false })
    .limit(REQUEST_RING_SIZE);
  return ((data ?? []) as Array<{ ref: string | null; created_at: string }>)
    .map((row) => {
      const status = Number((row.ref ?? "").slice(slug.length + 1));
      return { status: Number.isFinite(status) ? status : 0, at: row.created_at };
    })
    .filter((row) => row.status > 0);
}

function resourceState(id: string | null): "none" | "provisioning" | "ready" {
  if (!id) return "none";
  return isPendingMarker(id) ? "provisioning" : "ready";
}

export async function functionsStatus(
  supabase: SupabaseClient,
  app: RegistryApp,
  row: FunctionsRow | null,
  pendingDecision: string | null
) {
  const requests = row
    ? await recentRequests(supabase, row.user_id, app.slug)
    : [];
  return {
    slug: app.slug,
    appname: app.appname,
    status: row?.status ?? "disabled",
    enabled: row !== null && row.status === "live" && row.killed_at === null,
    killed: row?.killed_at !== null && row?.killed_at !== undefined,
    killed_by: row?.killed_by ?? null,
    declared: row?.declared ?? null,
    declared_at: row?.declared_at ?? null,
    approved: row?.approved_manifest ?? null,
    approved_at: row?.approved_at ?? null,
    pending: row ? pendingProposal(row) : null,
    decision_id: pendingDecision,
    resources: {
      db: resourceState(row?.d1_database_id ?? null),
      kv: resourceState(row?.kv_namespace_id ?? null),
    },
    secrets: row ? summarizeSecrets(row) : [],
    secrets_missing: row
      ? { live: secretsMissingOn(row, "live"), draft: secretsMissingOn(row, "draft") }
      : { live: [], draft: [] },
    cap: row
      ? {
          daily_usd: appDailyCapUsd(row),
          spent_today_usd: appSpentTodayUsd(row),
          min_usd: FN_DAILY_CAP_MIN_USD,
          max_usd: FN_DAILY_CAP_MAX_USD,
        }
      : null,
    limits: {
      egress_hosts: EGRESS_MAX_HOSTS,
      secrets: SECRET_MAX_PER_APP,
      cpu_ms: row?.limits.cpu_ms ?? null,
      subrequests: row?.limits.subrequests ?? null,
    },
    token_ref: row?.runtime_token_id ?? null,
    deployed_at: row?.deployed_at ?? null,
    last_error: row?.last_error ?? null,
    requests,
  };
}

export type FunctionsStatusPayload = Awaited<ReturnType<typeof functionsStatus>>;

export async function pendingBackendDecisionId(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<string | null> {
  const { data } = await supabase
    .from("decisions")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "miniapp_backend")
    .eq("ref", slug)
    .eq("status", "pending")
    .maybeSingle();
  return data ? (data.id as string) : null;
}
