/**
 * V11 §11 / §4.1 — one app's backend record (`miniapp_functions`) and the
 * two things that may change it:
 *
 *   stage    the Build Service or the agent writes what `air.json` declares
 *            (`declared`); nothing about the live Worker moves.
 *   approve  the owner resolves the `miniapp_backend` decision; the declared
 *            egress / db / kv / cap become `approved_manifest`, and only that
 *            governs a live Worker (CR4, CR7, CR8).
 *
 * Everything here is content-free: hostnames, booleans, a dollar figure,
 * secret *names*. No source, no secret values, no token (CR14, C18).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistryApp } from "../miniapps/registry";
import { scriptNameFor } from "./deploy";
import {
  approvalChanged,
  approvedFrom,
  parseApprovedBackend,
  parseFunctionsDeclaration,
  type ApprovedBackend,
  type FunctionsDeclaration,
} from "./egress";

export class BackendError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "BackendError";
    this.status = status;
  }
}

export type FunctionsStatus = "disabled" | "draft" | "live" | "suspended";

/** Per-secret bookkeeping: when it was set and which scripts hold it. */
export interface SecretSetAt {
  at: string;
  live: boolean;
  draft: boolean;
}

export interface FunctionsRow {
  app_id: string;
  user_id: string;
  script_name: string;
  draft_script_name: string;
  d1_database_id: string | null;
  kv_namespace_id: string | null;
  egress: string[];
  secret_names: string[];
  ai_daily_cap_usd: number;
  ai_spent_today_usd: number;
  ai_spend_day: string | null;
  limits: { cpu_ms: number; subrequests: number };
  status: FunctionsStatus;
  approved_manifest: ApprovedBackend | null;
  deployed_at: string | null;
  last_error: string | null;
  declared: FunctionsDeclaration | null;
  declared_at: string | null;
  approved_at: string | null;
  runtime_token_id: string | null;
  secret_set_at: Record<string, SecretSetAt>;
  killed_at: string | null;
  killed_by: "owner" | "admin" | null;
}

export const FUNCTIONS_COLUMNS =
  "app_id, user_id, script_name, draft_script_name, d1_database_id, " +
  "kv_namespace_id, egress, secret_names, ai_daily_cap_usd, ai_spent_today_usd, " +
  "ai_spend_day, limits, status, approved_manifest, deployed_at, last_error, " +
  "declared, declared_at, approved_at, runtime_token_id, secret_set_at, " +
  "killed_at, killed_by";

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function parseSecretSetAt(value: unknown): Record<string, SecretSetAt> {
  if (typeof value !== "object" || value === null) return {};
  const out: Record<string, SecretSetAt> = {};
  for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") {
      out[name] = { at: entry, live: true, draft: true };
    } else if (typeof entry === "object" && entry !== null) {
      const record = entry as Record<string, unknown>;
      out[name] = {
        at: typeof record["at"] === "string" ? record["at"] : "",
        live: record["live"] === true,
        draft: record["draft"] === true,
      };
    }
  }
  return out;
}

export function parseFunctionsRow(raw: unknown): FunctionsRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["app_id"] !== "string" || typeof r["user_id"] !== "string") {
    return null;
  }
  const status = r["status"];
  const limits =
    typeof r["limits"] === "object" && r["limits"] !== null
      ? (r["limits"] as Record<string, unknown>)
      : {};
  return {
    app_id: r["app_id"],
    user_id: r["user_id"],
    script_name: String(r["script_name"] ?? ""),
    draft_script_name: String(r["draft_script_name"] ?? ""),
    d1_database_id: typeof r["d1_database_id"] === "string" ? r["d1_database_id"] : null,
    kv_namespace_id: typeof r["kv_namespace_id"] === "string" ? r["kv_namespace_id"] : null,
    egress: strings(r["egress"]),
    secret_names: strings(r["secret_names"]),
    ai_daily_cap_usd: num(r["ai_daily_cap_usd"], 1),
    ai_spent_today_usd: num(r["ai_spent_today_usd"], 0),
    ai_spend_day: typeof r["ai_spend_day"] === "string" ? r["ai_spend_day"] : null,
    limits: {
      cpu_ms: num(limits["cpu_ms"], 50),
      subrequests: num(limits["subrequests"], 20),
    },
    status:
      status === "draft" || status === "live" || status === "suspended"
        ? status
        : "disabled",
    approved_manifest: parseApprovedBackend(r["approved_manifest"]),
    deployed_at: typeof r["deployed_at"] === "string" ? r["deployed_at"] : null,
    last_error: typeof r["last_error"] === "string" ? r["last_error"] : null,
    declared: parseFunctionsDeclaration(r["declared"]),
    declared_at: typeof r["declared_at"] === "string" ? r["declared_at"] : null,
    approved_at: typeof r["approved_at"] === "string" ? r["approved_at"] : null,
    runtime_token_id:
      typeof r["runtime_token_id"] === "string" ? r["runtime_token_id"] : null,
    secret_set_at: parseSecretSetAt(r["secret_set_at"]),
    killed_at: typeof r["killed_at"] === "string" ? r["killed_at"] : null,
    killed_by:
      r["killed_by"] === "owner" || r["killed_by"] === "admin" ? r["killed_by"] : null,
  };
}

export async function loadFunctions(
  supabase: SupabaseClient,
  appId: string
): Promise<FunctionsRow | null> {
  const { data, error } = await supabase
    .from("miniapp_functions")
    .select(FUNCTIONS_COLUMNS)
    .eq("app_id", appId)
    .maybeSingle();
  if (error) throw new BackendError(502, "backend lookup failed");
  return parseFunctionsRow(data);
}

/** The row exists from the first declaration on; idempotent. */
export async function ensureFunctionsRow(
  supabase: SupabaseClient,
  app: Pick<RegistryApp, "id" | "slug" | "owner_user_id">
): Promise<FunctionsRow> {
  const existing = await loadFunctions(supabase, app.id);
  if (existing) return existing;
  if (!app.owner_user_id) throw new BackendError(409, "app has no owner");
  const { error } = await supabase.from("miniapp_functions").upsert(
    {
      app_id: app.id,
      user_id: app.owner_user_id,
      script_name: scriptNameFor(app.slug, "live"),
      draft_script_name: scriptNameFor(app.slug, "draft"),
    },
    { onConflict: "app_id", ignoreDuplicates: true }
  );
  if (error) throw new BackendError(502, "backend row failed");
  const row = await loadFunctions(supabase, app.id);
  if (!row) throw new BackendError(502, "backend row failed");
  return row;
}

/** What the owner would be approving right now, or null when nothing changed. */
export function pendingProposal(row: FunctionsRow): ApprovedBackend | null {
  if (!row.declared) return null;
  const next = approvedFrom(row.declared, row.secret_names);
  return approvalChanged(row.approved_manifest, next) ? next : null;
}

/**
 * Record the declaration from air.json (build) or the tab/CLI (owner or
 * agent). Staging only: `status` moves disabled → draft the first time and
 * never further; `approved_manifest` is untouched (CR4).
 */
export async function stageDeclaration(
  supabase: SupabaseClient,
  app: Pick<RegistryApp, "id" | "slug" | "owner_user_id">,
  declared: FunctionsDeclaration
): Promise<FunctionsRow> {
  const row = await ensureFunctionsRow(supabase, app);
  const patch: Record<string, unknown> = {
    declared,
    declared_at: new Date().toISOString(),
  };
  if (row.status === "disabled") patch["status"] = "draft";
  const { error } = await supabase
    .from("miniapp_functions")
    .update(patch)
    .eq("app_id", app.id);
  if (error) throw new BackendError(502, "backend stage failed");
  return { ...row, declared, declared_at: patch["declared_at"] as string, status: row.status === "disabled" ? "draft" : row.status };
}

/**
 * Put back what a build staged over when its version never got stored.
 * Fenced on `declared_at`: a build that staged since keeps its own row.
 */
export async function unstageDeclaration(
  supabase: SupabaseClient,
  appId: string,
  previous: FunctionsRow,
  stagedAt: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    declared: previous.declared,
    declared_at: previous.declared_at,
  };
  if (previous.status === "disabled") patch["status"] = "disabled";
  await supabase
    .from("miniapp_functions")
    .update(patch)
    .eq("app_id", appId)
    .eq("declared_at", stagedAt);
}

export const BACKEND_DECISION_KIND = "miniapp_backend";

/** The card's payload: verbatim what the owner is approving, nothing else. */
export function backendDecisionPayload(
  proposal: ApprovedBackend,
  approved: ApprovedBackend | null
): Record<string, unknown> {
  return {
    egress: proposal.egress,
    db: proposal.db,
    kv: proposal.kv,
    ai: { dailyCapUsd: proposal.dailyCapUsd },
    secret_names: proposal.secretNames,
    previously_approved: approved
      ? {
          egress: approved.egress,
          db: approved.db,
          kv: approved.kv,
          ai: { dailyCapUsd: approved.dailyCapUsd },
          secret_names: approved.secretNames,
        }
      : null,
  };
}

export function backendDecisionLabel(
  appName: string,
  proposal: ApprovedBackend,
  approved: ApprovedBackend | null
): string {
  const reach =
    proposal.egress.length === 0
      ? "reaches no outside hosts"
      : `may reach ${proposal.egress.join(", ")}`;
  const verb = approved ? "Backend changes for" : "Enable a backend for";
  return `${verb} ${appName} — ${reach}, up to $${proposal.dailyCapUsd.toFixed(2)}/day of inference`;
}

/**
 * File (or refresh) the one pending `miniapp_backend` decision for an app.
 * Returns the decision id, or null when the approved manifest already
 * matches the declaration (nothing needs the owner). Staging only.
 */
export async function fileBackendDecision(
  supabase: SupabaseClient,
  app: Pick<RegistryApp, "id" | "slug" | "name" | "owner_user_id">,
  row: FunctionsRow
): Promise<string | null> {
  const proposal = pendingProposal(row);
  if (!proposal || !app.owner_user_id) return null;
  const payload = backendDecisionPayload(proposal, row.approved_manifest);
  const label = backendDecisionLabel(app.name, proposal, row.approved_manifest);
  const { data: pending } = await supabase
    .from("decisions")
    .select("id")
    .eq("user_id", app.owner_user_id)
    .eq("kind", BACKEND_DECISION_KIND)
    .eq("ref", app.slug)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    await supabase
      .from("decisions")
      .update({ payload, label })
      .eq("id", pending.id as string);
    return pending.id as string;
  }
  const { data: decision, error } = await supabase
    .from("decisions")
    .insert({
      user_id: app.owner_user_id,
      kind: BACKEND_DECISION_KIND,
      ref: app.slug,
      label,
      payload,
    })
    .select("id")
    .single();
  if (error || !decision) throw new BackendError(502, "decision failed");
  return decision.id as string;
}

/**
 * The owner approved: stamp the declaration as the approved manifest. The
 * caller (the decision route, under the owner's session) then redeploys the
 * live Worker and re-signs the manifest so the approval takes effect.
 */
export async function approveBackend(
  supabase: SupabaseClient,
  appId: string
): Promise<{ row: FunctionsRow; approved: ApprovedBackend } | null> {
  const row = await loadFunctions(supabase, appId);
  if (!row || !row.declared) return null;
  const approved = approvedFrom(row.declared, row.secret_names);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("miniapp_functions")
    .update({
      approved_manifest: approved,
      approved_at: now,
      egress: approved.egress,
      ai_daily_cap_usd: approved.dailyCapUsd,
      status: row.killed_at ? "suspended" : "live",
      last_error: null,
    })
    .eq("app_id", appId);
  if (error) throw new BackendError(502, "backend approval failed");
  await supabase
    .from("mini_apps")
    .update({ functions_enabled: true })
    .eq("id", appId);
  return {
    row: {
      ...row,
      approved_manifest: approved,
      approved_at: now,
      egress: approved.egress,
      ai_daily_cap_usd: approved.dailyCapUsd,
      status: row.killed_at ? "suspended" : "live",
    },
    approved,
  };
}

/**
 * The kill switch (§11.7). `killed=true` is the safe direction — owner or
 * admin, immediate, no decision: the module path is removed on the next
 * deploy/manifest sync and the static app keeps serving. Clearing it needs
 * an owner and restores whatever was already approved (never widens).
 */
export async function setKillSwitch(
  supabase: SupabaseClient,
  appId: string,
  killed: boolean,
  by: "owner" | "admin"
): Promise<FunctionsRow | null> {
  const row = await loadFunctions(supabase, appId);
  if (!row) return null;
  if (!killed && by !== "owner") {
    throw new BackendError(403, "only the owner re-enables a backend");
  }
  const status: FunctionsStatus = killed
    ? "suspended"
    : row.approved_manifest
      ? "live"
      : row.declared
        ? "draft"
        : "disabled";
  const patch = {
    killed_at: killed ? new Date().toISOString() : null,
    killed_by: killed ? by : null,
    status,
  };
  const { error } = await supabase
    .from("miniapp_functions")
    .update(patch)
    .eq("app_id", appId);
  if (error) throw new BackendError(502, "kill switch failed");
  await supabase
    .from("mini_apps")
    .update({ functions_enabled: !killed && status === "live" })
    .eq("id", appId);
  return { ...row, ...patch };
}

/** True when a user module may run for this target (§11.6, §11.7). */
export function moduleAllowed(
  row: FunctionsRow | null,
  target: "live" | "draft"
): boolean {
  if (!row || row.killed_at) return false;
  if (target === "draft") return row.declared !== null || row.approved_manifest !== null;
  return row.approved_manifest !== null && row.status === "live";
}

/**
 * Which per-app resources this target may bind (§11.1). Draft follows the
 * declaration (so the agent can test against a database before the owner
 * approves it); live follows the approved manifest only.
 */
export function resourcesFor(
  row: FunctionsRow,
  target: "live" | "draft"
): { db: boolean; kv: boolean } {
  const source =
    target === "live"
      ? row.approved_manifest
      : (row.declared
          ? { db: row.declared.db, kv: row.declared.kv }
          : row.approved_manifest);
  return { db: source?.db === true, kv: source?.kv === true };
}
