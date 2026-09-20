import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
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

function selectionSupabase(rows: Array<{ asset_id: string; position: number }>): SupabaseClient {
  const query: Record<string, unknown> = {};
  const chain = (): typeof query => query;
  query["select"] = chain;
  query["eq"] = chain;
  query["order"] = chain;
  query["then"] = (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return {
    from: () => query,
  } as unknown as SupabaseClient;
}

describe("identity photo references", () => {
  it("returns persisted asset ids in their saved reference order", async () => {
    const ids = await listIdentityReferenceAssetIds(
      selectionSupabase([
        { asset_id: "side", position: 1 },
        { asset_id: "front", position: 0 },
      ]),
      "owner-1"
    );
    expect(ids).toEqual(["side", "front"]);
  });

  it("rejects an empty or oversized selection before it can be persisted", async () => {
    const supabase = selectionSupabase([]);
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
