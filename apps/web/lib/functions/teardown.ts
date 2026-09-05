/**
 * Backend teardown for account deletion (goal-create-v11 §11, CR16): every
 * vendor resource a user's apps own — D1 database, KV namespace, runtime
 * tokens and their Outbound-KV copies — goes, so nothing is orphaned once the
 * rows cascade away. Script secrets live on the dispatch scripts and vanish
 * with them (teardownAppOrigin). Idempotent: a retry after a partial run
 * finds the ids already cleared or the vendor answering 404.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { FUNCTIONS_COLUMNS, parseFunctionsRow, type FunctionsRow } from "./backend";
import { deleteResources } from "./provision";
import { revokeRuntimeTokens } from "./runtime";

export interface BackendTeardown {
  apps: number;
  databases: number;
  namespaces: number;
}

export async function teardownBackends(
  supabase: SupabaseClient,
  userId: string
): Promise<BackendTeardown> {
  const { data, error } = await supabase
    .from("miniapp_functions")
    .select(FUNCTIONS_COLUMNS)
    .eq("user_id", userId);
  if (error) throw new Error("backend inventory failed");
  const rows = ((data ?? []) as unknown[])
    .map(parseFunctionsRow)
    .filter((row): row is FunctionsRow => row !== null);
  const summary: BackendTeardown = { apps: rows.length, databases: 0, namespaces: 0 };
  for (const row of rows) {
    await deleteResources(row);
    if (row.d1_database_id) summary.databases += 1;
    if (row.kv_namespace_id) summary.namespaces += 1;
    await revokeRuntimeTokens(supabase, row.app_id);
    const { error: clearError } = await supabase
      .from("miniapp_functions")
      .update({
        d1_database_id: null,
        kv_namespace_id: null,
        secret_names: [],
        secret_set_at: {},
        runtime_token_id: null,
        approved_manifest: null,
        status: "disabled",
        deployed_at: null,
      })
      .eq("app_id", row.app_id);
    if (clearError) throw new Error("backend row could not be cleared");
  }
  return summary;
}
