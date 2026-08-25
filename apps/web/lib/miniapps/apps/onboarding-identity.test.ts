/**
 * Identity onboarding: the selfies/twin/avatar steps sit between model and
 * imessage, every slide renders its form plus a skip button, uploads and
 * generations go through the shared lib/identity helpers and mark the step
 * done, and the twin step degrades gracefully when GMI is unconfigured.
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
vi.mock("@/lib/vault/managers", () => ({
  listManagers: vi.fn(async () => []),
  enableManager: vi.fn(),
  ManagerInputError: class extends Error {},
}));
vi.mock("@/lib/imessage/ingest", () => ({
  mintIngestTicket: vi.fn(),
  readIngestStatus: vi.fn(async () => null),
}));
vi.mock("@/lib/commerce/merchants", () => ({
  getMerchant: vi.fn(async () => null),
  startOnboarding: vi.fn(),
}));
vi.mock("@/lib/connectors/manage", () => ({
  TOOLKIT_SLUG_PATTERN: /^[a-z0-9_-]{1,64}$/,
  beginConnect: vi.fn(),
  syncConnections: vi.fn(async () => []),
}));
vi.mock("@/lib/onairos/sync", () => ({
  syncOnairos: vi.fn(),
  onairosStatus: vi.fn(async () => ({
    configured: false,
    status: "disconnected" as const,
    connectedAt: null,
  })),
}));
vi.mock("@/lib/miniapps/cards", () => ({
  sendMiniAppCard: vi.fn(async () => undefined),
}));
vi.mock("@/lib/miniapps/cardSends", () => ({
  claimCardSend: vi.fn(async () => ({ release: vi.fn() })),
}));

const uploadIdentityImage = vi.fn(async () => ({
  ok: true as const,
  asset: { id: "asset-1" },
}));
const setAvatarAssetId = vi.fn(async () => true);
const identityAsset = {
  asset_id: "asset-1",
  role: "selfie" as const,
  asset: { id: "asset-1", storage_key: "u/asset-1.png" },
};
vi.mock("@/lib/identity/assets", () => ({
  listIdentityAssets: vi.fn(async () => [identityAsset]),
  listIdentityMediaViews: vi.fn(async () => [
    { assetId: "asset-1", role: "selfie", url: "https://signed.example/a.png" },
  ]),
  getAvatarAssetId: vi.fn(async () => null),
  setAvatarAssetId: (...args: unknown[]) =>
    setAvatarAssetId(...(args as [])),
  signedIdentityUrl: vi.fn(async () => "https://signed.example/a.png"),
  uploadIdentityImage: (...args: unknown[]) =>
    uploadIdentityImage(...(args as [])),
}));
const generateCharacterSheet = vi.fn(async () => ({
  ok: true as const,
  notice: "character sheet ready — review it below, then save or discard it.",
  deliveryUrl: "https://signed.example/sheet.png",
}));
const saveCharacterSheetDraft = vi.fn(async () => true);
const discardCharacterSheetDraft = vi.fn(async () => true);
vi.mock("@/lib/identity/generate", () => ({
  generateCharacterSheet: (...args: unknown[]) =>
    generateCharacterSheet(...(args as [])),
  saveCharacterSheetDraft: (...args: unknown[]) =>
    saveCharacterSheetDraft(...(args as [])),
  discardCharacterSheetDraft: (...args: unknown[]) =>
    discardCharacterSheetDraft(...(args as [])),
}));
const uploadTwinConsent = vi.fn(async () => ({ ok: true as const }));
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
  uploadTwinConsent: (...args: unknown[]) =>
    uploadTwinConsent(...(args as [])),
  createTwinVideo: (...args: unknown[]) => createTwinVideo(...(args as [])),
  createUserHeygenAvatar: (...args: unknown[]) =>
    createUserHeygenAvatar(...(args as [])),
}));
const heygenAvailable = vi.fn(() => false);
vi.mock("@/lib/identity/heygen", () => ({
  heygenAvailable: () => heygenAvailable(),
}));

import { ONBOARDING_STEPS } from "@/lib/miniapps/onboarding";
import { onboarding } from "@/lib/miniapps/apps/onboarding";

function thenable(rows: unknown, single: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "is", "order", "limit", "gte", "lt"]) {
    builder[method] = vi.fn(chain);
  }
  builder["maybeSingle"] = async () => ({ data: single, error: null });
  builder["then"] = (
    resolve: (value: { data: unknown; count: number }) => unknown
  ) => Promise.resolve({ data: rows, count: 0 }).then(resolve);
  return builder;
}

function makeCtx(
  step: string,
  options: { username?: string | null; via?: string } = {}
) {
  const username = options.username === undefined ? "grat" : options.username;
  const tables: Record<string, ReturnType<typeof thenable>> = {
    users: thenable([], { username }),
    agent_addresses: thenable([], { address: "grat@wzrd.tech" }),
    connections: thenable([]),
    vault_items: thenable([]),
    entitlements: thenable([], { speed_tier: "balanced" }),
    plugin_tokens: thenable([]),
    imessage_destinations: thenable([], null),
  };
  return {
    request: new NextRequest(`https://mini.example/mini/setup?step=${step}`),
    supabase: {
      from: (table: string) => tables[table] ?? thenable([]),
    } as unknown as SupabaseClient,
    app: makeApp({ slug: "setup", kind: "input" }),
    session: {
      userId: "user-1",
      resourceId: "default",
      role: "owner",
      ...(options.via ? { via: options.via } : {}),
    },
    basePath: "/mini/setup",
  } as MiniAppContext;
}

afterEach(() => {
  vi.unstubAllEnvs();
  heygenAvailable.mockReturnValue(false);
  uploadIdentityImage.mockClear();
  setAvatarAssetId.mockClear();
  generateCharacterSheet.mockClear();
  saveCharacterSheetDraft.mockClear();
  discardCharacterSheetDraft.mockClear();
  uploadTwinConsent.mockClear();
  createTwinVideo.mockClear();
  createUserHeygenAvatar.mockClear();
  boxFiles.clear();
});

function pngFile(): File {
  return new File([new Uint8Array([137, 80, 78, 71])], "selfie.png", {
    type: "image/png",
  });
}

describe("identity step registration", () => {
  it("places selfies/twin/avatar between model and imessage", () => {
    const order = (id: string) =>
      ONBOARDING_STEPS.indexOf(id as (typeof ONBOARDING_STEPS)[number]);
    expect(order("model")).toBeLessThan(order("selfies"));
    expect(order("selfies")).toBe(order("twin") - 1);
    expect(order("twin")).toBe(order("avatar") - 1);
    expect(order("avatar")).toBeLessThan(order("imessage"));
  });
});

describe("selfies step", () => {
  it("renders the multipart upload form, character sheet button, and skip", async () => {
    const body = await (await onboarding.render(makeCtx("selfies"))).text();
    expect(body).toContain('enctype="multipart/form-data"');
    expect(body).toContain('value="upload_selfie"');
    expect(body).toContain('value="generate_character_sheet"');
    expect(body).toContain('value="skip"');
  });

  it("upload_selfie goes through the shared helper and marks the step done", async () => {
    const form = new FormData();
    form.set("action", "upload_selfie");
    form.set("file", pngFile());
    const response = await onboarding.action!(makeCtx("selfies"), form);
    expect(response.status).toBe(200);
    expect(uploadIdentityImage).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.any(File),
      "selfie"
    );
    expect(boxFiles.get(".hermes/miniapps/onboarding/state.json")).toContain(
      '"selfies": "done"'
    );
  });

  it("generate_character_sheet renders a draft without marking the step done", async () => {
    const form = new FormData();
    form.set("action", "generate_character_sheet");
    const response = await onboarding.action!(makeCtx("selfies"), form);
    expect(response.status).toBe(200);
    expect(generateCharacterSheet).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "grat"
    );
    expect(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? ""
    ).not.toContain('"selfies": "done"');
  });

  it("save_character_sheet retags the draft and marks the step done", async () => {
    const form = new FormData();
    form.set("action", "save_character_sheet");
    form.set("asset_id", "asset-9");
    const response = await onboarding.action!(makeCtx("selfies"), form);
    expect(response.status).toBe(200);
    expect(saveCharacterSheetDraft).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "asset-9"
    );
    expect(boxFiles.get(".hermes/miniapps/onboarding/state.json")).toContain(
      '"selfies": "done"'
    );
  });

  it("discard_character_sheet removes the draft without completing the step", async () => {
    const form = new FormData();
    form.set("action", "discard_character_sheet");
    form.set("asset_id", "asset-9");
    const response = await onboarding.action!(makeCtx("selfies"), form);
    expect(response.status).toBe(200);
    expect(discardCharacterSheetDraft).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "asset-9"
    );
    expect(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? ""
    ).not.toContain('"selfies": "done"');
  });

  it("mounts the photo booth bundle outside lite mode only", async () => {
    const full = await (await onboarding.render(makeCtx("selfies"))).text();
    expect(full).toContain('id="identity-booth"');
    expect(full).toContain('data-mode="photo"');
    expect(full).toContain("/creator-os/identity-booth.js");
    expect(full).toContain('capture="user"');

    const lite = await (
      await onboarding.render(makeCtx("selfies", { via: "card" }))
    ).text();
    expect(lite).not.toContain("identity-booth");
  });

  it("points back to the username step when no username is set", async () => {
    const form = new FormData();
    form.set("action", "generate_character_sheet");
    const response = await onboarding.action!(
      makeCtx("selfies", { username: null }),
      form
    );
    const body = await response.text();
    expect(generateCharacterSheet).not.toHaveBeenCalled();
    expect(body).toContain("Pick a username first");
  });
});

describe("twin step", () => {
  it("degrades gracefully when GMI_CLOUD_API_KEY is unset", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", undefined);
    const body = await (await onboarding.render(makeCtx("twin"))).text();
    expect(body).toContain("isn't configured on this deployment");
    expect(body).toContain("Skip — not configured");

    const form = new FormData();
    form.set("action", "create_twin");
    form.set("script", "hello");
    const response = await onboarding.action!(makeCtx("twin"), form);
    expect(response.status).toBe(200);
    expect(createTwinVideo).not.toHaveBeenCalled();
  });

  it("renders consent upload and create forms when configured", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", "gmi-key");
    const body = await (await onboarding.render(makeCtx("twin"))).text();
    expect(body).toContain('value="upload_consent"');
    expect(body).toContain('accept="video/mp4,video/webm"');
    expect(body).toContain('value="create_twin"');
    expect(body).toContain('value="skip"');
  });

  it("mounts the video booth outside lite mode only", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", "gmi-key");
    const full = await (await onboarding.render(makeCtx("twin"))).text();
    expect(full).toContain('data-mode="video"');
    const lite = await (
      await onboarding.render(makeCtx("twin", { via: "card" }))
    ).text();
    expect(lite).not.toContain("identity-booth");
  });

  it("upload_consent and create_twin go through the shared twin module", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", "gmi-key");
    const consent = new FormData();
    consent.set("action", "upload_consent");
    consent.set(
      "file",
      new File([new Uint8Array([0, 0, 0, 24])], "consent.mp4", {
        type: "video/mp4",
      })
    );
    await onboarding.action!(makeCtx("twin"), consent);
    expect(uploadTwinConsent).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.any(File)
    );

    const create = new FormData();
    create.set("action", "create_twin");
    create.set("script", "Hi, I'm grat's twin.");
    await onboarding.action!(makeCtx("twin"), create);
    expect(createTwinVideo).toHaveBeenCalledWith(expect.anything(), "user-1", {
      avatarImageUrl: "https://signed.example/a.png",
      script: "Hi, I'm grat's twin.",
    });
    expect(boxFiles.get(".hermes/miniapps/onboarding/state.json")).toContain(
      '"twin": "done"'
    );
  });
});

describe("avatar step", () => {
  it("renders identity picks with the skip button", async () => {
    const body = await (await onboarding.render(makeCtx("avatar"))).text();
    expect(body).toContain('value="set_avatar"');
    expect(body).toContain('value="asset-1"');
    expect(body).toContain('value="skip"');
    expect(body).not.toContain("Create HeyGen avatar");
  });

  it("offers the HeyGen avatar path first when configured", async () => {
    heygenAvailable.mockReturnValue(true);
    const body = await (await onboarding.render(makeCtx("avatar"))).text();
    expect(body).toContain('value="create_heygen_avatar"');
    expect(body).toContain("Create HeyGen avatar");
  });

  it("create_heygen_avatar mints an avatar ID via the shared helper", async () => {
    heygenAvailable.mockReturnValue(true);
    const form = new FormData();
    form.set("action", "create_heygen_avatar");
    const response = await onboarding.action!(makeCtx("avatar"), form);
    expect(response.status).toBe(200);
    expect(createUserHeygenAvatar).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "grat",
      "https://signed.example/a.png"
    );
    expect(boxFiles.get(".hermes/miniapps/onboarding/state.json")).toContain(
      '"avatar": "done"'
    );
  });

  it("set_avatar writes through the shared helper and marks the step done", async () => {
    const form = new FormData();
    form.set("action", "set_avatar");
    form.set("asset_id", "asset-1");
    const response = await onboarding.action!(makeCtx("avatar"), form);
    expect(response.status).toBe(200);
    expect(setAvatarAssetId).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "asset-1"
    );
    expect(boxFiles.get(".hermes/miniapps/onboarding/state.json")).toContain(
      '"avatar": "done"'
    );
  });
});
