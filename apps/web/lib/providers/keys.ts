/**
 * Personal provider API keys (Settings → "use your own token spend").
 * Values are sealed at rest with AES-256-GCM under PROVIDER_VAULT_KEY
 * (lib/crypto/secretbox.ts) — the same discipline as ad_accounts: never
 * plaintext in Postgres, never echoed to a browser, never delivered to a
 * box. Only server-side callers (the inference gateway and the creative
 * lane) open a sealed key at request time. Postgres carries only the
 * ciphertext plus a display-only last-4 hint.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { openSecret, sealSecret } from "../crypto/secretbox";
import { env } from "../env";

export const PROVIDER_IDS = ["openrouter", "venice", "gmi"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openrouter: "OpenRouter",
  venice: "Venice",
  gmi: "GMI Cloud",
};

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

export function providerVaultAvailable(): boolean {
  return env.providerVaultKey() !== null;
}

/** Display metadata only — never the key. */
export interface ProviderKeyStatus {
  provider: ProviderId;
  hint: string | null;
  updatedAt: string | null;
}

const PRINTABLE_KEY = /^[\x21-\x7e]{8,512}$/;

export type SetProviderKeyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function setProviderKey(
  supabase: SupabaseClient,
  userId: string,
  provider: ProviderId,
  rawKey: string
): Promise<SetProviderKeyResult> {
  const vaultKey = env.providerVaultKey();
  if (!vaultKey) {
    return { ok: false, error: "Personal keys aren't enabled on this deployment." };
  }
  const value = rawKey.trim();
  if (!PRINTABLE_KEY.test(value)) {
    return { ok: false, error: "That doesn't look like an API key." };
  }
  const { error } = await supabase.from("provider_keys").upsert(
    {
      user_id: userId,
      provider,
      api_key_sealed: sealSecret(value, vaultKey),
      key_hint: value.slice(-4),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  return error ? { ok: false, error: "Couldn't save the key — try again." } : { ok: true };
}

export async function clearProviderKey(
  supabase: SupabaseClient,
  userId: string,
  provider: ProviderId
): Promise<boolean> {
  const { error } = await supabase
    .from("provider_keys")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  return !error;
}

/**
 * Opens the user's sealed key for server-side use. Returns null when the
 * user has no key, the vault key is unset, or the ciphertext can't be
 * opened (e.g. after a vault-key rotation) — callers fall back to platform
 * credentials in every null case.
 */
export async function getProviderKey(
  supabase: SupabaseClient,
  userId: string,
  provider: ProviderId
): Promise<string | null> {
  const vaultKey = env.providerVaultKey();
  if (!vaultKey) return null;
  const { data } = await supabase
    .from("provider_keys")
    .select("api_key_sealed")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  const sealed = (data?.api_key_sealed as string | null) ?? null;
  if (!sealed) return null;
  try {
    return openSecret(sealed, vaultKey);
  } catch {
    return null;
  }
}

export async function listProviderKeyStatuses(
  supabase: SupabaseClient,
  userId: string
): Promise<ProviderKeyStatus[]> {
  const { data } = await supabase
    .from("provider_keys")
    .select("provider, key_hint, updated_at")
    .eq("user_id", userId);
  const rows = (data ?? []) as Array<{
    provider: string;
    key_hint: string | null;
    updated_at: string | null;
  }>;
  return PROVIDER_IDS.map((provider) => {
    const row = rows.find((entry) => entry.provider === provider);
    return {
      provider,
      hint: row?.key_hint ?? null,
      updatedAt: row?.updated_at ?? null,
    };
  });
}
