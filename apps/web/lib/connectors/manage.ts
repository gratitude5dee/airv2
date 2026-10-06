/**
 * Connector lifecycle shared by /api/connectors and the MA5 connect
 * mini-app — one code path for connect/sync/disconnect so the store surface
 * never grows its own mutation logic. The browser sees toolkit names and
 * connection statuses only; provider credentials and the per-user MCP
 * endpoint never leave the server (M7, C10).
 *
 * R-CONN-01: two backends live behind the same lifecycle. CONNECTOR_PROVIDER
 * picks which one new connects go through; existing connections rows carry
 * their own `provider` ("composio" | "wzrd_connect") so sync/disconnect keep
 * working for both during the side-by-side rollout — a user who linked
 * Gmail on Composio keeps it while new connects mint WZRD Connect rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import {
  ComposioApiError,
  createLinkSession,
  deleteConnectedAccount,
  listAllConnectedAccounts,
} from "../composio/client";
import {
  createOAuthRequest,
  disconnectConnection,
  getConnectionRequest,
  WzrdConnectApiError,
} from "../wzrdconnect/client";
import {
  wzrdConnectionAlias,
  wzrdServiceFor,
} from "../wzrdconnect/slugs";
import {
  grantWzrdConnection,
  revokeWzrdConnection,
} from "../wzrdconnect/tokens";
import { excludedConnectorProvider } from "./provider";
import {
  ensureComposioSession,
  installComposioMcp,
  installWzrdConnectMcp,
  writeConnectedToolsFile,
} from "../provisioning/connectors";
import { log } from "../log";
import { db } from "../db";

export const TOOLKIT_SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;

/** Composio account states where authorization can still complete. */
const LIVE_ACCOUNT_STATUSES = new Set(["INITIALIZING", "INITIATED", "ACTIVE"]);

export interface ConnectionRow {
  toolkit: string;
  status: string;
  connected_at: string | null;
}

/** Mint a hosted connect flow and mirror the pending row. */
export async function beginConnect(
  supabase: SupabaseClient,
  userId: string,
  toolkit: string,
  callbackUrl: string
): Promise<{ redirect_url: string }> {
  if (env.connectorProvider() === "wzrd") {
    // open-connector's console OAuth path names the connection up front —
    // the deterministic alias is how the box proxy addresses it later.
    const request = await createOAuthRequest({
      service: wzrdServiceFor(toolkit),
      connectionName: wzrdConnectionAlias(userId),
    });
    await db.write(
      supabase.from("connections").upsert(
        {
          user_id: userId,
          provider: "wzrd_connect",
          toolkit,
          external_account_id: request.connectionRequestId,
          status: "pending",
        },
        { onConflict: "user_id,provider,toolkit" }
      ),
      { what: "wzrd pending connection mirror", user_id: userId }
    );
    return { redirect_url: request.authorizationUrl };
  }
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

/** Sync statuses from the owning provider; install the MCP endpoint on
 *  first active. Rows from both backends reconcile every call so an
 *  in-flight Composio link still lands while WZRD Connect is primary. */
export async function syncConnections(
  supabase: SupabaseClient,
  userId: string
): Promise<ConnectionRow[]> {
  const { data: allRows } = await supabase
    .from("connections")
    .select("id, toolkit, status, provider, external_account_id")
    .eq("user_id", userId);
  const rows = allRows ?? [];
  let newlyActive = false;
  let newlyActiveWzrd = false;
  let changed = false;

  const composioRows = rows.filter((row) => row.provider !== "wzrd_connect");
  if (composioRows.length > 0) {
    const accounts = await listAllConnectedAccounts(userId);
    const activeByToolkit = new Map(
      accounts
        .filter((a) => a.toolkit?.slug && a.status === "ACTIVE")
        .map((a) => [a.toolkit?.slug as string, a.id])
    );
    const statusById = new Map(accounts.map((a) => [a.id, a.status ?? ""]));
    for (const row of composioRows) {
      const accountId = activeByToolkit.get(row.toolkit as string);
      if (accountId && row.status !== "active") {
        newlyActive = true;
        changed = true;
        await supabase
          .from("connections")
          .update({
            status: "active",
            external_account_id: accountId,
            connected_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }
      // A pending row whose Connect Link died (EXPIRED/FAILED at Composio, or
      // gone entirely) will never activate — surface it as disconnected so
      // the UI offers a fresh Connect instead of an eternal "pending".
      if (row.status === "pending" && !accountId) {
        const accountStatus = row.external_account_id
          ? (statusById.get(row.external_account_id as string) ?? null)
          : null;
        if (!accountStatus || !LIVE_ACCOUNT_STATUSES.has(accountStatus)) {
          changed = true;
          await supabase
            .from("connections")
            .update({ status: "revoked" })
            .eq("id", row.id);
        }
      }
    }
  }

  for (const row of rows.filter((r) => r.provider === "wzrd_connect")) {
    if (row.status !== "pending" || !row.external_account_id) continue;
    // Pending wzrd rows mirror an OAuth connection request; on "connected"
    // the request's appId becomes the row's external id and the user's
    // runtime token gains the grant in the same pass.
    let request;
    try {
      request = await getConnectionRequest(row.external_account_id as string);
    } catch (error) {
      if (!(error instanceof WzrdConnectApiError && error.status === 404)) {
        throw error;
      }
      request = null;
    }
    if (request?.status === "connected" && request.appId) {
      changed = true;
      newlyActiveWzrd = true;
      await db.write(
        supabase
          .from("connections")
          .update({
            status: "active",
            external_account_id: request.appId,
            connected_at: new Date().toISOString(),
          })
          .eq("id", row.id),
        { what: "wzrd connection activation", user_id: userId }
      );
      await grantWzrdConnection(supabase, userId, request.appId);
      continue;
    }
    if (
      !request ||
      request.status === "failed" ||
      request.status === "expired"
    ) {
      changed = true;
      await db.write(
        supabase
          .from("connections")
          .update({ status: "revoked" })
          .eq("id", row.id),
        { what: "wzrd dead request mirror", user_id: userId }
      );
    }
  }

  if (newlyActive) {
    try {
      await installComposioMcp(supabase, userId);
    } catch (error) {
      log.error("composio mcp install failed", {user_id: userId,
          error: error instanceof Error ? error.message : String(error),});
    }
  }
  if (newlyActiveWzrd) {
    try {
      await installWzrdConnectMcp(supabase, userId);
    } catch (error) {
      log.error("wzrd connect mcp install failed", {user_id: userId,
          error: error instanceof Error ? error.message : String(error),});
    }
  }
  if (changed) await refreshConnectedTools(supabase, userId);
  const { data: refreshed } = await supabase
    .from("connections")
    .select("toolkit, status, connected_at")
    .eq("user_id", userId);
  return (refreshed ?? []) as ConnectionRow[];
}

export type DisconnectResult = "ok" | "not_found" | "revoke_failed";

/** Disconnect: revoke the account at its owning provider, then mark the
 *  mirror. Matches the row the active backend owns so a leftover mirror
 *  from the other provider is never touched by mistake. */
export async function disconnectToolkit(
  supabase: SupabaseClient,
  userId: string,
  toolkit: string
): Promise<DisconnectResult> {
  const { data } = await supabase
    .from("connections")
    .select("id, provider, external_account_id, status")
    .eq("user_id", userId)
    .neq("provider", excludedConnectorProvider())
    .eq("toolkit", toolkit)
    .maybeSingle();
  const row = data as {
    id: string;
    provider: string;
    external_account_id: string | null;
    status: string;
  } | null;
  if (!row) return "not_found";

  if (row.provider === "wzrd_connect") {
    if (row.status === "active") {
      try {
        await disconnectConnection({
          service: wzrdServiceFor(toolkit),
          connectionName: wzrdConnectionAlias(userId),
        });
      } catch (error) {
        // A 404 means the worker already forgot it — revoke is done.
        if (!(error instanceof WzrdConnectApiError && error.status === 404)) {
          return "revoke_failed";
        }
      }
      if (row.external_account_id) {
        await revokeWzrdConnection(
          supabase,
          userId,
          row.external_account_id
        ).catch((error: unknown) => {
          // The connection itself is gone; a stale grant is harmless
          // (its id no longer resolves), so don't fail the disconnect.
          log.error("wzrd token ungrant failed", {user_id: userId,
              error: error instanceof Error ? error.message : String(error),});
        });
      }
    }
    await db.write(
      supabase
        .from("connections")
        .update({ status: "revoked" })
        .eq("id", row.id),
      { what: "wzrd disconnect mirror", user_id: userId }
    );
    await refreshConnectedTools(supabase, userId);
    return "ok";
  }

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
  await refreshConnectedTools(supabase, userId);
  return "ok";
}

/** Best-effort: the agent's connected-tools note must never fail a mutation. */
async function refreshConnectedTools(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    await writeConnectedToolsFile(supabase, userId);
  } catch (error) {
    log.error("connected-tools write failed", {user_id: userId,
        error: error instanceof Error ? error.message : String(error),});
  }
}
