/**
 * @username resolution: mention grammar, owner vs public vs private access,
 * purpose filtering (voice is owner-only), and reference injection that
 * never leaks a URL into the prompt text.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const assets = vi.hoisted(() => ({
  listIdentityAssets: vi.fn(),
  signedIdentityUrl: vi.fn(
    async (...args: unknown[]) =>
      `https://signed.example/${(args[1] as { id: string }).id}.png`
  ),
}));
vi.mock("./assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assets")>()),
  listIdentityAssets: (...args: unknown[]) => assets.listIdentityAssets(...(args as [])),
  signedIdentityUrl: (...args: unknown[]) => assets.signedIdentityUrl(...(args as [])),
}));

const twinRow = vi.hoisted(() => ({ getDigitalTwin: vi.fn() }));
vi.mock("./twinRow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./twinRow")>()),
  getDigitalTwin: (...args: unknown[]) => twinRow.getDigitalTwin(...(args as [])),
}));

import {
  attachIdentityReferences,
  parseIdentityMentions,
  referenceImagesOf,
  resolveIdentityReference,
  unknownTwinLine,
} from "./resolve";

const db = new FakeSupabase();

const users = [
  { id: "u-grat", username: "grat", status: "active" },
  { id: "u-bob", username: "bob", status: "active" },
  { id: "u-gone", username: "gone", status: "deleted" },
];

const entry = (owner: string, id: string, role: string) => ({
  id: `row-${id}`,
  asset_id: id,
  role,
  position: 0,
  source: "generated",
  status: "ready",
  consent_id: null,
  label: null,
  provider_ref: null,
  created_at: "2026-09-01T00:00:00Z",
  asset: { id, user_id: owner, storage_key: `${owner}/masters/${id}.png`, ext: "png" },
});

beforeEach(() => {
  db.reset();
  db.tables["users"] = users.map((row) => ({ ...row }));
  assets.listIdentityAssets.mockReset();
  twinRow.getDigitalTwin.mockReset();
  assets.listIdentityAssets.mockImplementation(async (_s: unknown, owner: string) =>
    owner === "u-grat"
      ? [entry(owner, "p1", "profile_image"), entry(owner, "cs1", "character_sheet"), entry(owner, "s1", "selfie")]
      : owner === "u-bob"
        ? [
            entry(owner, "brs", "reference_sheet"),
            entry(owner, "bp", "profile_image"),
            entry(owner, "bs", "selfie"),
          ]
        : []
  );
  twinRow.getDigitalTwin.mockImplementation(async (_s: unknown, owner: string) =>
    owner === "u-grat"
      ? { user_id: owner, sharing: "private", voice_status: "ready", voice_id: "v1" }
      : owner === "u-bob"
        ? { user_id: owner, sharing: "public", voice_status: "ready", voice_id: "v2" }
        : null
  );
});

describe("parseIdentityMentions", () => {
  it("finds standalone handles, ignores emails, paths and bot-style names", () => {
    expect(
      parseIdentityMentions("portrait of @Grat and @bob, mail me@example.com, see docs/@readme, ping @my-bot")
    ).toEqual(["grat", "bob"]);
    expect(parseIdentityMentions("@grat @grat again")).toEqual(["grat"]);
    expect(parseIdentityMentions("nothing here")).toEqual([]);
  });
});

describe("resolveIdentityReference", () => {
  const supabase = db.client();

  it("gives the owner everything, including voice readiness", async () => {
    const result = await resolveIdentityReference(supabase, "u-grat", "@grat", "speech");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.twin.isOwner).toBe(true);
    expect(result.twin.profileImage?.asset_id).toBe("p1");
    expect(result.twin.selfies.map((e) => e.asset_id)).toEqual(["s1"]);
    expect(result.twin.voiceReady).toBe(true);
  });

  it("hides a private twin from everyone else exactly like an unknown name", async () => {
    const other = await resolveIdentityReference(supabase, "u-bob", "grat", "image");
    const unknown = await resolveIdentityReference(supabase, "u-bob", "nobody", "image");
    expect(other).toEqual({ ok: false, reason: "not_found", line: unknownTwinLine("grat") });
    expect(unknown).toEqual({ ok: false, reason: "not_found", line: unknownTwinLine("nobody") });
  });

  it("shares only the profile image and sheet of a public twin, never voice", async () => {
    const image = await resolveIdentityReference(supabase, "u-grat", "bob", "video");
    expect(image.ok).toBe(true);
    if (image.ok) {
      expect(image.twin.isOwner).toBe(false);
      expect(image.twin.referenceSheet).toBeNull();
      expect(image.twin.selfies).toEqual([]);
      expect(image.twin.voiceReady).toBe(false);
    }
    const speech = await resolveIdentityReference(supabase, "u-grat", "bob", "speech");
    expect(speech).toMatchObject({ ok: false, reason: "forbidden" });
  });

  it("reports an incomplete twin to its owner and ignores deleted users", async () => {
    assets.listIdentityAssets.mockResolvedValueOnce([]);
    const empty = await resolveIdentityReference(supabase, "u-grat", "grat", "image");
    expect(empty).toMatchObject({ ok: false, reason: "incomplete" });
    const gone = await resolveIdentityReference(supabase, "u-grat", "gone", "image");
    expect(gone).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("uses an owner's selected private contact sheet first, without exposing it to others", async () => {
    assets.listIdentityAssets.mockResolvedValueOnce([
      entry("u-grat", "rs1", "reference_sheet"),
      entry("u-grat", "p1", "profile_image"),
      entry("u-grat", "s1", "selfie"),
    ]);
    const owner = await resolveIdentityReference(supabase, "u-grat", "grat", "image");
    expect(owner.ok).toBe(true);
    if (!owner.ok) return;
    expect(owner.twin.referenceSheet?.asset_id).toBe("rs1");
    expect(referenceImagesOf(owner.twin).map((image) => image.asset_id)).toEqual([
      "rs1",
      "p1",
    ]);
  });
});

describe("attachIdentityReferences", () => {
  const supabase = db.client();

  it("injects reference images and rewrites the mention without any URL", async () => {
    const attached = await attachIdentityReferences(supabase, "u-grat", {
      mode: "zap",
      cleanedText: "a cinematic portrait of @grat at dusk",
      text: "/zap a cinematic portrait of @grat at dusk",
      mediaInputs: [{ kind: "image", url: "https://staged.example/first.jpg" }],
    });
    expect(attached.problem).toBeUndefined();
    expect(attached.turn.cleanedText).toBe(
      "a cinematic portrait of the person in Image 2 at dusk"
    );
    expect(attached.turn.text).not.toMatch(/signed\.example|@grat/);
    expect(attached.turn.mediaInputs.map((m) => m.url)).toEqual([
      "https://staged.example/first.jpg",
      "https://signed.example/p1.png",
      "https://signed.example/cs1.png",
    ]);
    expect(attached.uses).toEqual([
      { ownerUserId: "u-grat", assetId: "p1", role: "profile_image", purpose: "video" },
      { ownerUserId: "u-grat", assetId: "cs1", role: "character_sheet", purpose: "video" },
    ]);
    expect(attached.resolved).toEqual(["grat"]);
  });

  it("stops the turn with a written line when a handle cannot be used", async () => {
    const attached = await attachIdentityReferences(supabase, "u-bob", {
      mode: "imagine",
      cleanedText: "@grat as an astronaut",
      text: "/imagine @grat as an astronaut",
      mediaInputs: [],
    });
    expect(attached.problem).toBe(unknownTwinLine("grat"));
    expect(attached.turn.mediaInputs).toEqual([]);
    expect(attached.uses).toEqual([]);
  });

  it("leaves turns without mentions untouched", async () => {
    const turn = { mode: "zap" as const, cleanedText: "a fox", text: "/zap a fox", mediaInputs: [] };
    expect(await attachIdentityReferences(supabase, "u-grat", turn)).toEqual({
      turn,
      uses: [],
      resolved: [],
    });
  });
});
