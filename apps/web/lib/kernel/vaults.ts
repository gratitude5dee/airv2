/**
 * Kernel vaults for /shop (Phase 2). Three-store division of labor:
 *  - Kernel vault: wallets + per-purchase card items; only masks/state/ids here.
 *  - air-vault: logins, identity, TOTP — unchanged.
 *  - BYO managers: API keys + tokens — unchanged.
 *
 * PAN custody (C28): the owner's card number never enters airv2. Enrollment
 * happens inside a provider-hosted ceremony; we only ever handle the sealed
 * action URL. Per-purchase cards are minted by `performOperation authorize`
 * in the control plane, and only after the owner approved the frozen,
 * backend-verified purchase object (C29).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vaults } from "@onkernel/sdk/resources";
import {
  KernelError,
  kernelClient,
  kernelFailure,
  kernelVaultName,
} from "./client";
import { ensureKernelAccount } from "./browsers";

export const LINK_WALLET_KEY = "wallet-link";
export const AGENTCARD_WALLET_KEY = "wallet-agentcard";

export interface KernelVault {
  user_id: string;
  project_id: string;
  vault_id: string;
  vault_name: string;
  created_at: string;
  updated_at: string;
}

export interface KernelVaultItem {
  id: string;
  user_id: string;
  vault_id: string;
  item_key: string;
  provider: "link" | "agentcard";
  kind: "wallet" | "card";
  state: string;
  brand: string | null;
  last4: string | null;
  payment_method_id: string | null;
  created_at: string;
  updated_at: string;
}

const ITEM_COLUMNS =
  "id, user_id, vault_id, item_key, provider, kind, state, brand, last4, payment_method_id, created_at, updated_at";

/**
 * Lazily provision `air-vault-<id8>` inside the user's project and ensure the
 * two wallet items exist (one per provider). Wallet upserts are idempotent —
 * Kernel upsert returns the existing item for our deterministic keys.
 */
export async function ensureKernelVault(
  supabase: SupabaseClient,
  userId: string
): Promise<KernelVault> {
  const { data: existing, error } = await supabase
    .from("kernel_vaults")
    .select("user_id, project_id, vault_id, vault_name, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new KernelError("kernel_store_error", "could not read the Kernel vault", 500);
  }
  if (existing) return existing as KernelVault;

  const account = await ensureKernelAccount(supabase, userId);
  const client = kernelClient(account.project_id);
  const name = kernelVaultName(userId);
  let vault;
  try {
    vault = await client.vaults.upsert({ name });
  } catch (cause) {
    throw kernelFailure(cause);
  }

  // Ensure both wallets exist. Link is OAuth-enrolled later via the provider
  // ceremony; AgentCard enrollment likewise rides a hosted action. Both rows
  // start as empty capability stubs — the provider decides readiness.
  const walletSpecs: Array<[
    string,
    Vaults.WalletVaultItemSpec,
  ]> = [
    [
      LINK_WALLET_KEY,
      {
        provider: "link",
        authorization: {
          client: { type: "kernel_managed" },
          method: "oauth",
        },
      },
    ],
    [AGENTCARD_WALLET_KEY, { provider: "agentcard" }],
  ];
  for (const [key, spec] of walletSpecs) {
    try {
      const item = await client.vaults.items.upsert(key, {
        id_or_name: vault.id,
        spec,
        type: "wallet",
      });
      await mirrorItem(supabase, userId, vault.id, item);
    } catch (cause) {
      throw kernelFailure(cause);
    }
  }

  const { data, error: insertError } = await supabase
    .from("kernel_vaults")
    .insert({
      user_id: userId,
      project_id: account.project_id,
      vault_id: vault.id,
      vault_name: name,
    })
    .select("user_id, project_id, vault_id, vault_name, created_at, updated_at")
    .maybeSingle();
  if (insertError || !data) {
    if (insertError?.code === "23505" || !data) {
      const { data: raced } = await supabase
        .from("kernel_vaults")
        .select("user_id, project_id, vault_id, vault_name, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (raced) return raced as KernelVault;
    }
    throw new KernelError("kernel_store_error", "could not persist the Kernel vault", 500);
  }
  return data as KernelVault;
}

function maskOf(
  item: Vaults.VaultItem
): { brand: string | null; last4: string | null } {
  const masks =
    item.type === "card" ? (item.state as { masks?: { brand?: string; last4?: string } }).masks : null;
  return {
    brand: masks?.brand ?? null,
    last4: masks?.last4 ?? null,
  };
}

/** Mirror value-free item metadata — never aliases, never specs, never PAN. */
async function mirrorItem(
  supabase: SupabaseClient,
  userId: string,
  vaultId: string,
  item: Vaults.VaultItem
): Promise<void> {
  const provider = item.type === "card" ? item.spec.provider : item.spec.provider;
  const state = (item.state as { status?: string }).status ?? "unknown";
  const masks = maskOf(item);
  await supabase.from("kernel_vault_items").upsert(
    {
      user_id: userId,
      vault_id: vaultId,
      item_key: item.key,
      provider,
      kind: item.type,
      state,
      brand: masks.brand,
      last4: masks.last4,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "vault_id,item_key" }
  );
}

export async function listKernelVaultItems(
  supabase: SupabaseClient,
  userId: string
): Promise<KernelVaultItem[]> {
  const { data, error } = await supabase
    .from("kernel_vault_items")
    .select(ITEM_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new KernelError("kernel_store_error", "could not list vault items", 500);
  }
  return (data ?? []).map((row) => row as KernelVaultItem);
}

/**
 * Sync vault items from Kernel → mirror rows, and surface the one pending
 * provider action (Link OAuth / card enrollment / spend approval) if any.
 * The action URL is the provider's hosted ceremony; it is sealed at rest and
 * only ever reaches the owner through the action presenter.
 */
export async function syncKernelVaultItems(
  supabase: SupabaseClient,
  userId: string,
  vault: KernelVault
): Promise<{ action: Vaults.VaultItemAction | null }> {
  const client = kernelClient(vault.project_id);
  let pendingAction: Vaults.VaultItemAction | null = null;
  try {
    const items = await client.vaults.items.list(vault.vault_id);
    for (const item of items) {
      await mirrorItem(supabase, userId, vault.vault_id, item);
      if (item.action && !pendingAction) pendingAction = item.action;
    }
  } catch (cause) {
    throw kernelFailure(cause);
  }
  return { action: pendingAction };
}

/** Fetch one item with payment_methods expansion for enrollment UIs. */
export async function getKernelItem(
  supabase: SupabaseClient,
  userId: string,
  vault: KernelVault,
  itemKey: string,
  expand?: ("payment_methods")[]
): Promise<Vaults.VaultItem> {
  const client = kernelClient(vault.project_id);
  try {
    const item = await client.vaults.items.retrieve(itemKey, {
      id_or_name: vault.vault_id,
      ...(expand ? { expand } : {}),
    });
    await mirrorItem(supabase, userId, vault.vault_id, item);
    return item;
  } catch (cause) {
    throw kernelFailure(cause);
  }
}

/**
 * Authorize a Kernel card item for the frozen purchase. Control-plane only
 * (C29): the box never calls Kernel directly — it asks for aliases after the
 * owner's approval resolved here. Returns the minted card item (or throws).
 */
export async function authorizeKernelItem(
  supabase: SupabaseClient,
  userId: string,
  vault: KernelVault,
  itemKey: string
): Promise<Vaults.VaultItem> {
  const client = kernelClient(vault.project_id);
  try {
    const item = await client.vaults.items.performOperation(itemKey, {
      id_or_name: vault.vault_id,
      type: "authorize",
    });
    await mirrorItem(supabase, userId, vault.vault_id, item);
    return item;
  } catch (cause) {
    throw kernelFailure(cause);
  }
}

/** Item events for outcome reconciliation — the submit-once check's evidence. */
export async function kernelItemEvents(
  vault: KernelVault,
  itemKey: string,
  after?: string
): Promise<Vaults.ItemEventsResponse> {
  const client = kernelClient(vault.project_id);
  try {
    return await client.vaults.items.events(itemKey, {
      id_or_name: vault.vault_id,
      ...(after ? { after } : {}),
    });
  } catch (cause) {
    throw kernelFailure(cause);
  }
}
