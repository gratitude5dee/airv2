/**
 * V12 §12 — the operator audit row (`admin_audit`, migration 0120) written
 * by `POST /api/admin/create/apps/<slug>/{dev,suspend}`. Best-effort: an
 * audit insert that fails (an unapplied migration, a ledger outage) is
 * logged loudly but never undoes the action it records. Metadata only —
 * action names, ids, a version and an expiry; no text anyone typed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistryApp } from "../miniapps/registry";

export const ADMIN_AUDIT_ACTIONS = ["dev_revoke", "dev_renew", "suspend"] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export type AdminAuditDetail = Record<string, string | number | boolean | null>;

export interface AdminAuditInput {
  action: AdminAuditAction;
  app: Pick<RegistryApp, "id" | "slug" | "owner_user_id">;
  detail?: AdminAuditDetail;
}

export interface AdminAuditRow {
  actor: "admin";
  action: AdminAuditAction;
  app_id: string;
  user_id: string | null;
  slug: string;
  detail: AdminAuditDetail;
}

export function adminAuditRow(input: AdminAuditInput): AdminAuditRow {
  return {
    actor: "admin",
    action: input.action,
    app_id: input.app.id,
    user_id: input.app.owner_user_id,
    slug: input.app.slug,
    detail: input.detail ?? {},
  };
}

/** Returns true when the row landed; false (after a structured log) otherwise. */
export async function recordAdminAudit(
  supabase: SupabaseClient,
  input: AdminAuditInput
): Promise<boolean> {
  const row = adminAuditRow(input);
  try {
    const { error } = await supabase.from("admin_audit").insert(row);
    if (!error) return true;
    console.error(
      JSON.stringify({
        msg: "admin audit insert failed",
        user_id: row.user_id,
        app: row.slug,
        action: row.action,
        error: error.message,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "admin audit insert threw",
        user_id: row.user_id,
        app: row.slug,
        action: row.action,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  }
  return false;
}
