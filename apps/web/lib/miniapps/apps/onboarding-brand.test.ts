/**
 * Create Brand Guide: the booth slide's seventh panel registers a user's
 * logo as an @entity ref (upload -> guard -> ingest -> upsert), lists
 * existing refs with a remove path, and stays skippable — with no identity
 * role and no consent gate, since a brand mark is neither likeness nor
 * voice.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

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
  updateMiniAppCard: vi.fn(async () => "updated" as const),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/miniapps/cardSends", () => ({
  claimCardSend: vi.fn(async () => ({ release: vi.fn() })),
}));
vi.mock("@/lib/identity/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/assets")>()),
  listIdentityAssets: vi.fn(async () => []),
  listIdentityMediaViews: vi.fn(async () => []),
  listIdentityMediaRoles: vi.fn(async () => []),
  getAvatarAssetId: vi.fn(async () => null),
  signedIdentityUrl: vi.fn(async () => "https://signed.example/a.png"),
}));
vi.mock("@/lib/identity/references", () => ({
  MIN_IDENTITY_REFERENCES: 1,
  MAX_IDENTITY_REFERENCES: 6,
  listIdentityReferenceAssetIds: vi.fn(async () => []),
  replaceIdentityReferences: vi.fn(),
  clearIdentityReferences: vi.fn(),
}));
vi.mock("@/lib/identity/consent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/consent")>()),
  listConsents: vi.fn(async () => []),
}));
vi.mock("@/lib/identity/twin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/twin")>()),
  getDigitalTwin: vi.fn(async () => null),
  twinSpeechAvailable: vi.fn(() => false),
}));
vi.mock("@/lib/identity/heygen", () => ({ heygenAvailable: vi.fn(() => false) }));
vi.mock("@/lib/identity/voiceClone", () => ({
  createUserVoiceClone: vi.fn(),
  revokeUserVoiceClone: vi.fn(),
}));

const entityRefs = vi.hoisted(() => ({
  views: [] as { name: string; kind: string; label: string | null; thumbUrl: string | null }[],
  register: vi.fn(
    async (
      _s: unknown,
      _u: string,
      o: { name: string }
    ): Promise<{ ok: true; name: string } | { ok: false; error: string }> => ({
      ok: true as const,
      name: o.name,
    })
  ),
  remove: vi.fn(
    async (_s: unknown, _u: string, _k: string, _n: string) => true
  ),
}));
vi.mock("@/lib/identity/entityRefs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity/entityRefs")>()),
  entityRefViews: vi.fn(async () => entityRefs.views),
  registerEntityRef: (...args: unknown[]) =>
    entityRefs.register(...(args as [unknown, string, { name: string }])),
  deleteEntityRef: (...args: [unknown, string, string, string]) =>
    entityRefs.remove(...args),
}));
const ingestUploadedMedia = vi.hoisted(() =>
  vi.fn(async () => ({ id: "asset-logo-1" }))
);
vi.mock("@/lib/creative/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/creative/store")>()),
  ingestUploadedMedia: (...args: unknown[]) =>
    ingestUploadedMedia(...(args as [])),
}));

import { ONBOARDING_STEPS } from "@/lib/miniapps/onboarding";
import {
  effectiveStatus,
  onboarding,
  SLIDE_GROUPS,
  slideSteps,
  type OnboardingSnapshot,
} from "@/lib/miniapps/apps/onboarding";

const db = new FakeSupabase();

function makeCtx(step: string, options: { panel?: string } = {}) {
  db.tables["users"] = [{ id: "user-1", username: "grat" }];
  db.tables["agent_addresses"] = [
    {
      user_id: "user-1",
      address: "grat@wzrd.tech",
      is_primary: true,
      retired_at: null,
    },
  ];
  db.tables["entitlements"] = [{ user_id: "user-1", speed_tier: "balanced" }];
  db.tables["boxes"] = [
    {
      user_id: "user-1",
      provider_box_id: "box-1",
      environment: "ubuntu",
      control_url: null,
      control_token: null,
      state: "ready",
    },
  ];
  return {
    request: new NextRequest(
      `https://mini.example/mini/setup?step=${step}${
        options.panel ? `&panel=${options.panel}` : ""
      }`
    ),
    supabase: db.client(),
    app: makeApp({ slug: "setup", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/setup",
  } as MiniAppContext;
}

const render = async (panel?: string) =>
  (await onboarding.render(makeCtx("brand", panel ? { panel } : {}))).text();
const post = async (fields: Record<string, string | File>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return onboarding.action!(makeCtx("brand"), form);
};
const pngFile = () =>
  new File([new Uint8Array([137, 80, 78, 71])], "logo.png", {
    type: "image/png",
  });

afterEach(() => {
  db.reset();
  boxFiles.clear();
  entityRefs.views = [];
  for (const mock of [entityRefs.register, entityRefs.remove, ingestUploadedMedia]) {
    mock.mockClear();
  }
});

describe("brand step registration", () => {
  it("sits between avatar and imessage and maps to the booth slide", () => {
    const order = (id: string) =>
      ONBOARDING_STEPS.indexOf(id as (typeof ONBOARDING_STEPS)[number]);
    expect(order("brand")).toBe(order("avatar") + 1);
    expect(order("brand")).toBeLessThan(order("imessage"));
    const booth = SLIDE_GROUPS.find((slide) => slide.id === "booth");
    expect(slideSteps(booth!)).toContain("brand");
    expect(booth?.sections.at(-1)?.key).toBe("brand");
    expect(booth?.sections.at(-1)?.label).toBe("Create Brand Guide");
  });

  it("is done once a ref exists and skippable until then", () => {
    const snapshot = {
      state: { steps: {} },
      entityRefs: [],
    } as unknown as OnboardingSnapshot;
    expect(effectiveStatus(snapshot, "brand")).toBe("todo");
    const withRef = {
      ...snapshot,
      entityRefs: [{ name: "acme-logo", kind: "logo", label: null, thumbUrl: null }],
    } as OnboardingSnapshot;
    expect(effectiveStatus(withRef, "brand")).toBe("done");
  });
});

describe("brand panel", () => {
  it("renders the upload form, an existing ref, and the skip control", async () => {
    entityRefs.views = [
      {
        name: "acme-logo",
        kind: "logo",
        label: "Acme",
        thumbUrl: "https://signed.example/logo.png",
      },
    ];
    const body = await render("brand");
    expect(body).toContain("Create Brand Guide");
    expect(body).toContain('value="upload_logo"');
    expect(body).toContain('name="file"');
    expect(body).toContain('name="name"');
    expect(body).toContain("@acme-logo");
    expect(body).toContain("Acme");
    expect(body).toContain('value="delete_entity_ref"');
    expect(body).toContain('name="step" value="brand"');
  });
});

describe("upload_logo action", () => {
  it("ingests the image, registers the ref, and marks the step", async () => {
    const response = await post({
      action: "upload_logo",
      file: pngFile(),
      name: "Acme-Logo",
      label: "Acme",
    });
    const body = await response.text();
    expect(ingestUploadedMedia).toHaveBeenCalledOnce();
    const call = entityRefs.register.mock.calls[0];
    expect(call?.[1]).toBe("user-1");
    expect(call?.[2]).toMatchObject({
      kind: "logo",
      name: "acme-logo",
      assetId: "asset-logo-1",
      label: "Acme",
    });
    expect(body).toContain("@acme-logo");
    expect(stateFileDone()).toBe(true);
  });

  it("rejects the owner's own handle as a ref name", async () => {
    const response = await post({
      action: "upload_logo",
      file: pngFile(),
      name: "grat",
      label: "",
    });
    const body = await response.text();
    expect(body).toContain("pick a brand name");
    expect(entityRefs.register).not.toHaveBeenCalled();
  });

  it("asks for an image when the file is missing", async () => {
    const response = await post({ action: "upload_logo", name: "acme-logo" });
    const body = await response.text();
    expect(body).toContain("Choose an image first");
    expect(entityRefs.register).not.toHaveBeenCalled();
  });

  it("surfaces the registrar's error without marking the step", async () => {
    entityRefs.register.mockResolvedValueOnce({
      ok: false,
      error: "name taken",
    });
    const response = await post({
      action: "upload_logo",
      file: pngFile(),
      name: "acme-logo",
    });
    const body = await response.text();
    expect(body).toContain("name taken");
    expect(stateFileDone()).toBe(false);
  });
});

describe("delete_entity_ref action", () => {
  it("removes the named ref", async () => {
    const response = await post({
      action: "delete_entity_ref",
      ref_name: "acme-logo",
    });
    const body = await response.text();
    const call = entityRefs.remove.mock.calls[0];
    expect(call?.[1]).toBe("user-1");
    expect(call?.[2]).toBe("logo");
    expect(call?.[3]).toBe("acme-logo");
    expect(body).toContain("Removed @acme-logo");
  });
});

function stateFileDone(): boolean {
  const raw = boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "";
  return raw.includes('"brand"') && raw.includes('"done"');
}
