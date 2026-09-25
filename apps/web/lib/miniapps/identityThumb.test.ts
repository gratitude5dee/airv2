/**
 * Same-origin identity thumbnails: only the authenticated session's own
 * ready image assets resolve, everything else 404s the same as an unknown
 * URL, and the response is a small resized JPEG rather than the original.
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "./apps/types";
import { serveIdentityThumb, thumbHref } from "./identityThumb";
import { FakeSupabase } from "../testing/fakeSupabase";
import { ASSETS_BUCKET } from "../assets/keys";

interface Row {
  asset_id: string;
  role: string;
  status: string;
  storage_key: string;
}

/** Seeds the two tables listIdentityAssets reads — identity_assets then
 * creative_assets — for `ownerId`, so the session's user_id scoping is
 * exercised for real. Storage bytes go in db.storageObjects. */
function fakeSupabase(ownerId: string, rows: Row[]): {
  supabase: SupabaseClient;
  db: FakeSupabase;
} {
  const db = new FakeSupabase();
  db.tables["identity_assets"] = rows.map((r) => ({
    id: `row-${r.asset_id}`,
    user_id: ownerId,
    asset_id: r.asset_id,
    role: r.role,
    position: 0,
    source: "upload",
    status: r.status,
    consent_id: null,
    label: null,
    provider_ref: null,
    created_at: "2026-09-01T00:00:00Z",
  }));
  db.tables["creative_assets"] = rows.map((r) => ({
    id: r.asset_id,
    user_id: ownerId,
    storage_key: r.storage_key,
  }));
  return { supabase: db.client(), db };
}

const png = async (rgb: { r: number; g: number; b: number }): Promise<Buffer> =>
  sharp({ create: { width: 800, height: 600, channels: 3, background: rgb } })
    .png()
    .toBuffer();

function ctxFor(userId: string, supabase: SupabaseClient, qs: string): MiniAppContext {
  return {
    request: new NextRequest(`https://mini.example/mini/onboarding${qs}`),
    supabase,
    app: {} as MiniAppContext["app"],
    session: { userId, resourceId: "default", role: "owner" },
    basePath: "/mini/onboarding",
  };
}

describe("thumbHref", () => {
  it("addresses the current page, not a separate signed URL", () => {
    expect(thumbHref("asset-1", 64)).toBe("?thumb=asset-1&w=64");
  });
});

describe("serveIdentityThumb", () => {
  it("returns null when the request names no thumbnail — the caller renders its page", async () => {
    const { supabase } = fakeSupabase("user-1", []);
    const result = await serveIdentityThumb(
      ctxFor("user-1", supabase, "?step=selfies")
    );
    expect(result).toBeNull();
  });

  it("resizes a ready image the session owns down to the requested width", async () => {
    const { supabase, db } = fakeSupabase("user-1", [
      { asset_id: "asset-1", role: "selfie", status: "ready", storage_key: "u1/a1.png" },
    ]);
    db.storageObjects[`${ASSETS_BUCKET}/u1/a1.png`] = new Uint8Array(await png({ r: 200, g: 40, b: 40 }));

    const response = await serveIdentityThumb(
      ctxFor("user-1", supabase, "?thumb=asset-1&w=64")
    );
    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);
    expect(response!.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response!.headers.get("Cache-Control")).toContain("private");
    const body = Buffer.from(await response!.arrayBuffer());
    // Nowhere near the 800x600 PNG original — this is the whole point.
    expect(body.byteLength).toBeLessThan(20_000);
    const meta = await sharp(body).metadata();
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(64);
    expect(meta.format).toBe("jpeg");
  });

  it("falls back to a sane default width for an unlisted size", async () => {
    const { supabase, db } = fakeSupabase("user-1", [
      { asset_id: "asset-1", role: "selfie", status: "ready", storage_key: "u1/a1.png" },
    ]);
    db.storageObjects[`${ASSETS_BUCKET}/u1/a1.png`] = new Uint8Array(await png({ r: 10, g: 10, b: 200 }));

    const response = await serveIdentityThumb(
      ctxFor("user-1", supabase, "?thumb=asset-1&w=99999")
    );
    const meta = await sharp(Buffer.from(await response!.arrayBuffer())).metadata();
    expect(meta.width).toBe(180);
  });

  it("404s an asset id that does not belong to this session — no cross-user access", async () => {
    // The row exists, but for a different owner: listIdentityAssets is
    // called with THIS session's userId, so the real query never returns
    // someone else's row.
    const { supabase } = fakeSupabase("user-2", [
      {
        asset_id: "someone-elses-asset",
        role: "selfie",
        status: "ready",
        storage_key: "u2/a1.png",
      },
    ]);
    const response = await serveIdentityThumb(
      ctxFor("user-1", supabase, "?thumb=someone-elses-asset&w=64")
    );
    expect(response!.status).toBe(404);
  });

  it("404s a video or audio asset id instead of trying to decode it as an image", async () => {
    const { supabase } = fakeSupabase("user-1", [
      {
        asset_id: "asset-video",
        role: "reference_video",
        status: "ready",
        storage_key: "u1/v1.mp4",
      },
    ]);
    const response = await serveIdentityThumb(
      ctxFor("user-1", supabase, "?thumb=asset-video&w=64")
    );
    expect(response!.status).toBe(404);
  });

  it("404s an asset that is not ready yet", async () => {
    const { supabase } = fakeSupabase("user-1", [
      { asset_id: "asset-1", role: "selfie", status: "processing", storage_key: "u1/a1.png" },
    ]);
    const response = await serveIdentityThumb(
      ctxFor("user-1", supabase, "?thumb=asset-1&w=64")
    );
    expect(response!.status).toBe(404);
  });

  it("404s when the storage object cannot be downloaded", async () => {
    const { supabase } = fakeSupabase("user-1", [
      { asset_id: "asset-1", role: "selfie", status: "ready", storage_key: "u1/missing.png" },
    ]);
    const response = await serveIdentityThumb(
      ctxFor("user-1", supabase, "?thumb=asset-1&w=64")
    );
    expect(response!.status).toBe(404);
  });
});
