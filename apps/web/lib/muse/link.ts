import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMuseScopes, type MuseGrantInput, type MuseScope } from "./contracts";
import { recordMuseEvent } from "./events";

export interface MuseGrantSummary {
  id: string;
  client_id: string;
  client_name: string | null;
  scopes: MuseScope[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface MuseLinkStatus {
  connected: boolean;
  grants: MuseGrantSummary[];
}

export async function createMuseGrant(
  supabase: SupabaseClient,
  input: MuseGrantInput,
): Promise<MuseGrantSummary> {
  // The connection row makes Muse a first-class connector without storing a
  // Meta identity or credential. There is exactly one active link per owner.
  const now = new Date().toISOString();
  const { error: connectionError } = await supabase.from("connections").upsert(
    {
      user_id: input.userId,
      provider: "muse",
      toolkit: "muse",
      status: "active",
      connected_at: now,
    },
    { onConflict: "user_id,provider,toolkit" },
  );
  if (connectionError) throw new Error(`Muse connection upsert failed: ${connectionError.message}`);

  const scopes = normalizeMuseScopes(input.scopes);
  const { data, error } = await supabase
    .from("muse_grants")
    .insert({
      user_id: input.userId,
      client_id: input.clientId.slice(0, 512),
      client_name: input.clientName?.slice(0, 160) ?? null,
      scopes,
    })
    .select("id, client_id, client_name, scopes, created_at, last_used_at, revoked_at")
    .single();
  if (error || !data) throw new Error(`Muse grant create failed: ${error?.message ?? "unknown error"}`);
  // OAuthProvider replaces a previous grant for this owner/client when it
  // completes authorization. Mirror that replacement in the control-plane
  // ledger so the mini-app and revocation logic cannot show a stale grant as
  // active. Different Muse clients may still have independent grants.
  const { error: revokeError } = await supabase
    .from("muse_grants")
    .update({ revoked_at: now })
    .eq("user_id", input.userId)
    .eq("client_id", input.clientId.slice(0, 512))
    .neq("id", data.id)
    .is("revoked_at", null);
  if (revokeError) throw new Error(`Muse grant rotation failed: ${revokeError.message}`);
  await recordMuseEvent(supabase, { userId: input.userId, kind: "grant", status: "active" });
  return toGrantSummary(data);
}

export async function listMuseLink(
  supabase: SupabaseClient,
  userId: string,
): Promise<MuseLinkStatus> {
  const [{ data: connection }, { data: grants, error }] = await Promise.all([
    supabase
      .from("connections")
      .select("status")
      .eq("user_id", userId)
      .eq("provider", "muse")
      .eq("toolkit", "muse")
      .maybeSingle(),
    supabase
      .from("muse_grants")
      .select("id, client_id, client_name, scopes, created_at, last_used_at, revoked_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error(`Muse grants read failed: ${error.message}`);
  return {
    connected: connection?.status === "active",
    grants: (grants ?? []).map(toGrantSummary),
  };
}

export async function revokeMuseGrant(
  supabase: SupabaseClient,
  userId: string,
  grantId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("muse_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id");
  if (error) throw new Error(`Muse grant revoke failed: ${error.message}`);
  return (data?.length ?? 0) === 1;
}

/** Marks all grants and the connector link inactive. Worker revocation is separate. */
export async function revokeMuseLink(
  supabase: SupabaseClient,
  userId: string,
): Promise<MuseGrantSummary[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("muse_grants")
    .update({ revoked_at: now })
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id, client_id, client_name, scopes, created_at, last_used_at, revoked_at");
  if (error) throw new Error(`Muse link revoke failed: ${error.message}`);
  await supabase
    .from("connections")
    .update({ status: "revoked" })
    .eq("user_id", userId)
    .eq("provider", "muse")
    .eq("toolkit", "muse");
  return (data ?? []).map(toGrantSummary);
}

export async function touchMuseGrant(
  supabase: SupabaseClient,
  grantId: string,
): Promise<void> {
  await supabase
    .from("muse_grants")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", grantId)
    .is("revoked_at", null);
}

function toGrantSummary(row: Record<string, unknown>): MuseGrantSummary {
  return {
    id: row["id"] as string,
    client_id: row["client_id"] as string,
    client_name: (row["client_name"] as string | null) ?? null,
    scopes: normalizeMuseScopes((row["scopes"] as string[] | null) ?? []),
    created_at: row["created_at"] as string,
    last_used_at: (row["last_used_at"] as string | null) ?? null,
    revoked_at: (row["revoked_at"] as string | null) ?? null,
  };
}
