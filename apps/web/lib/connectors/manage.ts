/**
 * Connector lifecycle shared by /api/connectors and the MA5 connect
 * mini-app — one code path for connect/sync/disconnect so the store surface
 * never grows its own mutation logic. The browser sees toolkit names and
 * connection statuses only; Composio credentials and the per-user MCP
 * endpoint never leave the server (M7, C10).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ComposioApiError,
  createLinkSession,
  deleteConnectedAccount,
  listConnectedAccounts,
} from "../composio/client";
import {
  ensureComposioSession,
  installComposioMcp,
} from "../provisioning/connectors";

export const TOOLKIT_SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;

export interface ConnectionRow {
  toolkit: string;
  status: string;
  connected_at: string | null;
}

/** Mint a hosted Connect Link and mirror the pending row. */
export async function beginConnect(
  supabase: SupabaseClient,
  userId: string,
  toolkit: string,
  callbackUrl: string
): Promise<{ redirect_url: string }> {
  const { sessionId } = await ensureComposioSession(supabase, userId);
  const link = await createLinkSession(sessionId, toolkit, callbackUrl);
  await supabase.from("connections").upsert(
    {
      user_id: userId,
      provider: "composio",
      toolkit,
      external_account_id: link.connected_account_id,
      status: "pending",
    },
    { onConflict: "user_id,provider,toolkit" }
  );
  return { redirect_url: link.redirect_url };
}

/** Sync statuses from Composio; install the MCP endpoint on first active. */
export async function syncConnections(
  supabase: SupabaseClient,
  userId: string
): Promise<ConnectionRow[]> {
  const [accounts, { data: rows }] = await Promise.all([
    listConnectedAccounts(userId),
    supabase
      .from("connections")
      .select("id, toolkit, status")
      .eq("user_id", userId),
  ]);
  const activeByToolkit = new Map(
    accounts
      .filter((a) => a.toolkit?.slug)
      .map((a) => [a.toolkit?.slug as string, a.id])
  );
  let newlyActive = false;
  for (const row of rows ?? []) {
    const accountId = activeByToolkit.get(row.toolkit as string);
    if (accountId && row.status !== "active") {
      newlyActive = true;
      await supabase
        .from("connections")
        .update({
          status: "active",
          external_account_id: accountId,
          connected_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }
  if (newlyActive) {
    try {
      await installComposioMcp(supabase, userId);
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "composio mcp install failed",
          user_id: userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
  const { data: refreshed } = await supabase
    .from("connections")
    .select("toolkit, status, connected_at")
    .eq("user_id", userId);
  return (refreshed ?? []) as ConnectionRow[];
}

export type DisconnectResult = "ok" | "not_found" | "revoke_failed";

/** Disconnect: revoke the account with Composio, then mark the mirror. */
export async function disconnectToolkit(
  supabase: SupabaseClient,
  userId: string,
  toolkit: string
): Promise<DisconnectResult> {
  const { data } = await supabase
    .from("connections")
    .select("id, external_account_id, status")
    .eq("user_id", userId)
    .eq("provider", "composio")
    .eq("toolkit", toolkit)
    .maybeSingle();
  const row = data as {
    id: string;
    external_account_id: string | null;
    status: string;
  } | null;
  if (!row) return "not_found";
  if (row.external_account_id) {
    try {
      await deleteConnectedAccount(row.external_account_id);
    } catch (error) {
      // Already gone at Composio → the revoke is done; anything else is a
      // real failure and the mirror must NOT claim revoked.
      if (!(error instanceof ComposioApiError && error.status === 404)) {
        return "revoke_failed";
      }
    }
  }
  await supabase
    .from("connections")
    .update({ status: "revoked" })
    .eq("id", row.id);
  return "ok";
}
