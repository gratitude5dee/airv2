/**
 * MA3 publisher flow: draft registry rows for user-published apps. The slug
 * is always <username>-<appname> (DB constraint mini_apps_published_slug_
 * format backs this), so it can never collide with a bare reserved word or
 * an existing username — and the reserved list plus the username route close
 * the reverse direction. Publishing (the status flip) is always an owner
 * decision: user-initiated from the Publish surface, or a Needs-you decision
 * when the agent staged the draft.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistryApp } from "./registry";
import { isReservedWord } from "./reserved";

export class PublishError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublishError";
    this.status = status;
  }
}

const APPNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export function validateAppName(appname: string): string {
  const name = appname.toLowerCase().trim();
  if (!APPNAME_PATTERN.test(name)) {
    throw new PublishError(
      "app name must be 1–32 lowercase letters, digits, or hyphens"
    );
  }
  if (isReservedWord(name)) {
    throw new PublishError("that app name is reserved");
  }
  return name;
}

export async function publisherUsername(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: user } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  const username = (user?.username as string | null) ?? null;
  if (!username) {
    throw new PublishError("set a username before publishing", 409);
  }
  return username;
}

export function slugFor(username: string, appname: string): string {
  return `${username}-${appname}`;
}

const REGISTRY_COLUMNS =
  "id, slug, kind, owner_user_id, name, description, icon_key, " +
  "publisher_username, publisher_wallet, agent_identity, visibility, " +
  "access, password_hash, x402_enabled, x402_price_usdc, " +
  "plugin_signin_enabled, status, bundle_version, listed_at, updated_at";

export interface DraftInput {
  appname: string;
  name: string;
  description: string;
  agentIdentity?: string | null;
}

/** Stage a draft registry row (identical path for user and agent drafts). */
export async function createDraft(
  supabase: SupabaseClient,
  userId: string,
  input: DraftInput
): Promise<RegistryApp> {
  const appname = validateAppName(input.appname);
  const username = await publisherUsername(supabase, userId);
  const slug = slugFor(username, appname);
  if (isReservedWord(slug)) {
    throw new PublishError("that app name is reserved");
  }
  const name = input.name.trim().slice(0, 64);
  const description = input.description.trim().slice(0, 500);
  if (!name) throw new PublishError("name required");
  const { data: wallet } = await supabase
    .from("users")
    .select("wallet_address")
    .eq("id", userId)
    .maybeSingle();
  const { data, error } = await supabase
    .from("mini_apps")
    .insert({
      slug,
      route: `/mini/${slug}`,
      kind: "render",
      owner_user_id: userId,
      name,
      description,
      publisher_username: username,
      publisher_wallet: (wallet?.wallet_address as string | null) ?? null,
      agent_identity: input.agentIdentity?.trim().slice(0, 200) || null,
      visibility: "unlisted",
      access: "single",
      status: "draft",
    })
    .select(REGISTRY_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") {
      // Slug exists: refresh the caller's own draft in place; only a slug
      // owned by someone else is actually "taken".
      const { data: refreshed } = await supabase
        .from("mini_apps")
        .update({
          name,
          description,
          agent_identity: input.agentIdentity?.trim().slice(0, 200) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", slug)
        .eq("owner_user_id", userId)
        .select(REGISTRY_COLUMNS)
        .maybeSingle();
      if (refreshed) {
        console.log(
          JSON.stringify({ msg: "miniapp draft refreshed", user_id: userId, slug })
        );
        return refreshed as unknown as RegistryApp;
      }
      throw new PublishError("that app name is taken", 409);
    }
    if (error.code === "23514") {
      throw new PublishError("invalid app slug");
    }
    throw new Error(`draft create failed: ${error.message}`);
  }
  console.log(
    JSON.stringify({ msg: "miniapp draft created", user_id: userId, slug })
  );
  return data as unknown as RegistryApp;
}

/** Owner-scoped lookup: the app must exist and belong to this publisher. */
export async function ownedApp(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<RegistryApp> {
  const { data } = await supabase
    .from("mini_apps")
    .select(REGISTRY_COLUMNS)
    .eq("slug", slug)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data) throw new PublishError("app not found", 404);
  return data as unknown as RegistryApp;
}

/** Delisting = back to draft (status check constraint: draft|published|suspended). */
export type PublishStatusFlip = "published" | "draft";

/**
 * The status flip — always an owner action. Publishing requires an uploaded
 * bundle; the agent can never reach this function (its route only stages
 * drafts + decisions).
 */
export async function setPublishStatus(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  status: PublishStatusFlip,
  visibility?: "public" | "unlisted" | "private"
): Promise<void> {
  const app = await ownedApp(supabase, userId, slug);
  if (status === "published" && !app.bundle_version) {
    throw new PublishError("upload a bundle before publishing", 409);
  }
  const { error } = await supabase
    .from("mini_apps")
    .update({
      status,
      ...(visibility ? { visibility } : {}),
      ...(status === "published" ? { listed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", app.id)
    .eq("owner_user_id", userId);
  if (error) throw new Error(`status flip failed: ${error.message}`);
  console.log(
    JSON.stringify({ msg: "miniapp status flip", user_id: userId, slug, status })
  );
}

export interface EarningsRow {
  slug: string;
  name: string;
  receipts: number;
  total_usdc: number;
}

/**
 * Publisher earnings over x402_receipts (MA3). Stripe storefront revenue
 * joins this view after Session B lands; the shape already accommodates it.
 */
export async function publisherEarnings(
  supabase: SupabaseClient,
  userId: string
): Promise<EarningsRow[]> {
  const { data: apps } = await supabase
    .from("mini_apps")
    .select("id, slug, name")
    .eq("owner_user_id", userId);
  const rows: EarningsRow[] = [];
  for (const app of apps ?? []) {
    const { data: receipts } = await supabase
      .from("x402_receipts")
      .select("amount_usdc")
      .eq("app_id", app.id as string);
    const list = receipts ?? [];
    rows.push({
      slug: app.slug as string,
      name: app.name as string,
      receipts: list.length,
      total_usdc: list.reduce(
        (sum, receipt) => sum + Number(receipt.amount_usdc ?? 0),
        0
      ),
    });
  }
  return rows;
}
