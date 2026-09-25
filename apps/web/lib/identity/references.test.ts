import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import {
  composeReferenceSheet,
  listIdentityReferenceAssetIds,
  replaceIdentityReferences,
} from "./references";

const image = async (rgb: { r: number; g: number; b: number }): Promise<Buffer> =>
  sharp({
    create: { width: 24, height: 32, channels: 3, background: rgb },
  })
    .jpeg()
    .toBuffer();

describe("identity photo references", () => {
  it("returns persisted asset ids in their saved reference order", async () => {
    const db = new FakeSupabase();
    // Seeded out of position order on purpose: the query's ORDER BY, not
    // insertion order, decides the returned selection order.
    db.tables["identity_reference_assets"] = [
      { user_id: "owner-1", asset_id: "front", position: 1, created_at: "2026-09-02T00:00:00Z" },
      { user_id: "owner-1", asset_id: "side", position: 0, created_at: "2026-09-01T00:00:00Z" },
    ];
    const ids = await listIdentityReferenceAssetIds(db.client(), "owner-1");
    expect(ids).toEqual(["side", "front"]);
  });

  it("rejects an empty or oversized selection before it can be persisted", async () => {
    const supabase = new FakeSupabase().client();
    await expect(replaceIdentityReferences(supabase, "owner-1", [])).resolves.toEqual({
      ok: false,
      error: "Choose 1–6 photos.",
    });
    await expect(
      replaceIdentityReferences(
        supabase,
        "owner-1",
        ["1", "2", "3", "4", "5", "6", "7"]
      )
    ).resolves.toEqual({ ok: false, error: "Choose 1–6 photos." });
  });

  it("composes every selected photo into a bounded private contact sheet", async () => {
    const photos = await Promise.all(
      [
        { r: 214, g: 55, b: 55 },
        { r: 55, g: 214, b: 55 },
        { r: 55, g: 55, b: 214 },
        { r: 214, g: 180, b: 55 },
        { r: 180, g: 55, b: 214 },
        { r: 55, g: 180, b: 214 },
      ].map(image)
    );
    const sheet = await composeReferenceSheet(photos);
    const metadata = await sharp(sheet).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1536);
    expect(metadata.height).toBe(1024);
    await expect(composeReferenceSheet([])).rejects.toThrow("invalid reference count");
  });
});
