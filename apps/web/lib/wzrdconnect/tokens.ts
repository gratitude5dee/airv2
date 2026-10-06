/**
 * Per-user WZRD Connect runtime tokens (R-CONN-01). One token per user on
 * the worker; the `allowedConnections` policy is the entire isolation
 * boundary — the box's calls only resolve to connection ids on this list.
 *
 * Two invariants the caller must never break:
 *  - `allowedConnections` is never stored empty: the worker treats an empty
 *    list as UNRESTRICTED (every admin connection reachable), so a
 *    placeholder id stands in until the first grant lands.
 *  - The oct_ secret is stored on the users row because the worker returns
 *    it once at mint time; its blast radius is the user's own grants, and
 *    it is revocable via DELETE /api/runtime-tokens/:id.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "../db";
import {
  createRuntimeToken,
  listRuntimeTokens,
  updateRuntimeToken,
} from "./client";

const UNGRANTED_PLACEHOLDER = "__ungranted__";

export async function ensureWzrdConnectToken(
  supabase: SupabaseClient,
  userId: string
): Promise<{ token: string; tokenId: string }> {
  const { data } = await supabase
    .from("users")
    .select("wzrd_connect_token, wzrd_connect_token_id")
    .eq("id", userId)
    .maybeSingle();
  const token = data?.wzrd_connect_token as string | null | undefined;
  const tokenId = data?.wzrd_connect_token_id as string | null | undefined;
  if (token && tokenId) {
    return { token, tokenId };
  }
  const created = await createRuntimeToken(`air-${userId}`, {
    allowedConnections: [UNGRANTED_PLACEHOLDER],
  });
  await db.write(
    supabase
      .from("users")
      .update({
        wzrd_connect_token: created.token,
        wzrd_connect_token_id: created.record.id,
      })
      .eq("id", userId),
    { what: "wzrd runtime token persist", user_id: userId }
  );
  return { token: created.token, tokenId: created.record.id };
}

/**
 * The worker's PUT replaces the whole policy — send the merged grant list
 * back with every other list exactly as the live record has it.
 */
async function putGrantList(
  tokenId: string,
  record: { allowedActions?: string[]; blockedActions?: string[]; allowedProxies?: string[]; allowedTriggers?: string[] } | undefined,
  allowedConnections: string[]
): Promise<void> {
  await updateRuntimeToken(tokenId, {
    allowedConnections,
    allowedActions: record?.allowedActions ?? [],
    blockedActions: record?.blockedActions ?? [],
    allowedProxies: record?.allowedProxies ?? [],
    allowedTriggers: record?.allowedTriggers ?? [],
  });
}

/** Add a connection id to the user's runtime-token grant list. */
export async function grantWzrdConnection(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string
): Promise<void> {
  const { tokenId } = await ensureWzrdConnectToken(supabase, userId);
  const tokens = await listRuntimeTokens();
  const record = tokens.find((t) => t.id === tokenId);
  const current = record?.allowedConnections ?? [UNGRANTED_PLACEHOLDER];
  if (current.includes(connectionId)) return;
  await putGrantList(tokenId, record, [
    ...current.filter((id) => id !== UNGRANTED_PLACEHOLDER),
    connectionId,
  ]);
}

/** Remove a connection id from the user's runtime-token grant list. */
export async function revokeWzrdConnection(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string
): Promise<void> {
  const { data } = await supabase
    .from("users")
    .select("wzrd_connect_token_id")
    .eq("id", userId)
    .maybeSingle();
  const tokenId = data?.wzrd_connect_token_id as string | null | undefined;
  if (!tokenId) return;
  const tokens = await listRuntimeTokens();
  const record = tokens.find((t) => t.id === tokenId);
  const remaining = (record?.allowedConnections ?? []).filter(
    (id) => id !== connectionId
  );
  await putGrantList(
    tokenId,
    record,
    remaining.length > 0 ? remaining : [UNGRANTED_PLACEHOLDER]
  );
}
