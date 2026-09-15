/**
 * Provider-action presenter (Phase 2). Kernel items expose single-purpose
 * hosted ceremonies — Link OAuth, card enrollment, spend approval — as
 * `item.action.url`. Those URLs are bearer credentials (C27): they are sealed
 * at rest, delivered to the owner once through a fragment-token presenter
 * (the checkout-launch shape), and redeemed exactly once. The 302 to the
 * provider is a fresh redirect, so the URL never reaches access logs,
 * previews, Referer headers, or the model transcript.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vaults } from "@onkernel/sdk/resources";
import { KernelError, openKernelUrl, sealKernelUrl } from "./client";
import { mintToken } from "../miniapps/tokens";
import { env } from "../env";

const ACTION_TTL_MINUTES = 5;

export interface KernelAction {
  id: string;
  user_id: string;
  item_key: string | null;
  action: string;
  expires_at: string;
  redeemed_at: string | null;
  created_at: string;
}

const COLUMNS =
  "id, user_id, item_key, action, url_sealed, expires_at, redeemed_at, created_at";

interface KernelActionRow extends KernelAction {
  url_sealed: string;
}

/** The one-sentence host label each action name renders on the presenter. */
export const ACTION_LABELS: Record<string, string> = {
  link_oauth: "connect your Link wallet",
  spend_approval: "approve this spend",
  push_approval: "approve this request",
  collect: "confirm this collection",
  mfa: "verify this sign-in",
  embedded_ceremony: "finish the setup ceremony",
  card_enrollment: "enroll a payment card",
};

/** Persist a provider action and mint the owner-facing launch URL. The
 * minted URL carries its token in the fragment — never in a request path. */
export async function stageKernelAction(
  supabase: SupabaseClient,
  userId: string,
  action: Vaults.VaultItemAction,
  itemKey: string | null
): Promise<{ id: string; url: string }> {
  const url = "url" in action && typeof action.url === "string" ? action.url : null;
  if (!url) {
    throw new KernelError(
      "kernel_action_unsupported",
      "this provider action has no hosted URL to present",
      400
    );
  }
  const expiresAt = new Date(Date.now() + ACTION_TTL_MINUTES * 60_000);
  const { data, error } = await supabase
    .from("kernel_actions")
    .insert({
      user_id: userId,
      item_key: itemKey,
      action: action.name,
      url_sealed: sealKernelUrl(url, "action"),
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new KernelError(
      "kernel_store_error",
      "could not stage the provider action",
      500
    );
  }
  const id = data.id as string;
  const token = mintToken(
    userId,
    "kernel-action",
    id,
    ACTION_TTL_MINUTES,
    { role: "owner" }
  );
  return { id, url: `${env.miniappOrigin()}/api/kernel/action/${id}#t=${token}` };
}

/** Presenter exchange: single-use, still-valid, same-owner. */
export async function redeemKernelAction(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ url: string } | null> {
  const { data, error } = await supabase
    .from("kernel_actions")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as KernelActionRow;
  if (row.redeemed_at) return null;
  if (Date.parse(row.expires_at) <= Date.now()) return null;
  // Claim before handing out the URL — a lost race means the URL was already
  // delivered once, and provider ceremonies are single-consumer.
  const { data: claimed, error: claimError } = await supabase
    .from("kernel_actions")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("redeemed_at", null)
    .select("id");
  if (claimError || !claimed || claimed.length === 0) return null;
  const url = openKernelUrl(row.url_sealed, "action");
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url };
}
