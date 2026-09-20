import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashPluginToken } from "../plugin/auth";
import { normalizeMuseScopes, type MuseScope } from "./contracts";

export interface MuseKeySummary {
  id: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  scopes: MuseScope[];
}

export interface MuseKeyPrincipal {
  userId: string;
  tokenId: string;
  scopes: MuseScope[];
}

/** Returned exactly once. The stored value is HMAC-hashed like plugin keys. */
export async function mintMuseKey(
  supabase: SupabaseClient,
  userId: string,
  requestedScopes: readonly string[],
): Promise<{ token: string; summary: MuseKeySummary }> {
  const scopes = normalizeMuseScopes(requestedScopes);
  if (scopes.length === 0) throw new Error("at least one Muse scope is required");
  const token = `wzrd_muse_${randomBytes(32).toString("base64url")}`;
  const { data, error } = await supabase
    .from("plugin_tokens")
    .insert({
      user_id: userId,
      tool: "muse",
      token_hash: hashPluginToken(token),
      scopes,
    })
    .select("id, created_at, last_used_at, revoked_at, scopes")
    .single();
  if (error || !data) throw new Error(`Muse key mint failed: ${error?.message ?? "unknown error"}`);
  return {
    token,
    summary: {
      id: data.id as string,
      created_at: data.created_at as string,
      last_used_at: (data.last_used_at as string | null) ?? null,
      revoked_at: (data.revoked_at as string | null) ?? null,
      scopes: normalizeMuseScopes((data.scopes as string[] | null) ?? []),
    },
  };
}

export async function verifyMuseKey(
  supabase: SupabaseClient,
  token: string,
): Promise<MuseKeyPrincipal | null> {
  if (!token.startsWith("wzrd_muse_")) return null;
  const { data, error } = await supabase
    .from("plugin_tokens")
    .select("id, user_id, scopes, revoked_at")
    .eq("tool", "muse")
    .eq("token_hash", hashPluginToken(token))
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  await supabase
    .from("plugin_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return {
    userId: data.user_id as string,
    tokenId: data.id as string,
    scopes: normalizeMuseScopes((data.scopes as string[] | null) ?? []),
  };
}

export async function listMuseKeys(
  supabase: SupabaseClient,
  userId: string,
): Promise<MuseKeySummary[]> {
  const { data, error } = await supabase
    .from("plugin_tokens")
    .select("id, created_at, last_used_at, revoked_at, scopes")
    .eq("user_id", userId)
    .eq("tool", "muse")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    created_at: row.created_at as string,
    last_used_at: (row.last_used_at as string | null) ?? null,
    revoked_at: (row.revoked_at as string | null) ?? null,
    scopes: normalizeMuseScopes((row.scopes as string[] | null) ?? []),
  }));
}

export async function revokeMuseKey(
  supabase: SupabaseClient,
  userId: string,
  tokenId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("plugin_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("user_id", userId)
    .eq("tool", "muse")
    .is("revoked_at", null)
    .select("id");
  return !error && (data?.length ?? 0) === 1;
}
