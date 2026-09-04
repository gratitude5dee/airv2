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
  parseGateSettingsRow,
  PublishError,
  setPublishStatus,
  slugFor,
  validateAppName,
} from "./publish";
import { parseRegistryApp } from "./registry";

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
