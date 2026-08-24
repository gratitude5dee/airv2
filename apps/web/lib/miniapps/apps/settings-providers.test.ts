/**
 * Settings provider/model controls: the MODEL, CREATIVE MODELS, and PROVIDER
 * KEYS sections mount, every mutation goes through the shared writers,
 * invalid slugs/providers are rejected, and no secret material is ever
 * rendered back to the browser.
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
vi.mock("@/lib/identity/assets", () => ({
  listIdentityAssets: vi.fn(async () => []),
  listIdentityMediaViews: vi.fn(async () => []),
  getAvatarAssetId: vi.fn(async () => null),
  setAvatarAssetId: vi.fn(async () => true),
  removeIdentityAsset: vi.fn(async () => true),
  signedIdentityUrl: vi.fn(async () => null),
  uploadIdentityImage: vi.fn(async () => ({ ok: true, asset: { id: "a" } })),
}));
vi.mock("@/lib/identity/generate", () => ({
  generateCharacterSheet: vi.fn(),
  saveCharacterSheetDraft: vi.fn(),
  discardCharacterSheetDraft: vi.fn(),
}));
vi.mock("@/lib/identity/twin", () => ({
  getDigitalTwin: vi.fn(async () => null),
  createTwinVideo: vi.fn(),
  createUserHeygenAvatar: vi.fn(),
}));
vi.mock("@/lib/identity/heygen", () => ({
  heygenAvailable: () => false,
}));

const setOpenRouterModel = vi.fn(async () => true);
const setVeniceModel = vi.fn(async () => true);
const setModelFamily = vi.fn(async () => true);
vi.mock("@/lib/settings/account", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/settings/account")>()),
  setOpenRouterModel: (...args: unknown[]) =>
    setOpenRouterModel(...(args as [])),
  setVeniceModel: (...args: unknown[]) => setVeniceModel(...(args as [])),
  setModelFamily: (...args: unknown[]) => setModelFamily(...(args as [])),
}));

const setCreativeModel = vi.fn(async () => true);
vi.mock("@/lib/creative/model-prefs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/creative/model-prefs")>()),
  loadCreativePrefs: vi.fn(async () => ({
    imagine: "gpt-image-2-generate",
    edit: "gpt-image-2-edit",
    animate: "seedance-2-0-fast-260128",
    zap: "gemini-omni-flash-preview",
  })),
  setCreativeModel: (...args: unknown[]) => setCreativeModel(...(args as [])),
}));

const setProviderKey = vi.fn(async () => ({ ok: true as const }));
const clearProviderKey = vi.fn(async () => true);
vi.mock("@/lib/providers/keys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/providers/keys")>()),
  providerVaultAvailable: () => true,
  listProviderKeyStatuses: vi.fn(async () => [
    { provider: "openrouter", hint: "b3f9", updatedAt: null },
    { provider: "venice", hint: null, updatedAt: null },
    { provider: "gmi", hint: null, updatedAt: null },
  ]),
  setProviderKey: (...args: unknown[]) => setProviderKey(...(args as [])),
  clearProviderKey: (...args: unknown[]) => clearProviderKey(...(args as [])),
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
    entitlements: thenable([], {
      plan: "beta",
      speed_tier: "balanced",
      model_family: "openrouter",
      openrouter_model: "anthropic/claude-sonnet-4.5",
      venice_model: null,
    }),
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
  setOpenRouterModel.mockClear();
  setVeniceModel.mockClear();
  setModelFamily.mockClear();
  setCreativeModel.mockClear();
  setProviderKey.mockClear();
  clearProviderKey.mockClear();
  boxFiles.clear();
});

describe("settings provider models", () => {
  it("mounts the OpenRouter, Venice, creative, and provider-key controls", async () => {
    const body = await (await settings.render(makeCtx())).text();
    expect(body).toContain("OpenRouter model");
    expect(body).toContain('value="set_openrouter_model"');
    expect(body).toContain("Venice model");
    expect(body).toContain('value="set_venice_model"');
    expect(body).toContain("CREATIVE MODELS");
    expect(body).toContain('value="set_creative_model"');
    expect(body).toContain("PROVIDER KEYS");
    expect(body).toContain('value="save_provider_key"');
    expect(body).toContain("····b3f9");
  });

  it("never renders sealed key material or key input values", async () => {
    const body = await (await settings.render(makeCtx())).text();
    expect(body).not.toContain("api_key_sealed");
    expect(body).toContain('type="password" name="api_key"');
    expect(body).not.toMatch(/value="sk-/);
  });

  it("set_openrouter_model writes the slug and switches the family", async () => {
    const form = new FormData();
    form.set("action", "set_openrouter_model");
    form.set("openrouter_model", "google/gemini-2.5-pro");
    const response = await settings.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(setOpenRouterModel).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "google/gemini-2.5-pro"
    );
    expect(setModelFamily).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "openrouter"
    );
  });

  it("set_venice_model writes the slug and switches the family", async () => {
    const form = new FormData();
    form.set("action", "set_venice_model");
    form.set("venice_model", "venice-uncensored");
    const response = await settings.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(setVeniceModel).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "venice-uncensored"
    );
    expect(setModelFamily).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "venice"
    );
  });

  it("rejects slugs outside the catalogs", async () => {
    const openrouter = new FormData();
    openrouter.set("action", "set_openrouter_model");
    openrouter.set("openrouter_model", "evil/injected");
    expect((await settings.action!(makeCtx(), openrouter)).status).toBe(403);
    expect(setOpenRouterModel).not.toHaveBeenCalled();

    const venice = new FormData();
    venice.set("action", "set_venice_model");
    venice.set("venice_model", "not-a-model");
    expect((await settings.action!(makeCtx(), venice)).status).toBe(403);
    expect(setVeniceModel).not.toHaveBeenCalled();
  });

  it("set_creative_model validates the lane and slug", async () => {
    const form = new FormData();
    form.set("action", "set_creative_model");
    form.set("lane", "animate");
    form.set("model", "ltx-2");
    const response = await settings.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(setCreativeModel).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "animate",
      "ltx-2"
    );

    const bad = new FormData();
    bad.set("action", "set_creative_model");
    bad.set("lane", "animate");
    bad.set("model", "nano-banana");
    expect((await settings.action!(makeCtx(), bad)).status).toBe(403);
  });

  it("save/clear provider key go through the sealed-key helpers", async () => {
    const save = new FormData();
    save.set("action", "save_provider_key");
    save.set("provider", "venice");
    save.set("api_key", "vn-personal-key-123456");
    const saved = await settings.action!(makeCtx(), save);
    expect(saved.status).toBe(200);
    expect(setProviderKey).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "venice",
      "vn-personal-key-123456"
    );
    expect(await saved.text()).not.toContain("vn-personal-key-123456");

    const clear = new FormData();
    clear.set("action", "clear_provider_key");
    clear.set("provider", "venice");
    expect((await settings.action!(makeCtx(), clear)).status).toBe(200);
    expect(clearProviderKey).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "venice"
    );

    const bad = new FormData();
    bad.set("action", "save_provider_key");
    bad.set("provider", "not-a-provider");
    bad.set("api_key", "whatever-key-12345");
    expect((await settings.action!(makeCtx(), bad)).status).toBe(403);
  });

  it("non-owners cannot touch provider settings", async () => {
    const form = new FormData();
    form.set("action", "set_openrouter_model");
    form.set("openrouter_model", "google/gemini-2.5-pro");
    const response = await settings.action!(makeCtx({ role: "guest" }), form);
    expect(response.status).toBe(403);
    expect(setOpenRouterModel).not.toHaveBeenCalled();
  });
});
