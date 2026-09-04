/**
 * MA3 publisher flow: draft registry rows for user-published apps. The slug
 * is always <username>-<appname> (DB constraint mini_apps_published_slug_
 * format backs this), so it can never collide with a bare reserved word or
 * an existing username — and the reserved list plus the username route close
 * the reverse direction. Publishing (the status flip) is always an owner
 * decision: user-initiated from the Publish surface, or a Needs-you decision
 * when the agent staged the draft.
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashPassword } from "./gates";
import { asRecord } from "../records";
import { getVersion, pointLiveAt } from "../create/versions";
import {
  AppOriginRefusedError,
  promoteVersion,
  syncManifest,
} from "../functions/deploy";
import {
  REGISTRY_COLUMNS,
  parseNullableNumeric,
  parseRegistryApp,
  type CreateLane,
  type RegistryApp,
} from "./registry";
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
  const username = typeof user?.username === "string" ? user.username : null;
  if (!username) {
    throw new PublishError("set a username before publishing", 409);
  }
  return username;
}

export function slugFor(username: string, appname: string): string {
  return `${username}-${appname}`;
}

export interface DraftInput {
  appname: string;
  name: string;
  description: string;
  agentIdentity?: string | null;
  /** V11 lane that produced the project; absent for pre-V11 publisher drafts. */
  lane?: CreateLane | undefined;
}

type DraftResult = Pick<RegistryApp, "id" | "slug" | "name">;

function parseDraftResult(value: unknown): DraftResult | null {
  const row = asRecord(value);
  if (!row) return null;
  return typeof row["id"] === "string" &&
    typeof row["slug"] === "string" &&
    typeof row["name"] === "string"
    ? { id: row["id"], slug: row["slug"], name: row["name"] }
    : null;
}

/** Stage a draft registry row (identical path for user and agent drafts). */
export async function createDraft(
  supabase: SupabaseClient,
  userId: string,
  input: DraftInput
): Promise<DraftResult> {
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
      appname,
      route: `/mini/${slug}`,
      kind: "render",
      owner_user_id: userId,
      name,
      description,
      publisher_username: username,
      publisher_wallet:
        typeof wallet?.wallet_address === "string"
          ? wallet.wallet_address
          : null,
      agent_identity: input.agentIdentity?.trim().slice(0, 200) || null,
      ...(input.lane ? { lane: input.lane } : {}),
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
          ...(input.lane ? { lane: input.lane } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("slug", slug)
        .eq("owner_user_id", userId)
        .select(REGISTRY_COLUMNS)
        .maybeSingle();
      const parsedRefreshed = parseDraftResult(refreshed);
      if (parsedRefreshed) {
        console.log(
          JSON.stringify({ msg: "miniapp draft refreshed", user_id: userId, slug })
        );
        return parsedRefreshed;
      }
      throw new PublishError("that app name is taken", 409);
    }
    if (error.code === "23514") {
      throw new PublishError("invalid app slug");
    }
    if (error.message.includes("account is being deleted")) {
      throw new PublishError("account is being deleted", 409);
    }
    if (error.message.includes("app name is on hold")) {
      throw new PublishError("that app name was just deleted; try again in an hour", 409);
    }
    throw new Error(`draft create failed: ${error.message}`);
  }
  console.log(
    JSON.stringify({ msg: "miniapp draft created", user_id: userId, slug })
  );
  const parsed = parseDraftResult(data);
  if (!parsed) throw new Error("draft create returned an invalid row");
  return parsed;
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
  const parsed = parseRegistryApp(data);
  if (!parsed) throw new PublishError("app not found", 404);
  return parsed;
}

/** Delisting = back to draft (status check constraint: draft|published|suspended). */
export type PublishStatusFlip = "published" | "draft";

/**
 * The status flip — always an owner action. Publishing requires an uploaded
 * bundle; the agent can never reach this function (its route only stages
 * drafts + decisions).
 *
 * V11 §13.2: when the bundle has a miniapp_versions row, publishing also
 * copies the draft Worker to the live script and writes the KV manifest, so
 * the app origin serves the version the owner previewed. Delisting writes
 * the manifest too — the app origin stops answering before the row flips.
 *
 * A staged draft (`draft_version` ahead of `bundle_version`, what a Drop onto
 * a live app leaves behind) is what "publish" makes live: the pointer moves
 * to it under the same compare-and-swap as a rollback, and a lost swap puts
 * the live Worker back on the release the registry still names. When the
 * metadata write after the swap fails on an app that was already live, the
 * previous release comes back too (Worker first, then the pointer) so a
 * request that reports failure never leaves the staged draft serving.
 */
export async function setPublishStatus(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  status: PublishStatusFlip,
  visibility?: "public" | "unlisted" | "private"
): Promise<void> {
  const app = await ownedApp(supabase, userId, slug);
  const staged =
    app.draft_version && app.draft_version !== app.bundle_version
      ? app.draft_version
      : null;
  const target = staged ?? app.bundle_version;
  if (status === "published" && !target) {
    throw new PublishError("upload a bundle before publishing", 409);
  }
  const version = target && (await getVersion(supabase, app.id, target));
  if (status === "published" && staged && !version) {
    throw new PublishError("that draft's files are no longer stored", 409);
  }
  try {
    if (status === "published" && version) {
      await promoteVersion(supabase, app, version.version);
    }
    if (status === "draft") {
      await syncManifest(supabase, { ...app, status: "draft" });
    }
  } catch (error) {
    if (error instanceof AppOriginRefusedError) {
      throw new PublishError("app is being deleted", 409);
    }
    throw error;
  }
  if (status === "published" && version) {
    try {
      await pointLiveAt(supabase, app, version.version);
    } catch (error) {
      if (staged && app.bundle_version) {
        await promoteVersion(supabase, app, app.bundle_version).catch(() => null);
      }
      throw error;
    }
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
  if (error) {
    // The manifest already moved; put it back to what the registry still
    // says so a delist that failed to flip does not leave the app dark (or a
    // first publish that failed to flip serving). A first publish keeps its
    // moved pointer — the row still says draft, so nothing serves — while a
    // live app gets its previous release restored before the error surfaces.
    const restored =
      status === "published" && version && staged && app.status === "published"
        ? await restoreRelease(supabase, app, version.version)
        : false;
    await syncManifest(
      supabase,
      status === "published" && version && !restored
        ? { ...app, bundle_version: version.version }
        : app
    ).catch(() => false);
    throw new Error(`status flip failed: ${error.message}`);
  }
  if (status === "published" && version) {
    try {
      await syncManifest(supabase, {
        ...app,
        status: "published",
        bundle_version: version.version,
      });
    } catch (error) {
      if (error instanceof AppOriginRefusedError) {
        throw new PublishError("app is being deleted", 409);
      }
      throw error;
    }
  }
  console.log(
    JSON.stringify({ msg: "miniapp status flip", user_id: userId, slug, status })
  );
}

/**
 * Undo a staged-draft publication that got as far as the pointer: the live
 * Worker goes back to the release `app` observed, then the pointer swaps
 * back from `from` under the same compare-and-swap. False when either step
 * failed and the registry's new pointer must stand.
 */
async function restoreRelease(
  supabase: SupabaseClient,
  app: RegistryApp,
  from: string
): Promise<boolean> {
  const previous = app.bundle_version;
  if (!previous) return false;
  try {
    await promoteVersion(supabase, app, previous);
    await pointLiveAt(supabase, { ...app, bundle_version: from }, previous);
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "miniapp release restore failed",
        slug: app.slug,
        version: from,
        previous,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return false;
  }
}

/**
 * Gate settings a publisher can change on an owned app (P0-4). Every field
 * is optional — only the keys present are written. `password` arrives as
 * plaintext and is stored as a scrypt hash (null clears the gate); payout
 * routing (publisher_wallet) is never touched here.
 */
export interface GateSettingsInput {
  access?: "single" | "multiplayer";
  x402Enabled?: boolean;
  x402PriceUsdc?: number | null;
  password?: string | null;
  pluginSigninEnabled?: boolean;
}

const MAX_PRICE_USDC = 9999.999999; // numeric(10,6) column bound

interface GateSettingsRow {
  id: string;
  owner_user_id: string | null;
  x402_enabled: boolean;
  x402_price_usdc: number | null;
}

export function parseGateSettingsRow(value: unknown): GateSettingsRow | null {
  const row = asRecord(value);
  if (!row) return null;
  const x402PriceUsdc = parseNullableNumeric(row["x402_price_usdc"]);
  if (
    typeof row["id"] !== "string" ||
    (row["owner_user_id"] !== null &&
      typeof row["owner_user_id"] !== "string") ||
    typeof row["x402_enabled"] !== "boolean" ||
    x402PriceUsdc === undefined
  ) {
    return null;
  }
  return {
    id: row["id"],
    owner_user_id: row["owner_user_id"],
    x402_enabled: row["x402_enabled"],
    x402_price_usdc: x402PriceUsdc,
  };
}

function validPrice(price: number): boolean {
  return Number.isFinite(price) && price > 0 && price <= MAX_PRICE_USDC;
}

/** Owner-scoped gate-settings update; 403 when the app belongs to someone else. */
export async function updateGateSettings(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  input: GateSettingsInput
): Promise<void> {
  const { data: app } = await supabase
    .from("mini_apps")
    .select(REGISTRY_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  const owned = parseGateSettingsRow(app);
  if (!owned) throw new PublishError("app not found", 404);
  if (owned.owner_user_id !== userId) {
    throw new PublishError("not your app", 403);
  }

  const update: Record<string, unknown> = {};
  if (input.access !== undefined) update["access"] = input.access;

  if (input.x402Enabled !== undefined) {
    if (input.x402Enabled) {
      const price =
        input.x402PriceUsdc !== undefined && input.x402PriceUsdc !== null
          ? input.x402PriceUsdc
          : owned.x402_price_usdc;
      if (typeof price !== "number" || !validPrice(price)) {
        throw new PublishError(
          "a positive USDC price is required to enable x402"
        );
      }
      update["x402_enabled"] = true;
      update["x402_price_usdc"] = price;
    } else {
      update["x402_enabled"] = false;
      if (input.x402PriceUsdc !== undefined) {
        if (input.x402PriceUsdc !== null && !validPrice(input.x402PriceUsdc)) {
          throw new PublishError("invalid x402 price");
        }
        update["x402_price_usdc"] = input.x402PriceUsdc;
      }
    }
  } else if (input.x402PriceUsdc !== undefined) {
    if (input.x402PriceUsdc === null) {
      if (owned.x402_enabled) {
        throw new PublishError("disable x402 before clearing the price");
      }
      update["x402_price_usdc"] = null;
    } else {
      if (!validPrice(input.x402PriceUsdc)) {
        throw new PublishError("invalid x402 price");
      }
      update["x402_price_usdc"] = input.x402PriceUsdc;
    }
  }

  if (input.password !== undefined) {
    if (input.password === null || input.password === "") {
      update["password_hash"] = null;
    } else {
      if (input.password.length > 200) {
        throw new PublishError("password too long");
      }
      update["password_hash"] = hashPassword(
        input.password,
        randomBytes(16).toString("hex")
      );
    }
  }

  if (input.pluginSigninEnabled !== undefined) {
    update["plugin_signin_enabled"] = input.pluginSigninEnabled;
  }

  if (Object.keys(update).length === 0) {
    throw new PublishError("nothing to update");
  }
  update["updated_at"] = new Date().toISOString();

  const { error } = await supabase
    .from("mini_apps")
    .update(update)
    .eq("id", owned.id)
    .eq("owner_user_id", userId);
  if (error) throw new Error(`gate settings update failed: ${error.message}`);
  console.log(
    JSON.stringify({
      msg: "miniapp gate settings updated",
      user_id: userId,
      slug,
      fields: Object.keys(update).filter((key) => key !== "updated_at"),
    })
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
