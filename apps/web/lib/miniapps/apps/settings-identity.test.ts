/**
 * Settings IDENTITY VAULT: the section mounts, every identity mutation
 * (upload, avatar select, delete, character sheet, HeyGen avatar) goes
 * through the shared lib/identity helpers, and non-owners plus unknown
 * actions stay rejected.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";

const boxFiles = new Map<string, string>();

vi.mock("@/lib/box/client", () => ({
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) throw new Error("not found");
    return value;
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    boxFiles.set(path, content);
  }),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: "target-1" })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));

const uploadIdentityImage = vi.fn(async () => ({
  ok: true as const,
  asset: { id: "asset-1" },
}));
const setAvatarAssetId = vi.fn(async () => true);
const removeIdentityAsset = vi.fn(async () => true);
vi.mock("@/lib/identity/assets", () => ({
  listIdentityAssets: vi.fn(async () => []),
  listIdentityMediaViews: vi.fn(async () => [
    { assetId: "asset-1", role: "selfie", url: "https://signed.example/a.png" },
  ]),
  getAvatarAssetId: vi.fn(async () => null),
  setAvatarAssetId: (...args: unknown[]) => setAvatarAssetId(...(args as [])),
  removeIdentityAsset: (...args: unknown[]) =>
    removeIdentityAsset(...(args as [])),
  signedIdentityUrl: vi.fn(async () => "https://signed.example/a.png"),
  uploadIdentityImage: (...args: unknown[]) =>
    uploadIdentityImage(...(args as [])),
}));
const generateCharacterSheet = vi.fn(async () => ({
  ok: true as const,
  notice: "Character sheet ready.",
  deliveryUrl: "https://signed.example/sheet.png",
}));
vi.mock("@/lib/identity/generate", () => ({
  generateCharacterSheet: (...args: unknown[]) =>
    generateCharacterSheet(...(args as [])),
}));
const createTwinVideo = vi.fn(async () => ({
  ok: true,
  notice: "Twin video ready.",
}));
const createUserHeygenAvatar = vi.fn(async () => ({
  ok: true as const,
  avatarId: "look_abc123",
}));
vi.mock("@/lib/identity/twin", () => ({
  getDigitalTwin: vi.fn(async () => null),
  createTwinVideo: (...args: unknown[]) => createTwinVideo(...(args as [])),
  createUserHeygenAvatar: (...args: unknown[]) =>
    createUserHeygenAvatar(...(args as [])),
}));
const heygenAvailable = vi.fn(() => false);
vi.mock("@/lib/identity/heygen", () => ({
  heygenAvailable: () => heygenAvailable(),
}));

import { settings } from "@/lib/miniapps/apps/settings";

function thenable(rows: unknown, single: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of [
    "select",
    "eq",
    "is",
    "order",
    "limit",
    "range",
    "gte",
    "lt",
  ]) {
    builder[method] = vi.fn(chain);
  }
  builder.maybeSingle = async () => ({ data: single, error: null });
  builder.then = (resolve: (value: { data: unknown }) => unknown) =>
    Promise.resolve({ data: rows }).then(resolve);
  return builder;
}

function makeCtx(options: { role?: string } = {}): MiniAppContext {
  const tables: Record<string, ReturnType<typeof thenable>> = {
    users: thenable([], { username: "grat" }),
    entitlements: thenable([], { plan: "beta", speed_tier: "balanced" }),
    agent_addresses: thenable([], { address: "grat@wzrd.tech" }),
    plugin_tokens: thenable([]),
    user_buckets: thenable([], null),
  };
  return {
    request: new NextRequest("https://mini.example/mini/settings"),
    supabase: {
      from: (table: string) => tables[table] ?? thenable([]),
    } as unknown as SupabaseClient,
    app: makeApp({ slug: "settings", kind: "input" }),
    session: {
      userId: "user-1",
      resourceId: "default",
      role: options.role ?? "owner",
    },
    basePath: "/mini/settings",
  } as MiniAppContext;
}

afterEach(() => {
  heygenAvailable.mockReturnValue(false);
  uploadIdentityImage.mockClear();
  setAvatarAssetId.mockClear();
  removeIdentityAsset.mockClear();
  generateCharacterSheet.mockClear();
  createTwinVideo.mockClear();
  createUserHeygenAvatar.mockClear();
  boxFiles.clear();
});

describe("settings identity vault", () => {
  it("mounts the IDENTITY VAULT section with upload and per-asset controls", async () => {
    const body = await (await settings.render(makeCtx())).text();
    expect(body).toContain("IDENTITY VAULT");
    expect(body).toContain('enctype="multipart/form-data"');
    expect(body).toContain('value="upload_selfie"');
    expect(body).toContain('value="set_avatar"');
    expect(body).toContain('value="delete_identity_asset"');
    expect(body).toContain('value="generate_character_sheet"');
  });

  it("upload_selfie writes through the shared helper", async () => {
    const form = new FormData();
    form.set("action", "upload_selfie");
    form.set(
      "file",
      new File([new Uint8Array([137, 80, 78, 71])], "selfie.png", {
        type: "image/png",
      })
    );
    const response = await settings.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(uploadIdentityImage).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.any(File),
      "selfie"
    );
  });

  it("set_avatar writes through the shared helper", async () => {
    const form = new FormData();
    form.set("action", "set_avatar");
    form.set("asset_id", "asset-1");
    const response = await settings.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(setAvatarAssetId).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "asset-1"
    );
  });

  it("delete_identity_asset removes through the shared helper", async () => {
    const form = new FormData();
    form.set("action", "delete_identity_asset");
    form.set("asset_id", "asset-1");
    const response = await settings.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(removeIdentityAsset).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "asset-1"
    );
  });

  it("generate_character_sheet runs the shared imagine-lane helper", async () => {
    const form = new FormData();
    form.set("action", "generate_character_sheet");
    const response = await settings.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(generateCharacterSheet).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "grat"
    );
  });

  it("create_heygen_avatar mints an avatar ID when HeyGen is configured", async () => {
    heygenAvailable.mockReturnValue(true);
    const form = new FormData();
    form.set("action", "create_heygen_avatar");
    const response = await settings.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(createUserHeygenAvatar).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "grat",
      "https://signed.example/a.png"
    );
  });

  it("create_heygen_avatar is refused when HeyGen is unconfigured", async () => {
    const form = new FormData();
    form.set("action", "create_heygen_avatar");
    const response = await settings.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(createUserHeygenAvatar).not.toHaveBeenCalled();
  });

  it("rejects unknown actions and non-owners", async () => {
    const unknown = new FormData();
    unknown.set("action", "definitely_not_an_action");
    expect((await settings.action!(makeCtx(), unknown)).status).toBe(403);

    const form = new FormData();
    form.set("action", "set_avatar");
    form.set("asset_id", "asset-1");
    const response = await settings.action!(makeCtx({ role: "guest" }), form);
    expect(response.status).toBe(403);
    expect(setAvatarAssetId).not.toHaveBeenCalled();
  });
});
