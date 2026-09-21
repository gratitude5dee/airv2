/**
 * Digital-twin onboarding: the consent/selfies/voice/twin/avatar steps sit
 * between model and imessage, every panel renders its forms plus a skip
 * button, uploads and generations go through the shared lib/identity
 * helpers behind a server-checked consent gate, provider-less deployments
 * degrade gracefully, and the Get started slide summarises the twin.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import type { IdentityMediaView } from "@/lib/identity/assets";
import type { TwinConsent } from "@/lib/identity/consent";
import type { DigitalTwin } from "@/lib/identity/twin";
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

/** Mutable fixtures the module mocks read at call time. */
const fixtures = vi.hoisted(() => ({
  media: [] as IdentityMediaView[],
  grants: [] as TwinConsent[],
  twin: null as DigitalTwin | null,
}));

const references = vi.hoisted(() => ({
  ids: [] as string[],
  list: vi.fn(async () => references.ids),
  replace: vi.fn(async (_s: unknown, _userId: string, assetIds: string[]) => ({
    ok: true as const,
    assetIds,
    referenceSheet: { id: "reference-sheet" },
  })),
  clear: vi.fn(async () => true),
}));

vi.mock("@/lib/identity/references", () => ({
  MIN_IDENTITY_REFERENCES: 1,
  MAX_IDENTITY_REFERENCES: 6,
  listIdentityReferenceAssetIds: (...args: unknown[]) =>
    references.list(...(args as [])),
  replaceIdentityReferences: (...args: unknown[]) =>
    references.replace(...(args as [unknown, string, string[]])),
  clearIdentityReferences: (...args: unknown[]) =>
    references.clear(...(args as [])),
}));

const view = (
  assetId: string,
  role: IdentityMediaView["role"],
  extra: Partial<IdentityMediaView> = {}
): IdentityMediaView => ({
  assetId,
  role,
  kind: role === "voice_sample" ? "audio" : role === "reference_video" ? "video" : "image",
  url: `https://signed.example/${assetId}`,
  position: 0,
  source: "upload",
  status: "ready",
  label: null,
  createdAt: "2026-09-01T00:00:00Z",
  ...extra,
});
const grant = (scope: TwinConsent["scope"]): TwinConsent => ({
  id: `c-${scope}`,
  user_id: "user-1",
  scope,
  policy_version: "2026-09-twin-v1",
  surface: "onboarding",
  evidence_asset_id: null,
  granted_at: "2026-09-01T00:00:00Z",
  revoked_at: null,
});

const uploadIdentityImage = vi.fn(async () => ({
  ok: true as const,
  asset: { id: "asset-1" },
}));
const uploadIdentityMedia = vi.fn(async () => ({
  ok: true as const,
  asset: { id: "asset-2" },
}));
const setAvatarAssetId = vi.fn(async () => true);
const reorderIdentityAsset = vi.fn(async () => true);
const deleteIdentityAsset = vi.fn(async () => true);
vi.mock("@/lib/identity/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/assets")>()),
  listIdentityAssets: vi.fn(async () =>
    fixtures.media.map((m) => ({
      asset_id: m.assetId,
      role: m.role,
      status: "ready",
      asset: { id: m.assetId, storage_key: `u/${m.assetId}.png` },
    }))
  ),
  listIdentityMediaViews: vi.fn(async () => fixtures.media),
  listIdentityMediaRoles: vi.fn(async () =>
    fixtures.media.map((m) => ({ ...m, url: null }))
  ),
  getAvatarAssetId: vi.fn(async () => null),
  setAvatarAssetId: (...args: unknown[]) => setAvatarAssetId(...(args as [])),
  signedIdentityUrl: vi.fn(async () => "https://signed.example/a.png"),
  uploadIdentityImage: (...args: unknown[]) =>
    uploadIdentityImage(...(args as [])),
  uploadIdentityMedia: (...args: unknown[]) =>
    uploadIdentityMedia(...(args as [])),
  reorderIdentityAsset: (...args: unknown[]) =>
    reorderIdentityAsset(...(args as [])),
  deleteIdentityAsset: (...args: unknown[]) =>
    deleteIdentityAsset(...(args as [])),
}));

const grantConsent = vi.fn(async (_s: unknown, _u: unknown, scope: string) => ({
  ...grant(scope as TwinConsent["scope"]),
}));
const revokeConsent = vi.fn(async () => true);
vi.mock("@/lib/identity/consent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/consent")>()),
  listConsents: vi.fn(async () => fixtures.grants),
  grantConsent: (...args: unknown[]) => grantConsent(...(args as [unknown, unknown, string])),
  revokeConsent: (...args: unknown[]) => revokeConsent(...(args as [])),
}));

const generateCharacterSheet = vi.fn(async () => ({
  ok: true as const,
  notice: "character sheet ready — review it below, then save or discard.",
  deliveryUrl: "https://signed.example/sheet.png",
}));
const saveCharacterSheetDraft = vi.fn(async () => true);
const discardCharacterSheetDraft = vi.fn(async () => true);
const generateProfileImage = vi.fn(async () => ({
  ok: true as const,
  notice: "profile image ready — approve it to make it your twin's face, or discard it.",
}));
const approveProfileImageDraft = vi.fn(async () => true);
const discardProfileImageDraft = vi.fn(async () => true);
const generateAltImage = vi.fn(async () => ({
  ok: true as const,
  notice: "alternate look saved to your vault.",
}));
vi.mock("@/lib/identity/generate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/generate")>()),
  generateCharacterSheet: (...args: unknown[]) =>
    generateCharacterSheet(...(args as [])),
  saveCharacterSheetDraft: (...args: unknown[]) =>
    saveCharacterSheetDraft(...(args as [])),
  discardCharacterSheetDraft: (...args: unknown[]) =>
    discardCharacterSheetDraft(...(args as [])),
  generateProfileImage: (...args: unknown[]) =>
    generateProfileImage(...(args as [])),
  approveProfileImageDraft: (...args: unknown[]) =>
    approveProfileImageDraft(...(args as [])),
  discardProfileImageDraft: (...args: unknown[]) =>
    discardProfileImageDraft(...(args as [])),
  generateAltImage: (...args: unknown[]) => generateAltImage(...(args as [])),
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
const enableVideoAvatar = vi.fn(async () => ({
  ok: true,
  status: "delivered" as const,
  line: "video avatar ready",
  jobId: "job-1",
}));
const disableVideoAvatar = vi.fn(async () => true);
const setTwinSharing = vi.fn(async () => true);
vi.mock("@/lib/identity/twin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/twin")>()),
  getDigitalTwin: vi.fn(async () => fixtures.twin),
  uploadTwinConsent: (...args: unknown[]) =>
    uploadTwinConsent(...(args as [])),
  createTwinVideo: (...args: unknown[]) => createTwinVideo(...(args as [])),
  createUserHeygenAvatar: (...args: unknown[]) =>
    createUserHeygenAvatar(...(args as [])),
  enableVideoAvatar: (...args: unknown[]) => enableVideoAvatar(...(args as [])),
  disableVideoAvatar: (...args: unknown[]) =>
    disableVideoAvatar(...(args as [])),
  setTwinSharing: (...args: unknown[]) => setTwinSharing(...(args as [])),
}));

const createUserVoiceClone = vi.fn(async () => ({
  ok: true as const,
  status: "ready" as const,
  voiceId: "voice_1",
}));
const revokeUserVoiceClone = vi.fn(async () => true);
vi.mock("@/lib/identity/voiceClone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/voiceClone")>()),
  createUserVoiceClone: (...args: unknown[]) =>
    createUserVoiceClone(...(args as [])),
  revokeUserVoiceClone: (...args: unknown[]) =>
    revokeUserVoiceClone(...(args as [])),
}));

const heygenAvailable = vi.fn(() => false);
vi.mock("@/lib/identity/heygen", () => ({
  heygenAvailable: () => heygenAvailable(),
}));

import { ONBOARDING_STEPS, defaultOnboardingState } from "@/lib/miniapps/onboarding";
import {
  effectiveStatus,
  onboarding,
  type OnboardingSnapshot,
} from "@/lib/miniapps/apps/onboarding";

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
  options: { username?: string | null; via?: string; panel?: string } = {}
) {
  const username = options.username === undefined ? "grat" : options.username;
  const tables: Record<string, ReturnType<typeof thenable>> = {
    users: thenable([], { username }),
    agent_addresses: thenable([], { address: "grat@wzrd.tech" }),
    connections: thenable([]),
    vault_items: thenable([]),
    entitlements: thenable([], { speed_tier: "balanced" }),
    plugin_tokens: thenable([]),
    boxes: thenable([], {
      provider_box_id: "box-1",
      environment: "ubuntu",
      control_url: null,
      control_token: null,
      state: "ready",
    }),
    imessage_destinations: thenable([], null),
  };
  return {
    request: new NextRequest(
      `https://mini.example/mini/setup?step=${step}${
        options.panel ? `&panel=${options.panel}` : ""
      }`
    ),
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

const render = async (
  step: string,
  options?: { username?: string | null; via?: string; panel?: string }
) => (await onboarding.render(makeCtx(step, options))).text();
/** The booth renders one stepper panel per request — address it directly. */
const renderPanel = async (
  step: string,
  panel: string,
  options?: { username?: string | null; via?: string }
) => render(step, { ...options, panel });
const post = async (fields: Record<string, string | File>, step = "selfies") => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return onboarding.action!(makeCtx(step), form);
};
const stateFile = () => boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "";

/** A fresh account that granted likeness and has one photo. */
function seedDefault(): void {
  fixtures.grants = [grant("likeness")];
  fixtures.media = [view("asset-1", "selfie")];
  fixtures.twin = null;
  references.ids = [];
}

afterEach(() => {
  vi.unstubAllEnvs();
  heygenAvailable.mockReturnValue(false);
  for (const mock of [
    uploadIdentityImage, uploadIdentityMedia, setAvatarAssetId, reorderIdentityAsset,
    deleteIdentityAsset, grantConsent, revokeConsent, generateCharacterSheet,
    saveCharacterSheetDraft, discardCharacterSheetDraft, generateProfileImage,
    approveProfileImageDraft, discardProfileImageDraft, generateAltImage,
    uploadTwinConsent, createTwinVideo, createUserHeygenAvatar, enableVideoAvatar,
    disableVideoAvatar, setTwinSharing, createUserVoiceClone, revokeUserVoiceClone,
    references.list, references.replace, references.clear,
  ]) {
    mock.mockClear();
  }
  boxFiles.clear();
  seedDefault();
});
seedDefault();

function pngFile(): File {
  return new File([new Uint8Array([137, 80, 78, 71])], "selfie.png", {
    type: "image/png",
  });
}

describe("identity step registration", () => {
  it("places consent/selfies/voice/twin/avatar between model and imessage", () => {
    const order = (id: string) =>
      ONBOARDING_STEPS.indexOf(id as (typeof ONBOARDING_STEPS)[number]);
    expect(order("model")).toBeLessThan(order("consent"));
    expect(order("consent")).toBe(order("selfies") - 1);
    expect(order("selfies")).toBe(order("voice") - 1);
    expect(order("voice")).toBe(order("twin") - 1);
    expect(order("twin")).toBe(order("avatar") - 1);
    expect(order("avatar")).toBeLessThan(order("imessage"));
  });

  it("treats the new steps as skipped on accounts that set up before they existed", () => {
    const state = defaultOnboardingState();
    const legacy = {
      state: { ...state, steps: { ...state.steps, imessage: "done" as const } },
      consents: [],
      identityMedia: [],
      twin: null,
    } as unknown as OnboardingSnapshot;
    expect(effectiveStatus(legacy, "consent")).toBe("skipped");
    expect(effectiveStatus(legacy, "voice")).toBe("skipped");
    const fresh = { ...legacy, state } as unknown as OnboardingSnapshot;
    expect(effectiveStatus(fresh, "consent")).toBe("todo");
    expect(effectiveStatus(fresh, "voice")).toBe("todo");
    expect(
      effectiveStatus({ ...fresh, consents: [grant("likeness")] } as unknown as OnboardingSnapshot, "consent")
    ).toBe("done");
  });
});

describe("consent panel", () => {
  it("explains uploads, generation, providers and controls, and asks first-person consent", async () => {
    fixtures.grants = [];
    const body = await render("consent");
    expect(body).toContain('value="grant_consent"');
    expect(body).toContain('name="scope" value="likeness" required');
    expect(body).toContain('name="scope" value="voice"');
    expect(body).toContain('name="scope" value="video_avatar"');
    expect(body).toContain("ElevenLabs");
    expect(body).toContain("fal.ai");
    expect(body).toContain("GPT Image 2");
    expect(body).toContain("Skip the twin for now");
    expect(body).toContain("I am the person in the photos");
  });

  it("shows granted scopes with their date and a revoke control", async () => {
    fixtures.grants = [grant("likeness"), grant("voice")];
    const body = await render("consent");
    expect(body).toContain("Granted 2026-09-01");
    expect(body).toContain('value="revoke_consent"');
    expect(body).toContain("Revoke voice clone");
    expect(body).not.toContain('value="likeness" required');
  });

  it("grant_consent records each ticked scope and marks the step done", async () => {
    fixtures.grants = [];
    const form = new FormData();
    form.set("action", "grant_consent");
    form.append("scope", "likeness");
    form.append("scope", "voice");
    form.append("scope", "telepathy");
    const response = await onboarding.action!(makeCtx("consent"), form);
    expect(response.status).toBe(200);
    expect(grantConsent).toHaveBeenCalledTimes(2);
    expect(grantConsent).toHaveBeenCalledWith(expect.anything(), "user-1", "likeness", {
      surface: "onboarding",
    });
    expect(stateFile()).toContain('"consent": "done"');
  });

  it("revoke_consent for voice deletes the clone as well", async () => {
    const response = await post({ action: "revoke_consent", scope: "voice" }, "consent");
    expect(response.status).toBe(200);
    expect(revokeUserVoiceClone).toHaveBeenCalledWith(expect.anything(), "user-1", {});
    expect(revokeConsent).toHaveBeenCalledWith(expect.anything(), "user-1", "voice");
  });

  it("gates every later panel and upload until likeness is granted", async () => {
    fixtures.grants = [];
    const body = await render("selfies");
    expect(body).toContain("Consent first.");
    expect(body).not.toContain('value="upload_selfie"');
    const response = await post({ action: "upload_selfie", file: pngFile() });
    expect(await response.text()).toContain("allow likeness generation");
    expect(uploadIdentityImage).not.toHaveBeenCalled();
  });
});

describe("reference media panel", () => {
  it("renders the booth, the multipart upload forms, the media manager and skip", async () => {
    const body = await render("selfies");
    expect(body).toContain('enctype="multipart/form-data"');
    expect(body).toContain('value="upload_selfie"');
    expect(body).toContain('value="skip"');
    // The picker is the whole tile, not a bare platform file button.
    expect(body).toContain('class="uploader" for="twin-photo-camera"');
    expect(body).toContain("data-autosubmit");
    // Generation lives on the next stage of the stepper, not this one.
    expect(body).not.toContain('value="generate_character_sheet"');
    expect(body).toContain(
      'accept="image/png,image/jpeg,image/webp,image/heic,image/heif"'
    );
    expect(body).toContain("HEIC photos convert automatically");
    expect(body).toContain('value="upload_media"');
    expect(body).toContain('value="reference_video"');
    expect(body).toContain('value="move_media"');
    expect(body).toContain('value="delete_media"');
    expect(body).toContain('aria-label="Delete photo 1"');
  });

  it("renders only real recent photos and marks only the saved reference set", async () => {
    fixtures.media = [
      view("booth-1", "selfie", { source: "booth" }),
      view("upload-2", "selfie"),
    ];
    references.ids = ["upload-2"];

    const body = await render("selfies");
    expect(body).toContain("Recent photos");
    expect(body).toContain('value="set_identity_references"');
    expect(body).toContain('value="booth-1"');
    expect(body).toContain('value="upload-2" checked');
    expect(body).toContain("Use selected photos (1)");
    expect(body).toContain("Booth photo");
    expect(body).toContain("Uploaded photo");
  });

  it("persists the explicit ordered 1–6 photo set before generation", async () => {
    const form = new FormData();
    form.set("action", "set_identity_references");
    form.append("asset_id", "upload-2");
    form.append("asset_id", "booth-1");

    const response = await onboarding.action!(makeCtx("selfies"), form);
    expect(response.status).toBe(200);
    expect(references.replace).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["upload-2", "booth-1"]
    );
  });

  it("mounts the photo booth bundle outside lite mode only", async () => {
    const full = await render("selfies");
    expect(full).toContain('class="identity-booth"');
    expect(full).toContain('data-mode="photo"');
    expect(full).toContain("/creator-os/identity-booth.js");
    expect(full).toContain('capture="user"');

    const lite = await render("selfies", { via: "card" });
    expect(lite).not.toContain("identity-booth");
    expect(lite).toContain('value="upload_selfie"');
  });

  it("upload_selfie goes through the shared helper with the consent id and marks the step done", async () => {
    const response = await post({ action: "upload_selfie", file: pngFile() });
    expect(response.status).toBe(200);
    expect(uploadIdentityImage).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.any(File),
      "selfie",
      { source: "upload", consentId: "c-likeness" }
    );
    expect(stateFile()).toContain('"selfies": "done"');
  });

  it("returns a truthful JSON result to a booth capture instead of treating an HTML reload as saved", async () => {
    const form = new FormData();
    form.set("action", "upload_selfie");
    form.set("source", "booth");
    form.set("file", pngFile());
    const context = makeCtx("selfies");
    context.request = new NextRequest("https://mini.example/mini/setup?step=selfies", {
      headers: { "X-Identity-Booth": "photo" },
    });

    const response = await onboarding.action!(context, form);
    expect(response.headers.get("Permissions-Policy")).toBe(
      "camera=(self), microphone=(self)"
    );
    await expect(response.json()).resolves.toEqual({ ok: true, assetId: "asset-1" });
  });

  it("upload_media stores clips and samples behind their own scopes", async () => {
    const clip = new File([new Uint8Array([0, 0, 0, 24])], "ref.mp4", { type: "video/mp4" });
    await post({ action: "upload_media", role: "reference_video", file: clip });
    expect(uploadIdentityMedia).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      expect.any(File),
      "reference_video",
      { source: "upload", consentId: "c-likeness" }
    );
    const sample = new File([new Uint8Array([73, 68, 51])], "s.mp3", { type: "audio/mpeg" });
    const refused = await post({ action: "upload_media", role: "voice_sample", file: sample }, "voice");
    expect(await refused.text()).toContain("explicit opt-in");
    expect(uploadIdentityMedia).toHaveBeenCalledTimes(1);
    const bad = await post({ action: "upload_media", role: "avatar", file: sample });
    expect(bad.status).toBe(403);
  });

  it("move_media and delete_media go through the shared helpers", async () => {
    await post({ action: "move_media", asset_id: "asset-1", role: "selfie", direction: "down" });
    expect(reorderIdentityAsset).toHaveBeenCalledWith(
      expect.anything(), "user-1", "asset-1", "selfie", "down"
    );
    const response = await post({ action: "delete_media", asset_id: "asset-1" });
    expect(deleteIdentityAsset).toHaveBeenCalledWith(expect.anything(), "user-1", "asset-1");
    expect(await response.text()).toContain("the original is gone");
  });

  it("updates the saved set before deleting a selected source photo", async () => {
    references.ids = ["asset-1"];
    const response = await post({ action: "delete_media", asset_id: "asset-1" });
    expect(references.clear).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(deleteIdentityAsset).toHaveBeenCalledWith(expect.anything(), "user-1", "asset-1");
    expect(await response.text()).toContain("the original is gone");
  });
});

describe("generated identity panel", () => {
  it("offers the photo path and the description path for the character sheet", async () => {
    const body = await renderPanel("selfies", "sheet");
    expect(body).toContain("Generate from selected photos");
    expect(body).toContain('name="description"');
    expect(body).toContain("Describe an original character, not a real person.");
    expect(body).toContain('value="generate_profile_image"');
    // Reference media — where the photos are chosen — is its own stage.
    expect(await render("selfies")).toContain("Choose 1–6 photos");
  });

  it("generate_character_sheet renders a draft without marking the step done, passing a description when given", async () => {
    const response = await post({ action: "generate_character_sheet" });
    expect(response.status).toBe(200);
    expect(generateCharacterSheet).toHaveBeenCalledWith(expect.anything(), "user-1", "grat", {});
    expect(stateFile()).not.toContain('"selfies": "done"');
    await post({ action: "generate_character_sheet", description: "a warm guide with silver glasses" });
    expect(generateCharacterSheet).toHaveBeenLastCalledWith(expect.anything(), "user-1", "grat", {
      description: "a warm guide with silver glasses",
    });
  });

  it("save_character_sheet retags the draft and marks the step done", async () => {
    const response = await post({ action: "save_character_sheet", asset_id: "asset-9" });
    expect(response.status).toBe(200);
    expect(saveCharacterSheetDraft).toHaveBeenCalledWith(expect.anything(), "user-1", "asset-9");
    expect(stateFile()).toContain('"selfies": "done"');
  });

  it("discard_character_sheet removes the draft without completing the step", async () => {
    await post({ action: "discard_character_sheet", asset_id: "asset-9" });
    expect(discardCharacterSheetDraft).toHaveBeenCalledWith(expect.anything(), "user-1", "asset-9");
    expect(stateFile()).not.toContain('"selfies": "done"');
  });

  it("generates, approves and discards the profile image through the shared helpers", async () => {
    await post({ action: "generate_profile_image", style: "futuristic editorial" });
    expect(generateProfileImage).toHaveBeenCalledWith(expect.anything(), "user-1", "grat", {
      style: "futuristic editorial",
    });
    fixtures.media = [view("asset-1", "selfie"), view("asset-7", "profile_image_draft")];
    const review = await render("selfies");
    expect(review).toContain('value="approve_profile_image"');
    expect(review).toContain('data-stepper data-stepper-active="2"');
    await post({ action: "approve_profile_image", asset_id: "asset-7" });
    expect(approveProfileImageDraft).toHaveBeenCalledWith(expect.anything(), "user-1", "asset-7");
    expect(stateFile()).toContain('"selfies": "done"');
    await post({ action: "discard_profile_image", asset_id: "asset-7" });
    expect(discardProfileImageDraft).toHaveBeenCalledWith(expect.anything(), "user-1", "asset-7");
  });

  it("points back to the username step when no username is set", async () => {
    const form = new FormData();
    form.set("action", "generate_character_sheet");
    const response = await onboarding.action!(
      makeCtx("selfies", { username: null }),
      form
    );
    expect(generateCharacterSheet).not.toHaveBeenCalled();
    expect(await response.text()).toContain("Pick a username first");
  });
});

describe("voice panel", () => {
  it("degrades gracefully when ElevenLabs is unset", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", undefined);
    const body = await render("voice");
    expect(body).toContain("Voice cloning isn't configured on this deployment");
    expect(body).toContain("Skip — not configured");
  });

  it("asks for the voice opt-in before collecting samples", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "xi");
    const body = await render("voice");
    expect(body).toContain("Voice is opt-in.");
    expect(body).not.toContain('value="voice_sample"');
  });

  it("collects samples and clones only on request once opted in", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "xi");
    fixtures.grants = [grant("likeness"), grant("voice")];
    const empty = await render("voice");
    expect(empty).toContain('data-mode="audio"');
    expect(empty).toContain('value="voice_sample"');
    expect(empty).not.toContain('value="create_voice_clone"');
    fixtures.media = [view("asset-1", "selfie"), view("asset-5", "voice_sample")];
    const withSample = await render("voice");
    expect(withSample).toContain('value="create_voice_clone"');
    expect(withSample).toContain("<audio");
    const response = await post({ action: "create_voice_clone" }, "voice");
    expect(createUserVoiceClone).toHaveBeenCalledWith(expect.anything(), "user-1", "grat");
    expect(await response.text()).toContain("Voice clone ready");
    expect(stateFile()).toContain('"voice": "done"');
    const lite = await render("voice", { via: "card" });
    expect(lite).not.toContain("identity-booth");
  });

  it("delete_voice_clone revokes provider-side and reopens the step", async () => {
    fixtures.twin = { voice_id: "voice_1", voice_status: "ready" } as unknown as DigitalTwin;
    const response = await post({ action: "delete_voice_clone" }, "voice");
    expect(revokeUserVoiceClone).toHaveBeenCalledWith(expect.anything(), "user-1", {});
    expect(await response.text()).toContain("deleted here and at ElevenLabs");
  });
});

describe("video avatar panel", () => {
  it("degrades gracefully when neither fal nor GMI is configured", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", undefined);
    vi.stubEnv("FAL_KEY", undefined);
    const body = await render("twin");
    expect(body).toContain("isn't configured on this deployment");
    expect(body).toContain("Skip — not configured");
    const response = await post({ action: "create_twin", script: "hello" }, "twin");
    expect(response.status).toBe(200);
    expect(createTwinVideo).not.toHaveBeenCalled();
  });

  it("keeps the legacy consent recording and talking-head forms behind More options", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", "gmi-key");
    vi.stubEnv("FAL_KEY", undefined);
    const body = await render("twin");
    expect(body).toContain('value="upload_consent"');
    expect(body).toContain('accept="video/mp4,video/webm"');
    expect(body).toContain('value="create_twin"');
    expect(body).toContain('value="skip"');
    expect(body).toContain('data-mode="video"');
    const lite = await render("twin", { via: "card" });
    expect(lite).not.toContain("identity-booth");
  });

  it("upload_consent and create_twin still go through the shared twin module", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", "gmi-key");
    const consent = new File([new Uint8Array([0, 0, 0, 24])], "consent.mp4", {
      type: "video/mp4",
    });
    await post({ action: "upload_consent", file: consent }, "twin");
    expect(uploadTwinConsent).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(File));
    await post({ action: "create_twin", script: "Hi, I'm grat's twin." }, "twin");
    expect(createTwinVideo).toHaveBeenCalledWith(expect.anything(), "user-1", {
      avatarImageUrl: "https://signed.example/a.png",
      script: "Hi, I'm grat's twin.",
    });
    expect(stateFile()).toContain('"twin": "done"');
  });

  it("lists what the avatar needs and enables only when everything is there", async () => {
    vi.stubEnv("FAL_KEY", "fal");
    fixtures.grants = [grant("likeness"), grant("video_avatar")];
    const missing = await render("twin");
    expect(missing).toContain("an approved profile image");
    expect(missing).not.toContain('value="enable_video_avatar"');
    fixtures.media = [
      view("asset-1", "selfie"),
      view("asset-3", "profile_image"),
      view("asset-5", "voice_sample"),
    ];
    const ready = await render("twin");
    expect(ready).toContain('value="enable_video_avatar"');
    expect(ready).toContain("labelled as synthetic");
    const response = await post({ action: "enable_video_avatar" }, "twin");
    expect(await response.text()).toContain("Rendering your video avatar");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(enableVideoAvatar).toHaveBeenCalledWith(expect.anything(), "user-1", "grat", {
      channel: "web",
    });
    fixtures.twin = { avatar_status: "pending" } as unknown as DigitalTwin;
    const pending = await render("twin");
    expect(pending).toContain('value="refresh_twin"');
    await post({ action: "disable_video_avatar" }, "twin");
    expect(disableVideoAvatar).toHaveBeenCalledWith(expect.anything(), "user-1");
  });
});

describe("deck presentation", () => {
  it("renders the twin as a six-stage stepper, one panel per request", async () => {
    const full = await render("selfies");
    expect(full).toContain('data-stepper data-stepper-active="1"');
    // Every stage is reachable from the indicator row…
    for (const label of [
      "Consent &amp; privacy",
      "Reference media",
      "Generated identity",
      "Voice",
      "Video avatar",
      "Representing image",
    ]) {
      expect(full).toContain(label);
    }
    // …but only the open one is rendered. The five it leaves out carry the
    // signed photo, sheet and avatar previews an embedded webview cannot
    // afford to decode for panels it is not showing.
    expect((full.match(/<section class="panel"/g) ?? []).length).toBe(1);
    expect(full).toContain('data-section="booth_photo"');
    expect(full).not.toContain('data-section="sheet"');
    expect(full).toContain("/creator-os/deck-swipe.js");
    expect(await render("consent")).toContain('data-stepper data-stepper-active="0"');
    expect(await render("voice")).toContain('data-stepper data-stepper-active="3"');
    expect(await render("twin")).toContain('data-stepper data-stepper-active="4"');
    expect(await render("avatar")).toContain('data-stepper data-stepper-active="5"');
    // ?panel= disambiguates the two stages that share the `selfies` step.
    expect(await renderPanel("selfies", "sheet")).toContain(
      'data-stepper data-stepper-active="2"'
    );
    // A pending sheet draft pulls ?step=selfies to the review panel.
    fixtures.media = [view("asset-1", "selfie"), view("asset-2", "character_sheet_draft")];
    expect(await render("selfies")).toContain('data-stepper data-stepper-active="2"');
    // A Messages card session gets the same one-panel stepper — it is the
    // lighter render, so there is nothing to strip back for it.
    const lite = await render("selfies", { via: "card" });
    expect(lite).toContain("data-stepper");
    expect(lite).not.toContain("deck-swipe.js");
  });

  it("gives a stepped slide one navigation and reports stage completion", async () => {
    const booth = await render("selfies");
    // Previous/Continue come from the stepper; the footer keeps the deck
    // dots and drops its own Back/Next so the two do not compete.
    expect(booth).toContain('class="stepper-nav"');
    expect(booth).toContain('class="dots"');
    expect(booth).not.toContain('<footer class="nav">');
    expect(booth).toContain("data-step-done");
    const context = await render("imessage");
    expect(context).toContain('data-stepper data-stepper-active="0"');
    expect(context).toContain('class="dots"');
  });
});

describe("get started summary", () => {
  it("summarises the twin with status pills, privacy controls and /zap and /twin examples", async () => {
    fixtures.media = [
      view("asset-1", "selfie"),
      view("asset-3", "profile_image"),
      view("asset-4", "character_sheet"),
    ];
    fixtures.twin = { voice_status: "ready", avatar_status: "off", sharing: "private" } as unknown as DigitalTwin;
    const body = await render("agent");
    expect(body).toContain("Your digital twin");
    expect(body).toContain('alt="@grat profile image"');
    expect(body).toContain("/zap Create a cinematic portrait using @grat");
    expect(body).toContain("/twin say Welcome to AirV2");
    expect(body).toContain('value="set_sharing"');
    expect(body).toContain("Allow others to reference @grat");
    expect(body).toContain("synthetic");
    expect(body).toContain("/creator-os/prompt-copy.js");
    const response = await post({ action: "set_sharing", sharing: "public" }, "agent");
    expect(setTwinSharing).toHaveBeenCalledWith(expect.anything(), "user-1", "public");
    expect(await response.text()).toContain("never your voice");
  });
});

describe("representing image", () => {
  it("renders identity picks with the skip button", async () => {
    const body = await render("avatar");
    expect(body).toContain('value="set_avatar"');
    expect(body).toContain('value="asset-1"');
    expect(body).toContain('value="skip"');
    expect(body).toContain('value="generate_alt_image"');
    expect(body).not.toContain("Train an avatar");
    expect(body).not.toContain('value="create_heygen_avatar"');
  });

  it("offers the trained avatar path first when configured, without naming the provider", async () => {
    heygenAvailable.mockReturnValue(true);
    const body = await render("avatar");
    expect(body).toContain('value="create_heygen_avatar"');
    expect(body).toContain("Train an avatar");
    expect(body).not.toContain(">HeyGen");
  });

  it("create_heygen_avatar mints an avatar ID via the shared helper", async () => {
    heygenAvailable.mockReturnValue(true);
    const response = await post({ action: "create_heygen_avatar" }, "avatar");
    expect(response.status).toBe(200);
    expect(createUserHeygenAvatar).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "grat",
      "https://signed.example/a.png"
    );
    expect(stateFile()).toContain('"avatar": "done"');
  });

  it("set_avatar writes through the shared helper and marks the step done", async () => {
    const response = await post({ action: "set_avatar", asset_id: "asset-1" }, "avatar");
    expect(response.status).toBe(200);
    expect(setAvatarAssetId).toHaveBeenCalledWith(expect.anything(), "user-1", "asset-1");
    expect(stateFile()).toContain('"avatar": "done"');
  });
});
