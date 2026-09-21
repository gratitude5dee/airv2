/**
 * Same-origin identity photo thumbnails (Stage 3, docs/plans/
 * onboarding-miniapp-upgrade.md). `signedIdentityUrl` hands every preview —
 * a 64px row, a 96px avatar pick, a 240px reference grid cell — the same
 * full-resolution signed URL, which is the largest remaining variable cost
 * on the onboarding deck: a dozen selfies plus a generated character sheet
 * can be several megabytes of JPEG behind thumbnails a few hundred pixels
 * wide.
 *
 * This reuses the mini-app's own request-scoped session instead of minting
 * a new signed ticket: `thumbHref` builds a same-page URL
 * (`?thumb=<assetId>&w=<width>`), and `serveIdentityThumb` — called first
 * thing inside the module's `render()` — resolves it against
 * `listIdentityAssets(supabase, userId)`, which is already scoped to the
 * authenticated owner (`.eq("user_id", userId)`). An asset id that does not
 * belong to this session's user, or that names a non-image role, 404s the
 * same as an unknown one — no new authorization surface, no path or storage
 * key ever reaches the client.
 */
import sharp from "sharp";
import { NextResponse } from "next/server";
import {
  downloadIdentityAsset,
  listIdentityAssets,
  mediaKindForRole,
} from "@/lib/identity/assets";
import { notFound } from "./html";
import type { MiniAppContext } from "./apps/types";

/** A small allowlist, not an arbitrary client-chosen size — keeps a request
 * from forcing an oversized resize (and keeps the handful of shapes the
 * deck actually uses easy to reason about). */
const THUMB_WIDTHS = [64, 96, 180, 240] as const;
type ThumbWidth = (typeof THUMB_WIDTHS)[number];

function isThumbWidth(value: number): value is ThumbWidth {
  return (THUMB_WIDTHS as readonly number[]).includes(value);
}

/** The `<img src>` for a same-origin thumbnail. Resolves against the
 * current page path — a plain GET through the same gate chain and module
 * that rendered the page asking for it. */
export function thumbHref(assetId: string, width: ThumbWidth): string {
  return `?thumb=${encodeURIComponent(assetId)}&w=${width}`;
}

/**
 * Serves a resized JPEG when the request names one (`?thumb=`), else
 * returns null so the caller falls through to its normal HTML render.
 * Must run after the gate chain (it trusts `ctx.session.userId`) and before
 * any snapshot work — there is nothing else for a thumbnail request to do.
 */
export async function serveIdentityThumb(
  ctx: MiniAppContext
): Promise<NextResponse | null> {
  const assetId = ctx.request.nextUrl.searchParams.get("thumb");
  if (!assetId) return null;
  const requestedWidth = Number(ctx.request.nextUrl.searchParams.get("w"));
  const width = isThumbWidth(requestedWidth) ? requestedWidth : 180;

  const entries = await listIdentityAssets(ctx.supabase, ctx.session.userId);
  const entry = entries.find(
    (row) =>
      row.asset_id === assetId &&
      row.status === "ready" &&
      mediaKindForRole(row.role) === "image"
  );
  if (!entry) return notFound();

  const bytes = await downloadIdentityAsset(ctx.supabase, entry.asset);
  if (!bytes) return notFound();

  let resized: Buffer;
  try {
    resized = await sharp(bytes)
      .rotate()
      .resize(width, width, { fit: "cover" })
      .jpeg({ quality: 78 })
      .toBuffer();
  } catch {
    // A corrupt or unreadable source is the same as "no thumbnail" — never
    // fall back to serving the original at this URL shape.
    return notFound();
  }

  return new NextResponse(new Uint8Array(resized), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      // Private: this is one user's own photo. A short TTL matches the
      // signed-URL delivery window elsewhere in the identity pipeline
      // closely enough without re-fetching on every scroll.
      "Cache-Control": "private, max-age=300",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
