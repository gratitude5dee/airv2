/**
 * @entity refs: mention grammar, ownership-scoped resolution, prompt
 * rewriting that never leaks a URL, and the upsert/delete registration
 * contract behind the brand-guide panel and the admin route.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const assets = vi.hoisted(() => ({
  signedIdentityUrl: vi.fn(
    async (...args: unknown[]) =>
      `https://signed.example/${(args[1] as { id: string }).id}.png`
  ),
}));
vi.mock("./assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assets")>()),
  signedIdentityUrl: (...args: unknown[]) => assets.signedIdentityUrl(...(args as [])),
}));

import {
  attachEntityReferences,
  deleteEntityRef,
  listEntityRefs,
  parseEntityRefs,
  registerEntityRef,
  resolveEntityRef,
} from "./entityRefs";

const db = new FakeSupabase();
const supabase = db.client();

const asset = (id: string, owner: string) => ({
  id,
  user_id: owner,
  kind: "image",
  storage_key: `${owner}/${id}.png`,
  ext: "png",
  bytes: 100,
  sha256: id,
  box_asset_id: null,
  created_at: "2026-09-01T00:00:00Z",
});

beforeEach(() => {
  db.reset();
  assets.signedIdentityUrl.mockClear();
  db.tables["entity_refs"] = [
    {
      user_id: "u-1",
      kind: "logo",
      name: "acme-logo",
      asset_id: "a-logo",
      label: "Acme",
      position: 0,
      created_at: "2026-09-01T00:00:00Z",
    },
  ];
  db.tables["creative_assets"] = [asset("a-logo", "u-1"), asset("a-foreign", "u-2")];
});

describe("parseEntityRefs", () => {
  it("finds bare @names, ignores emails, paths and plain words", () => {
    expect(
      parseEntityRefs(
        "make @Acme-Logo pop, mail me@example.com, read docs/@readme, a fox"
      )
    ).toEqual(["acme-logo"]);
    expect(parseEntityRefs("@acme-logo @acme-logo")).toEqual(["acme-logo"]);
    expect(parseEntityRefs("nothing here")).toEqual([]);
  });
});

describe("resolveEntityRef", () => {
  it("resolves a registered name to its owned asset", async () => {
    const ref = await resolveEntityRef(supabase, "u-1", "acme-logo");
    expect(ref).not.toBeNull();
    expect(ref?.asset.id).toBe("a-logo");
    expect(ref?.label).toBe("Acme");
  });

  it("never sees another user's refs", async () => {
    expect(await resolveEntityRef(supabase, "u-2", "acme-logo")).toBeNull();
    expect(await resolveEntityRef(supabase, "u-1", "other")).toBeNull();
  });
});

describe("attachEntityReferences", () => {
  it("injects the logo as a flagged image input and rewrites the mention", async () => {
    const attached = await attachEntityReferences(supabase, "u-1", {
      mode: "zap",
      cleanedText: "neon intro for @acme-logo",
      text: "/zap neon intro for @acme-logo",
      mediaInputs: [{ kind: "image", url: "https://staged.example/first.jpg" }],
    });
    expect(attached.problem).toBeUndefined();
    expect(attached.turn.cleanedText).toBe(
      "neon intro for the acme-logo logo in Image 2"
    );
    expect(attached.turn.text).not.toMatch(/signed\.example|@acme-logo/);
    expect(attached.turn.mediaInputs).toEqual([
      { kind: "image", url: "https://staged.example/first.jpg" },
      { kind: "image", url: "https://signed.example/a-logo.png", entityRef: true },
    ]);
    expect(attached.uses).toEqual([
      {
        ownerUserId: "u-1",
        assetId: "a-logo",
        role: "logo",
        purpose: "video",
      },
    ]);
    expect(attached.resolved).toEqual(["acme-logo"]);
  });

  it("leaves unregistered mentions literal so the twin layer still judges them", async () => {
    const attached = await attachEntityReferences(supabase, "u-1", {
      mode: "zap",
      cleanedText: "a poster with @acme and @acme-logo",
      text: "a poster with @acme and @acme-logo",
      mediaInputs: [],
    });
    expect(attached.turn.cleanedText).toBe(
      "a poster with @acme and the acme-logo logo in Image 1"
    );
    expect(attached.turn.mediaInputs).toHaveLength(1);
    expect(attached.resolved).toEqual(["acme-logo"]);
  });

  it("fails closed when the ref's image cannot be signed", async () => {
    assets.signedIdentityUrl.mockRejectedValueOnce(new Error("storage down"));
    const attached = await attachEntityReferences(supabase, "u-1", {
      mode: "imagine",
      cleanedText: "@acme-logo on a mug",
      text: "/imagine @acme-logo on a mug",
      mediaInputs: [],
    });
    expect(attached.problem).toContain("acme-logo");
    expect(attached.turn.mediaInputs).toEqual([]);
  });
});

describe("registerEntityRef", () => {
  it("upserts a name for the owner and rejects foreign or non-image assets", async () => {
    const first = await registerEntityRef(supabase, "u-2", {
      name: "grat-logo",
      assetId: "a-foreign",
    });
    expect(first).toEqual({ ok: true, name: "grat-logo" });

    const foreign = await registerEntityRef(supabase, "u-1", {
      name: "borrowed",
      assetId: "a-foreign",
    });
    expect(foreign).toMatchObject({ ok: false });

    const bad = await registerEntityRef(supabase, "u-1", {
      name: "Not_A-Ref!",
      assetId: "a-logo",
    });
    expect(bad).toMatchObject({ ok: false });
  });
});

describe("listEntityRefs / deleteEntityRef", () => {
  it("lists only the caller's refs and deletes by name", async () => {
    const refs = await listEntityRefs(supabase, "u-1");
    expect(refs.map((r) => r.name)).toEqual(["acme-logo"]);
    expect(await listEntityRefs(supabase, "u-2")).toEqual([]);
    expect(await deleteEntityRef(supabase, "u-1", "logo", "acme-logo")).toBe(true);
    expect(await listEntityRefs(supabase, "u-1")).toEqual([]);
  });
});
