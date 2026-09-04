import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const deploy = vi.hoisted(() => ({
  AppOriginRefusedError: class AppOriginRefusedError extends Error {
    constructor(slug: string) {
      super(`app ${slug} is being deleted`);
      this.name = "AppOriginRefusedError";
    }
  },
  promoteVersion: vi.fn(async () => null),
  syncManifest: vi.fn(async () => true),
}));
vi.mock("../functions/deploy", () => deploy);
const versions = vi.hoisted(() => ({
  getVersion: vi.fn(async () => null as { version: string } | null),
  pointLiveAt: vi.fn(async () => undefined),
}));
vi.mock("../create/versions", () => versions);

import { makeApp } from "@/app/mini/loader-test-utils";
import { isReservedWord, RESERVED_WORDS } from "./reserved";
import {
  createDraft,
  parseGateSettingsRow,
  PublishError,
  setPublishStatus,
  slugFor,
  validateAppName,
} from "./publish";
import { parseRegistryApp } from "./registry";

describe("createDraft refresh keeps existing metadata", () => {
  function draftSupabase(
    existing: Record<string, unknown> | null,
    opts: { refreshFails?: boolean } = {}
  ) {
    const updates: Record<string, unknown>[] = [];
    const inserted: Record<string, unknown>[] = [];
    const supabase = {
      from(table: string) {
        if (table === "users") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { username: "alice", wallet_address: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table !== "mini_apps") throw new Error(`unexpected table ${table}`);
        return {
          update(values: Record<string, unknown>) {
            updates.push(values);
            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    maybeSingle: async () =>
                      opts.refreshFails
                        ? { data: null, error: { message: "connection reset" } }
                        : {
                            data: existing ? { ...existing, ...values } : null,
                            error: null,
                          },
                  }),
                }),
              }),
            };
          },
          insert(row: Record<string, unknown>) {
            inserted.push(row);
            return {
              select: () => ({
                single: async () =>
                  existing
                    ? { data: null, error: { code: "23505", message: "dup" } }
                    : { data: { ...row, id: "app-1" }, error: null },
              }),
            };
          },
        };
      },
    } as unknown as SupabaseClient;
    return { supabase, updates, inserted };
  }

  const existing = {
    id: "app-1",
    slug: "alice-promo",
    name: "Spring Promo",
    description: "Our spring line.",
  };

  it("an omitted name and description leave the app's own metadata alone", async () => {
    const { supabase, updates, inserted } = draftSupabase(existing);
    const result = await createDraft(supabase, "user-1", {
      appname: "promo",
      name: "",
      description: "",
    });
    expect(result).toEqual({ id: "app-1", slug: "alice-promo", name: "Spring Promo" });
    expect(inserted).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty("name");
    expect(updates[0]).not.toHaveProperty("description");
    expect(updates[0]).not.toHaveProperty("agent_identity");
  });

  it("a supplied title replaces only the title on refresh", async () => {
    const { supabase, updates } = draftSupabase(existing);
    await createDraft(supabase, "user-1", {
      appname: "promo",
      name: "Summer Promo",
      description: "",
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ name: "Summer Promo" });
    expect(updates[0]).not.toHaveProperty("description");
  });

  it("a new app still needs a name", async () => {
    const { supabase, inserted } = draftSupabase(null);
    await expect(
      createDraft(supabase, "user-1", { appname: "promo", name: "", description: "" })
    ).rejects.toMatchObject({ message: "name required" });
    expect(inserted).toHaveLength(0);
  });

  it("a failed refresh surfaces as a failure, not as 'name required' or 'taken'", async () => {
    const omitted = draftSupabase(existing, { refreshFails: true });
    await expect(
      createDraft(omitted.supabase, "user-1", { appname: "promo", name: "", description: "" })
    ).rejects.toThrow(/draft refresh failed: connection reset/);
    const duplicate = draftSupabase(existing, { refreshFails: true });
    await expect(
      createDraft(duplicate.supabase, "user-1", {
        appname: "promo",
        name: "Promo",
        description: "",
      })
    ).rejects.toThrow(/draft refresh failed: connection reset/);
    expect(duplicate.inserted).toHaveLength(1);
  });
});

describe("reserved words (both directions)", () => {
  it("reserves platform routes and first-party slugs", () => {
    for (const word of ["admin", "api", "store", "publish", "vault", "todo"]) {
      expect(isReservedWord(word)).toBe(true);
    }
  });
  it("is case-insensitive", () => {
    expect(isReservedWord("Admin")).toBe(true);
    expect(isReservedWord("STORE")).toBe(true);
  });
  it("allows ordinary names", () => {
    expect(isReservedWord("notes")).toBe(false);
    expect(isReservedWord("recipes")).toBe(false);
  });
  it("keeps the list non-empty and lowercase", () => {
    expect(RESERVED_WORDS.size).toBeGreaterThan(10);
    for (const word of RESERVED_WORDS) {
      expect(word).toBe(word.toLowerCase());
    }
  });
});

describe("validateAppName", () => {
  it("rejects reserved app names (app-name direction)", () => {
    expect(() => validateAppName("admin")).toThrowError(PublishError);
    expect(() => validateAppName("vault")).toThrowError(/reserved/);
  });
  it("rejects malformed names", () => {
    for (const bad of [
      "",
      "-lead",
      "trail-",
      "has space",
      "dots.dots",
      "a".repeat(33),
      "../etc",
    ]) {
      expect(() => validateAppName(bad)).toThrowError(PublishError);
    }
  });
  it("normalizes and accepts valid names", () => {
    expect(validateAppName(" Notes ".toLowerCase().trim())).toBe("notes");
    expect(validateAppName("my-app-2")).toBe("my-app-2");
  });
});

describe("published slug shape", () => {
  it("is always <username>-<appname>", () => {
    expect(slugFor("alice", "todo")).toBe("alice-todo");
  });
  it("can never equal a bare reserved word", () => {
    // Usernames are non-empty, so the slug always carries a hyphenated
    // prefix — a bare reserved word like "store" is unreachable.
    for (const word of RESERVED_WORDS) {
      expect(slugFor("alice", word === "" ? "x" : "app")).not.toBe(word);
    }
  });
});

describe("parseRegistryApp", () => {
  const valid = {
    id: "app-1",
    slug: "alice-notes",
    kind: "render",
    owner_user_id: "user-1",
    name: "Notes",
    description: "A notes app",
    icon_key: null,
    publisher_username: "alice",
    publisher_wallet: null,
    agent_identity: null,
    visibility: "public",
    access: "single",
    password_hash: null,
    x402_enabled: false,
    x402_price_usdc: null,
    plugin_signin_enabled: false,
    status: "published",
    bundle_version: "v1",
    listed_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    appname: "notes",
    draft_version: null,
    lane: "drop",
    functions_enabled: false,
    kit_version: null,
    create_budget_usd: "5.00",
  };

  it("accepts a complete selected row", () => {
    expect(parseRegistryApp(valid)).toEqual({ ...valid, create_budget_usd: 5 });
  });

  it("normalizes pre-0083 rows that lack the V11 columns", () => {
    const legacy: Record<string, unknown> = { ...valid };
    for (const column of [
      "appname",
      "draft_version",
      "lane",
      "functions_enabled",
      "kit_version",
      "create_budget_usd",
    ]) {
      delete legacy[column];
    }
    expect(parseRegistryApp(legacy)).toMatchObject({
      appname: null,
      draft_version: null,
      lane: null,
      functions_enabled: false,
      kit_version: null,
      create_budget_usd: 5,
    });
  });

  it("coerces numeric prices returned as strings", () => {
    expect(
      parseRegistryApp({ ...valid, x402_price_usdc: "0.500000" })
    ).toMatchObject({ x402_price_usdc: 0.5 });
  });

  it("rejects rows with a drifted domain field", () => {
    expect(parseRegistryApp({ ...valid, status: "active" })).toBeNull();
    expect(parseRegistryApp({ ...valid, x402_enabled: "false" })).toBeNull();
  });
});

describe("parseGateSettingsRow", () => {
  it("coerces numeric prices returned as strings", () => {
    expect(
      parseGateSettingsRow({
        id: "app-1",
        owner_user_id: "user-1",
        x402_enabled: true,
        x402_price_usdc: "0.500000",
      })
    ).toEqual({
      id: "app-1",
      owner_user_id: "user-1",
      x402_enabled: true,
      x402_price_usdc: 0.5,
    });
  });

  it("rejects empty numeric strings", () => {
    expect(
      parseGateSettingsRow({
        id: "app-1",
        owner_user_id: "user-1",
        x402_enabled: false,
        x402_price_usdc: "  ",
      })
    ).toBeNull();
  });
});

describe("setPublishStatus (V11 §13.2 manifest ordering)", () => {
  const live = makeApp({
    id: "app-notes",
    slug: "alice-notes",
    owner_user_id: "user-alice",
    publisher_username: "alice",
    appname: "notes",
    status: "published",
    bundle_version: "v1700000000001",
  });
  let statusFlipFails = false;

  function fakeSupabase(app: ReturnType<typeof makeApp>): SupabaseClient {
    const builder = {
      select: () => builder,
      update: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: app, error: null }),
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve(
          statusFlipFails
            ? { data: null, error: { message: "connection reset" } }
            : { data: null, error: null }
        ).then(resolve),
    };
    return { from: () => builder } as unknown as SupabaseClient;
  }

  beforeEach(() => {
    statusFlipFails = false;
    deploy.promoteVersion.mockClear();
    deploy.syncManifest.mockClear();
    versions.getVersion.mockReset();
    versions.getVersion.mockResolvedValue({ version: "v1700000000001" });
    versions.pointLiveAt.mockClear();
  });

  it("delisting writes the draft manifest before the row flips", async () => {
    await setPublishStatus(fakeSupabase(live), "user-alice", "alice-notes", "draft");
    expect(deploy.syncManifest).toHaveBeenCalledTimes(1);
    expect(deploy.syncManifest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: "alice-notes", status: "draft" })
    );
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
  });

  it("a delist whose row flip fails restores the published manifest so the app stays up", async () => {
    statusFlipFails = true;
    await expect(
      setPublishStatus(fakeSupabase(live), "user-alice", "alice-notes", "draft")
    ).rejects.toThrow(/status flip failed/);
    expect(deploy.syncManifest).toHaveBeenCalledTimes(2);
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        slug: "alice-notes",
        status: "published",
        bundle_version: "v1700000000001",
      })
    );
  });

  it("a publish whose row flip fails leaves the manifest on draft, not serving", async () => {
    const draft = makeApp({ ...live, status: "draft" });
    statusFlipFails = true;
    const supabase = fakeSupabase(draft);
    await expect(
      setPublishStatus(supabase, "user-alice", "alice-notes", "published")
    ).rejects.toThrow(/status flip failed/);
    expect(deploy.promoteVersion).toHaveBeenCalledWith(supabase, draft, "v1700000000001");
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      supabase,
      expect.objectContaining({ slug: "alice-notes", status: "draft" })
    );
  });

  it("publishing an app under deletion is refused as 409 before the row flips", async () => {
    const draft = makeApp({ ...live, status: "draft" });
    deploy.promoteVersion.mockRejectedValueOnce(
      new deploy.AppOriginRefusedError("alice-notes")
    );
    await expect(
      setPublishStatus(fakeSupabase(draft), "user-alice", "alice-notes", "published")
    ).rejects.toMatchObject({ status: 409, message: /being deleted/ });
    expect(versions.pointLiveAt).not.toHaveBeenCalled();
  });
});

describe("setPublishStatus promotes a staged draft (V11 §8 Drop onto a live app)", () => {
  const live = makeApp({
    id: "app-notes",
    slug: "alice-notes",
    owner_user_id: "user-alice",
    publisher_username: "alice",
    appname: "notes",
    status: "published",
    bundle_version: "v1700000000001",
    draft_version: "v1700000000002",
  });

  let statusFlipFails = false;

  function fakeSupabase(app: ReturnType<typeof makeApp>): SupabaseClient {
    const builder = {
      select: () => builder,
      update: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: app, error: null }),
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve(
          statusFlipFails
            ? { data: null, error: { message: "connection reset" } }
            : { data: null, error: null }
        ).then(resolve),
    };
    return { from: () => builder } as unknown as SupabaseClient;
  }

  beforeEach(() => {
    statusFlipFails = false;
    deploy.promoteVersion.mockClear();
    deploy.syncManifest.mockClear();
    versions.getVersion.mockReset();
    versions.pointLiveAt.mockReset();
    versions.pointLiveAt.mockResolvedValue(undefined);
  });

  it("publishing a live app with a newer draft promotes the draft, not the live version", async () => {
    versions.getVersion.mockResolvedValue({ version: "v1700000000002" });
    await setPublishStatus(fakeSupabase(live), "user-alice", "alice-notes", "published");
    expect(versions.getVersion).toHaveBeenCalledWith(expect.anything(), "app-notes", "v1700000000002");
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(1);
    expect(deploy.promoteVersion).toHaveBeenCalledWith(expect.anything(), live, "v1700000000002");
    expect(versions.pointLiveAt).toHaveBeenCalledWith(expect.anything(), live, "v1700000000002");
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "published", bundle_version: "v1700000000002" })
    );
  });

  it("with no staged draft the live version is (re)published as before", async () => {
    const same = makeApp({ ...live, draft_version: "v1700000000001" });
    versions.getVersion.mockResolvedValue({ version: "v1700000000001" });
    await setPublishStatus(fakeSupabase(same), "user-alice", "alice-notes", "published");
    expect(versions.getVersion).toHaveBeenCalledWith(expect.anything(), "app-notes", "v1700000000001");
    expect(deploy.promoteVersion).toHaveBeenCalledWith(expect.anything(), same, "v1700000000001");
  });

  it("a first publish of a draft app still goes through bundle_version", async () => {
    const draft = makeApp({ ...live, status: "draft", draft_version: "v1700000000001" });
    versions.getVersion.mockResolvedValue({ version: "v1700000000001" });
    await setPublishStatus(fakeSupabase(draft), "user-alice", "alice-notes", "published");
    expect(deploy.promoteVersion).toHaveBeenCalledWith(expect.anything(), draft, "v1700000000001");
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "published", bundle_version: "v1700000000001" })
    );
  });

  it("a lost pointer swap puts the live Worker back on the previous release", async () => {
    versions.getVersion.mockResolvedValue({ version: "v1700000000002" });
    versions.pointLiveAt.mockRejectedValueOnce(new Error("live version changed underneath this request; retry"));
    await expect(
      setPublishStatus(fakeSupabase(live), "user-alice", "alice-notes", "published")
    ).rejects.toThrow(/changed underneath/);
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(2);
    expect(deploy.promoteVersion).toHaveBeenLastCalledWith(expect.anything(), live, "v1700000000001");
    expect(deploy.syncManifest).not.toHaveBeenCalled();
  });

  it("a metadata write that fails after the swap restores the previous release, Worker first", async () => {
    versions.getVersion.mockResolvedValue({ version: "v1700000000002" });
    statusFlipFails = true;
    await expect(
      setPublishStatus(fakeSupabase(live), "user-alice", "alice-notes", "published")
    ).rejects.toThrow(/status flip failed/);
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(2);
    expect(deploy.promoteVersion).toHaveBeenLastCalledWith(expect.anything(), live, "v1700000000001");
    expect(versions.pointLiveAt).toHaveBeenCalledTimes(2);
    expect(versions.pointLiveAt).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ bundle_version: "v1700000000002" }),
      "v1700000000001"
    );
    expect(deploy.promoteVersion.mock.invocationCallOrder[1]).toBeLessThan(
      versions.pointLiveAt.mock.invocationCallOrder[1] ?? 0
    );
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "published", bundle_version: "v1700000000001" })
    );
  });

  it("when the restore itself loses the swap, the manifest follows the registry's new pointer", async () => {
    versions.getVersion.mockResolvedValue({ version: "v1700000000002" });
    statusFlipFails = true;
    versions.pointLiveAt
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("live version changed underneath this request; retry"));
    await expect(
      setPublishStatus(fakeSupabase(live), "user-alice", "alice-notes", "published")
    ).rejects.toThrow(/status flip failed/);
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ bundle_version: "v1700000000002" })
    );
  });

  it("refuses a staged draft whose files were swept", async () => {
    versions.getVersion.mockResolvedValue(null);
    await expect(
      setPublishStatus(fakeSupabase(live), "user-alice", "alice-notes", "published")
    ).rejects.toMatchObject({ status: 409 });
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
  });

  it("unpublishing ignores the staged draft", async () => {
    await setPublishStatus(fakeSupabase(live), "user-alice", "alice-notes", "draft");
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
    expect(versions.pointLiveAt).not.toHaveBeenCalled();
    expect(deploy.syncManifest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "draft", bundle_version: "v1700000000001" })
    );
  });
});
