/**
 * V11 §11.1 per-app resources: at most one D1 database and one KV namespace
 * per app, created on the first build that declares them, never twice.
 *
 * Claim-before-vendor-call (the deploy.ts protocol applied to a column):
 *   1. claim   — set the id column to `pending:<nonce>:<ms>` where it is
 *                null (or a stale pending marker from a writer that died);
 *                zero rows updated means someone else owns the create.
 *   2. vendor  — create the resource under a name derived from the marker's
 *                nonce, so a writer that dies between create and confirm
 *                leaves something the next claimant can find by name and
 *                delete before it reclaims the stale marker.
 *   3. confirm — write the real id where the column still holds *our*
 *                marker; zero rows means we were taken over, so delete what
 *                we just made (no orphaned vendor resources — CR16).
 * The app-origin claim RPC fences all of it against deletion.
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BackendError, loadFunctions, type FunctionsRow } from "./backend";
import {
  cloudflareConfigured,
  createD1Database,
  createKvNamespace,
  deleteD1Database,
  deleteKvNamespace,
  findD1Database,
  findKvNamespace,
} from "./cloudflare";
import { AppOriginRefusedError } from "./deploy";

export const PENDING_PREFIX = "pending:";
/** A pending marker older than this belongs to a writer that died mid-create. */
export const PENDING_STALE_MS = 10 * 60_000;

type Resource = "db" | "kv";

const COLUMN: Record<Resource, "d1_database_id" | "kv_namespace_id"> = {
  db: "d1_database_id",
  kv: "kv_namespace_id",
};

export function isPendingMarker(value: string | null): boolean {
  return value !== null && value.startsWith(PENDING_PREFIX);
}

/** The vendor id when provisioned; null while absent or still pending. */
export function resourceId(row: FunctionsRow, resource: Resource): string | null {
  const value = row[COLUMN[resource]];
  return value && !isPendingMarker(value) ? value : null;
}

function markerAge(marker: string, now: number): number {
  const ms = Number(marker.split(":")[2]);
  return Number.isFinite(ms) ? now - ms : Number.POSITIVE_INFINITY;
}

function markerNonce(marker: string): string | null {
  return marker.split(":")[1] ?? null;
}

/** Vendor name for the resource a given claim creates: unique per claim, findable later. */
export function vendorName(resource: Resource, slug: string, nonce: string): string {
  return `air-${slug}-${resource}-${nonce}`;
}

async function fenced(supabase: SupabaseClient, appId: string, slug: string): Promise<void> {
  const { data, error } = await supabase.rpc("miniapp_claim_app_origin", {
    p_app_id: appId,
  });
  if (error) throw new BackendError(502, `app origin claim failed: ${error.message}`);
  if (data !== true) throw new AppOriginRefusedError(slug);
}

async function claim(
  supabase: SupabaseClient,
  appId: string,
  resource: Resource,
  current: string | null,
  marker: string
): Promise<boolean> {
  let query = supabase
    .from("miniapp_functions")
    .update({ [COLUMN[resource]]: marker })
    .eq("app_id", appId);
  query = current === null ? query.is(COLUMN[resource], null) : query.eq(COLUMN[resource], current);
  const { data, error } = await query.select("app_id");
  if (error) throw new BackendError(502, "resource claim failed");
  return (data ?? []).length > 0;
}

async function confirm(
  supabase: SupabaseClient,
  appId: string,
  resource: Resource,
  marker: string,
  id: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("miniapp_functions")
    .update({ [COLUMN[resource]]: id, updated_at: new Date().toISOString() })
    .eq("app_id", appId)
    .eq(COLUMN[resource], marker)
    .select("app_id");
  if (error) throw new BackendError(502, "resource confirm failed");
  return (data ?? []).length > 0;
}

async function vendorCreate(resource: Resource, name: string): Promise<string> {
  if (resource === "db") return (await createD1Database(name)).uuid;
  return (await createKvNamespace(name)).id;
}

async function vendorDelete(resource: Resource, id: string): Promise<void> {
  if (resource === "db") await deleteD1Database(id);
  else await deleteKvNamespace(id);
}

/** Delete whatever a dead writer's claim created but never confirmed. */
async function reapStale(resource: Resource, slug: string, marker: string): Promise<void> {
  const nonce = markerNonce(marker);
  if (!nonce) return;
  const name = vendorName(resource, slug, nonce);
  const id = resource === "db" ? await findD1Database(name) : await findKvNamespace(name);
  if (id) await vendorDelete(resource, id);
}

/**
 * Ensure the resources `need` names exist for the app. Returns the row with
 * real ids, or throws when a create is in flight elsewhere (the caller's
 * build retries — the next attempt finds the id or a stale marker).
 */
export async function ensureResources(
  supabase: SupabaseClient,
  row: FunctionsRow,
  slug: string,
  need: { db: boolean; kv: boolean },
  now = Date.now()
): Promise<FunctionsRow> {
  let current = row;
  for (const resource of ["db", "kv"] as const) {
    if (!need[resource] || resourceId(current, resource)) continue;
    if (!cloudflareConfigured()) {
      throw new BackendError(503, "the app origin is not configured");
    }
    const existing = current[COLUMN[resource]];
    if (isPendingMarker(existing) && markerAge(existing as string, now) < PENDING_STALE_MS) {
      throw new BackendError(409, `${resource} is being provisioned; retry the build`);
    }
    await fenced(supabase, current.app_id, slug);
    if (isPendingMarker(existing)) await reapStale(resource, slug, existing as string);
    const nonce = randomBytes(6).toString("hex");
    const marker = `${PENDING_PREFIX}${nonce}:${now}`;
    if (!(await claim(supabase, current.app_id, resource, existing, marker))) {
      throw new BackendError(409, `${resource} is being provisioned; retry the build`);
    }
    const id = await vendorCreate(resource, vendorName(resource, slug, nonce));
    await fenced(supabase, current.app_id, slug).catch(async (error) => {
      await vendorDelete(resource, id).catch(() => undefined);
      throw error;
    });
    if (!(await confirm(supabase, current.app_id, resource, marker, id))) {
      await vendorDelete(resource, id).catch(() => undefined);
      throw new BackendError(409, `${resource} was provisioned by another build; retry`);
    }
    console.log(
      JSON.stringify({ msg: "app resource provisioned", app: slug, resource })
    );
    const fresh = await loadFunctions(supabase, current.app_id);
    if (!fresh) throw new BackendError(502, "backend row vanished");
    current = fresh;
  }
  return current;
}

/** Teardown: delete whatever vendor resources the row names (CR16). */
export async function deleteResources(row: FunctionsRow): Promise<void> {
  if (!cloudflareConfigured()) return;
  const db = resourceId(row, "db");
  const kv = resourceId(row, "kv");
  if (db) await deleteD1Database(db);
  if (kv) await deleteKvNamespace(kv);
}
