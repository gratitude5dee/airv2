/**
 * V11 §7 (4): publishing is a pointer move. The control plane writes a tiny
 * signed manifest to KV (`app:<slug>`) on every publish, rollback, draft
 * change, or suspension; the Dispatcher reads it per request, so suspension
 * propagates in one write and a suspended app 404s on the app origin even
 * while its Worker still exists (CR16).
 *
 * The manifest is signed under APP_ORIGIN_SIGNING_KEY: a KV write by anything
 * other than the control plane is ignored by the Dispatcher.
 */
import { createHmac } from "node:crypto";
import { env } from "../env";
import { deleteKvValue, putKvValue } from "./cloudflare";

export type ManifestStatus = "draft" | "published" | "suspended";

export interface AppManifest {
  slug: string;
  status: ManifestStatus;
  /** Live version (`v<epoch>`) or null before the first publish. */
  live: string | null;
  /** Draft version the owner is previewing, or null. */
  draft: string | null;
  /** Owner pseudonym for `outbound.params` — never the user id (CR9). */
  owner_ref: string;
  functions: boolean;
  updated_at: string;
}

export interface SignedManifest {
  payload: string;
  sig: string;
}

export function manifestKey(slug: string): string {
  return `app:${slug}`;
}

export function signManifest(manifest: AppManifest): SignedManifest {
  const key = env.appOriginSigningKey();
  if (!key) throw new Error("APP_ORIGIN_SIGNING_KEY is not configured");
  const payload = Buffer.from(JSON.stringify(manifest)).toString("base64url");
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  return { payload, sig };
}

export async function writeManifest(manifest: AppManifest): Promise<void> {
  await putKvValue(
    manifestKey(manifest.slug),
    JSON.stringify(signManifest(manifest))
  );
  console.log(
    JSON.stringify({
      msg: "app manifest written",
      app: manifest.slug,
      status: manifest.status,
      live: manifest.live,
      draft: manifest.draft,
    })
  );
}

export async function deleteManifest(slug: string): Promise<void> {
  await deleteKvValue(manifestKey(slug));
}
