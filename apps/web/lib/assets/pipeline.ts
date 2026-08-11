/**
 * CM2 asset delivery: render → pull → (stripped in-box, CC4) → verify →
 * store → sign → revoke. The pull is server-to-server against the box's
 * creative plugin — no box origin or token ever reaches a client (C3, C16),
 * and delivery URLs are unguessable, short-TTL capabilities revoked on
 * confirmation (CC3). The bytes are served by object storage directly,
 * never proxied through a function.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserBox } from "@/lib/orchestrator/boxes";
import { dashboardRequestWithRetry } from "@/lib/box/dashboard";
import { openSecret } from "@/lib/crypto/secretbox";
import { env } from "@/lib/env";
import {
  ASSETS_BUCKET,
  DELIVERY_TTL_SECONDS,
  contentType,
  deliveryKey,
  masterKey,
  normalizeExt,
} from "./keys";

export interface CreativeAsset {
  id: string;
  user_id: string;
  box_asset_id: string;
  sha256: string;
  ext: string;
  kind: string;
  bytes: number;
  storage_key: string;
  created_at: string;
}

export interface Delivery {
  id: string;
  url: string;
  expires_at: string;
}

export class AssetPipelineError extends Error {}

/** Hard cap on a single ingested asset. The box is the untrusted side of the
 * C16 boundary — never buffer more than this regardless of what the plugin's
 * metadata claims. Generous for CM2 image/short-video outputs; ad asset
 * groups (CM5) will need a streaming path instead of a bigger cap. */
export const MAX_ASSET_BYTES = 100 * 1024 * 1024;

export async function pluginFetch(
  supabase: SupabaseClient,
  box: UserBox,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<Response> {
  const authKey = env.boxDashboardAuthKey();
  if (!box.dashboard || !box.dashboardAuthSealed || !authKey) {
    throw new AssetPipelineError("dashboard credential unavailable");
  }
  const password = openSecret(box.dashboardAuthSealed, authKey);
  const attempt = await dashboardRequestWithRetry(
    supabase,
    box.boxId,
    box.dashboard,
    password,
    (route, headers) =>
      fetch(`${route.url}/api/plugins/creative/${path}`, {
        method,
        headers:
          body === undefined
            ? headers
            : { ...headers, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
  );
  if (attempt.kind === "ok") return attempt.response;
  if (attempt.kind === "stale" && attempt.response) {
    await attempt.response.body?.cancel();
    throw new AssetPipelineError(
      `plugin refused request (${attempt.response.status})`
    );
  }
  throw new AssetPipelineError("dashboard login failed");
}

export interface CreativePackage {
  id: string;
  caption: string | null;
  hashtags: string[];
  media_asset_ids: string[];
  platform_settings: Record<string, unknown>;
}

/** Resolve a package_ref against the box's creative plugin (CC2 — the
 * control plane stores refs only; captions and media live box-side). */
export async function fetchPackage(
  supabase: SupabaseClient,
  box: UserBox,
  packageRef: string
): Promise<CreativePackage> {
  const response = await pluginFetch(
    supabase,
    box,
    "GET",
    `packages/${encodeURIComponent(packageRef)}`
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new AssetPipelineError(`package fetch failed (${response.status})`);
  }
  return (await response.json()) as CreativePackage;
}

/**
 * Pull one asset from the box into object storage: ask the plugin for a
 * metadata-stripped export, verify its sha256 end-to-end, store it
 * content-addressed under the user's prefix. Idempotent — a re-render
 * producing identical bytes lands on the existing row/object.
 */
export async function ingestAsset(
  supabase: SupabaseClient,
  userId: string,
  box: UserBox,
  boxAssetId: string
): Promise<CreativeAsset> {
  const exportRes = await pluginFetch(
    supabase,
    box,
    "POST",
    `assets/${boxAssetId}/export`
  );
  if (!exportRes.ok) {
    await exportRes.body?.cancel();
    throw new AssetPipelineError(`export failed (${exportRes.status})`);
  }
  const meta = (await exportRes.json()) as {
    sha256?: string;
    bytes?: number;
    ext?: string;
  };
  const ext = normalizeExt(meta.ext ?? "");
  if (!meta.sha256 || !meta.bytes || !ext) {
    throw new AssetPipelineError("export metadata invalid");
  }
  if (meta.bytes > MAX_ASSET_BYTES) {
    throw new AssetPipelineError("asset exceeds size limit");
  }

  const existing = await supabase
    .from("creative_assets")
    .select("*")
    .eq("user_id", userId)
    .eq("sha256", meta.sha256)
    .maybeSingle();
  if (existing.data) {
    return existing.data as CreativeAsset;
  }

  const bytesRes = await pluginFetch(
    supabase,
    box,
    "GET",
    `assets/${boxAssetId}/export/bytes`
  );
  if (!bytesRes.ok) {
    await bytesRes.body?.cancel();
    throw new AssetPipelineError(`export pull failed (${bytesRes.status})`);
  }
  const buffer = await readCapped(bytesRes, MAX_ASSET_BYTES);
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (digest !== meta.sha256 || buffer.byteLength !== meta.bytes) {
    throw new AssetPipelineError("export bytes failed sha256 verification");
  }

  const key = masterKey(userId, digest, ext);
  const upload = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(key, buffer, { contentType: contentType(ext), upsert: true });
  if (upload.error) {
    throw new AssetPipelineError(`storage upload failed: ${upload.error.message}`);
  }

  const inserted = await supabase
    .from("creative_assets")
    .insert({
      user_id: userId,
      box_asset_id: boxAssetId,
      sha256: digest,
      ext,
      kind: ext,
      bytes: buffer.byteLength,
      storage_key: key,
    })
    .select("*")
    .single();
  if (inserted.error) {
    throw new AssetPipelineError(inserted.error.message);
  }
  return inserted.data as CreativeAsset;
}

/**
 * Mint a delivery URL (CC3): copy the master to an unguessable path, sign it
 * for DELIVERY_TTL_SECONDS. Minted at publish time, not render time.
 */
export async function mintDelivery(
  supabase: SupabaseClient,
  asset: CreativeAsset,
  purpose: string | null
): Promise<Delivery> {
  const key = deliveryKey(asset.user_id, asset.ext);
  const copied = await supabase.storage
    .from(ASSETS_BUCKET)
    .copy(asset.storage_key, key);
  if (copied.error) {
    throw new AssetPipelineError(`delivery copy failed: ${copied.error.message}`);
  }
  // If signing or the tracking insert fails, delete the copy — an object
  // without an asset_deliveries row is invisible to revoke and the sweep.
  const rollback = async () => {
    await supabase.storage
      .from(ASSETS_BUCKET)
      .remove([key])
      .catch(() => undefined);
  };
  const signed = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(key, DELIVERY_TTL_SECONDS);
  if (signed.error || !signed.data) {
    await rollback();
    throw new AssetPipelineError("delivery signing failed");
  }
  const expiresAt = new Date(
    Date.now() + DELIVERY_TTL_SECONDS * 1000
  ).toISOString();
  const inserted = await supabase
    .from("asset_deliveries")
    .insert({
      asset_id: asset.id,
      user_id: asset.user_id,
      storage_key: key,
      purpose,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (inserted.error) {
    await rollback();
    throw new AssetPipelineError(inserted.error.message);
  }
  return {
    id: inserted.data.id as string,
    url: signed.data.signedUrl,
    expires_at: expiresAt,
  };
}

/** Read a response body with a hard byte cap — aborts as soon as the cap is
 * crossed instead of buffering whatever the box sends. */
async function readCapped(response: Response, cap: number): Promise<Buffer> {
  if (!response.body) {
    throw new AssetPipelineError("export body missing");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new AssetPipelineError("asset exceeds size limit");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Delete delivery objects and mark only the ones storage confirms removed
 * (remove() silently omits paths it couldn't delete), so failures are
 * retried by the next revoke/sweep instead of leaving a live URL marked
 * revoked. */
async function removeDeliveryRows(
  supabase: SupabaseClient,
  rows: Array<{ id: string; storage_key: string }>
): Promise<number> {
  if (rows.length === 0) return 0;
  const removal = await supabase.storage
    .from(ASSETS_BUCKET)
    .remove(rows.map((row) => row.storage_key));
  if (removal.error) {
    throw new AssetPipelineError(
      `delivery removal failed: ${removal.error.message}`
    );
  }
  const removedKeys = new Set(
    (removal.data ?? []).map((object) => object.name)
  );
  const confirmed = rows.filter((row) => removedKeys.has(row.storage_key));
  if (confirmed.length === 0) return 0;
  await supabase
    .from("asset_deliveries")
    .update({ revoked_at: new Date().toISOString() })
    .in(
      "id",
      confirmed.map((row) => row.id)
    );
  return confirmed.length;
}

/** Revoke on publish confirmation — the delivery object is deleted, so the
 * URL 404s even inside its signature window. */
export async function revokeDeliveries(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<number> {
  const { data } = await supabase
    .from("asset_deliveries")
    .select("id, storage_key")
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .is("revoked_at", null);
  return removeDeliveryRows(
    supabase,
    (data ?? []) as Array<{ id: string; storage_key: string }>
  );
}

/** TTL sweep: delete delivery objects past expiry (revoked-by-time). Run
 * opportunistically from the asset routes — signed URLs expire on their own;
 * this just removes the ephemeral derivative objects. */
export async function sweepExpiredDeliveries(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data } = await supabase
    .from("asset_deliveries")
    .select("id, storage_key")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .lt("expires_at", new Date().toISOString());
  await removeDeliveryRows(
    supabase,
    (data ?? []) as Array<{ id: string; storage_key: string }>
  );
}
