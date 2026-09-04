import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";
import { makeZip } from "./zip-test-utils";

const versions = vi.hoisted(() => ({
  uploadVersion: vi.fn(async () => "v1700000000000"),
}));
vi.mock("./versions", () => versions);

const preview = vi.hoisted(() => ({
  draftPreviewUrl: vi.fn((): string | null => "https://alice-promo.apps.wzrd.tech/__air/enter?t=x"),
}));
vi.mock("./preview", () => preview);

const publish = vi.hoisted(() => ({
  createDraft: vi.fn(async () => ({
    id: "app-alice-promo",
    slug: "alice-promo",
    name: "Promo",
    created: true,
  })),
  ownedApp: vi.fn(),
  publisherUsername: vi.fn(async () => "alice"),
}));
vi.mock("../miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../miniapps/publish")>()),
  createDraft: publish.createDraft,
  ownedApp: publish.ownedApp,
  publisherUsername: publish.publisherUsername,
}));

const registry = vi.hoisted(() => ({
  getRegistryApp: vi.fn(),
}));
vi.mock("../miniapps/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../miniapps/registry")>()),
  getRegistryApp: registry.getRegistryApp,
}));

import { BundleError } from "../miniapps/bundles";
import { PublishError } from "../miniapps/publish";
import { LintError } from "./lint";
import {
  appnameFromFilename,
  discardEmptyDraft,
  dropBundle,
  dropKind,
  normalizeDrop,
  resolveOrCreateDropApp,
} from "./drop";

const rpc = vi.fn(async () => ({ data: true, error: null }));
const supabase = { rpc } as unknown as SupabaseClient;
const OWNER = "user-alice";
const draftApp = makeApp({
  slug: "alice-promo",
  appname: "promo",
  owner_user_id: OWNER,
  status: "draft",
  visibility: "unlisted",
});

const PAGE = Buffer.from(
  '<!doctype html><html><head><link rel="stylesheet" href="./style.css"></head><body><h1>hi</h1><script src="app.js"></script></body></html>'
);
const CLEAN = Buffer.from("<!doctype html><html><body><h1>hi</h1></body></html>");

beforeEach(() => {
  rpc.mockClear();
  versions.uploadVersion.mockClear();
  publish.createDraft.mockClear();
  publish.ownedApp.mockReset();
  publish.publisherUsername.mockClear();
  registry.getRegistryApp.mockReset();
  registry.getRegistryApp.mockResolvedValue(null);
  publish.ownedApp.mockResolvedValue(draftApp);
});

describe("dropKind / normalizeDrop (§8.1)", () => {
  it("a single .html becomes index.html, bytes untouched", () => {
    const out = normalizeDrop({ name: "Promo Page.html", bytes: PAGE });
    expect(out.kind).toBe("html");
    expect(out.files).toEqual([{ path: "index.html", bytes: PAGE }]);
    expect(out.files[0]!.bytes).toBe(PAGE);
  });

  it("a .zip passes through readZip unchanged", () => {
    const zip = makeZip([
      { name: "index.html", data: CLEAN },
      { name: "css/site.css", data: "body{}" },
    ]);
    const out = normalizeDrop({ name: "site.zip", bytes: zip });
    expect(out.kind).toBe("zip");
    expect(out.files.map((f) => f.path).sort()).toEqual(["css/site.css", "index.html"]);
  });

  it("sniffs zip magic and html without an extension", () => {
    const zip = makeZip([{ name: "index.html", data: CLEAN }]);
    expect(dropKind({ name: "upload", bytes: zip })).toBe("zip");
    expect(dropKind({ name: "upload", bytes: CLEAN })).toBe("html");
    expect(() => dropKind({ name: "photo.png", bytes: Buffer.from("\x89PNG") })).toThrow(
      BundleError
    );
  });
});

describe("appnameFromFilename", () => {
  it("derives a valid appname from the file name", () => {
    expect(appnameFromFilename("Promo Page.html")).toBe("promo-page");
    expect(appnameFromFilename("/home/user/My_Site.zip")).toBe("my-site");
    expect(appnameFromFilename("index.html")).toBeNull();
    expect(appnameFromFilename(".html")).toBeNull();
  });
});

describe("dropBundle", () => {
  it("creates a draft app for a new name and stages the version without publishing", async () => {
    const result = await dropBundle(supabase, OWNER, {
      file: { name: "promo.html", bytes: CLEAN },
    });
    expect(publish.createDraft).toHaveBeenCalledWith(supabase, OWNER, {
      appname: "promo",
      name: "Promo",
      description: "",
      lane: "drop",
    });
    expect(versions.uploadVersion).toHaveBeenCalledWith(
      supabase,
      draftApp,
      [{ path: "index.html", bytes: CLEAN }],
      "drop",
      { findings: [], promote: false }
    );
    expect(result).toMatchObject({
      slug: "alice-promo",
      appname: "promo",
      version: "v1700000000000",
      url: "https://mini.wzrd.tech/alice/promo",
      preview_url: "https://alice-promo.apps.wzrd.tech/__air/enter?t=x",
      findings: [],
      kind: "html",
      status: "draft",
    });
  });

  it("reuses the owner's existing app and never promotes a live one", async () => {
    const live = makeApp({ ...draftApp, status: "published", bundle_version: "v1" });
    registry.getRegistryApp.mockResolvedValue(live);
    const result = await dropBundle(supabase, OWNER, {
      appname: "promo",
      file: { name: "index.html", bytes: CLEAN },
    });
    expect(publish.createDraft).not.toHaveBeenCalled();
    expect(versions.uploadVersion).toHaveBeenCalledWith(
      supabase,
      live,
      expect.any(Array),
      "drop",
      { findings: [], promote: false }
    );
    expect(result.status).toBe("published");
  });

  it("refuses a slug owned by someone else and a suspended app", async () => {
    registry.getRegistryApp.mockResolvedValue(makeApp({ ...draftApp, owner_user_id: "user-bob" }));
    await expect(
      dropBundle(supabase, OWNER, { appname: "promo", file: { name: "a.html", bytes: CLEAN } })
    ).rejects.toMatchObject({ status: 409, message: "that app name is taken" });
    registry.getRegistryApp.mockResolvedValue(makeApp({ ...draftApp, status: "suspended" }));
    await expect(
      dropBundle(supabase, OWNER, { appname: "promo", file: { name: "a.html", bytes: CLEAN } })
    ).rejects.toMatchObject({ status: 409 });
    expect(versions.uploadVersion).not.toHaveBeenCalled();
  });

  it("requires a name when the file is index.html and validates it (CR15)", async () => {
    await expect(
      dropBundle(supabase, OWNER, { file: { name: "index.html", bytes: CLEAN } })
    ).rejects.toBeInstanceOf(PublishError);
    await expect(
      dropBundle(supabase, OWNER, { appname: "create", file: { name: "index.html", bytes: CLEAN } })
    ).rejects.toMatchObject({ message: "that app name is reserved" });
    await expect(
      dropBundle(supabase, OWNER, { appname: "Bad Name!", file: { name: "index.html", bytes: CLEAN } })
    ).rejects.toBeInstanceOf(PublishError);
    expect(publish.createDraft).not.toHaveBeenCalled();
  });

  it("reports dangling relative refs of a single page as soft findings, not rewrites", async () => {
    const result = await dropBundle(supabase, OWNER, {
      file: { name: "promo.html", bytes: PAGE },
    });
    const rules = result.findings.map((f) => f.rule);
    expect(rules).toEqual(["dangling-ref", "dangling-ref"]);
    expect(result.findings.every((f) => f.severity === "soft")).toBe(true);
    const [, , files, , options] = versions.uploadVersion.mock.calls[0] as unknown as [
      unknown,
      unknown,
      { path: string; bytes: Buffer }[],
      string,
      { findings: unknown[] },
    ];
    expect(files[0]!.bytes).toBe(PAGE);
    expect(options.findings).toHaveLength(2);
  });

  it("a hard CSP failure rejects with a one-line reason and creates nothing (CR12)", async () => {
    const bytes = Buffer.from(
      '<!doctype html><html><body><script src="https://cdn.example.com/x.js"></script></body></html>'
    );
    const error = await dropBundle(supabase, OWNER, {
      file: { name: "promo.html", bytes },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LintError);
    expect((error as LintError).status).toBe(400);
    expect((error as LintError).message).not.toContain("\n");
    expect((error as LintError).message).toMatch(/index\.html:1/);
    expect(publish.createDraft).not.toHaveBeenCalled();
    expect(versions.uploadVersion).not.toHaveBeenCalled();
  });

  it("a zip with a service worker is refused by the bundle contract", async () => {
    const zip = makeZip([
      {
        name: "index.html",
        data: '<!doctype html><html><body><script>navigator.serviceWorker.register("/sw.js")</script></body></html>',
      },
      { name: "sw.js", data: "self.addEventListener('fetch', () => {})" },
    ]);
    await expect(
      dropBundle(supabase, OWNER, { appname: "promo", file: { name: "site.zip", bytes: zip } })
    ).rejects.toMatchObject({
      name: "BundleError",
      message: expect.stringMatching(/service workers are not allowed/),
    });
    expect(publish.createDraft).not.toHaveBeenCalled();
    expect(versions.uploadVersion).not.toHaveBeenCalled();
  });

  it("a failed first drop takes its empty draft back down", async () => {
    versions.uploadVersion.mockRejectedValueOnce(new Error("r2 unavailable"));
    await expect(
      dropBundle(supabase, OWNER, { file: { name: "promo.html", bytes: CLEAN } })
    ).rejects.toThrow("r2 unavailable");
    expect(publish.createDraft).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("miniapp_discard_empty_draft", {
      p_app_id: draftApp.id,
      p_owner_user_id: OWNER,
    });
  });

  it("a failed drop onto an app the owner already had leaves that app alone", async () => {
    registry.getRegistryApp.mockResolvedValue(draftApp);
    versions.uploadVersion.mockRejectedValueOnce(new Error("r2 unavailable"));
    await expect(
      dropBundle(supabase, OWNER, { appname: "promo", file: { name: "index.html", bytes: CLEAN } })
    ).rejects.toThrow("r2 unavailable");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a failed drop that lost the create race to a concurrent drop does not discard the winner's app", async () => {
    // Both lookups miss; the other request's insert won, so this one did not create the row.
    publish.createDraft.mockResolvedValueOnce({
      id: "app-alice-promo",
      slug: "alice-promo",
      name: "Promo",
      created: false,
    });
    versions.uploadVersion.mockRejectedValueOnce(new Error("r2 unavailable"));
    await expect(
      dropBundle(supabase, OWNER, { file: { name: "promo.html", bytes: CLEAN } })
    ).rejects.toThrow("r2 unavailable");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a zip without a root index.html is refused before any registry write", async () => {
    const zip = makeZip([{ name: "site/index.html", data: CLEAN }]);
    await expect(
      dropBundle(supabase, OWNER, { appname: "promo", file: { name: "site.zip", bytes: zip } })
    ).rejects.toBeInstanceOf(BundleError);
    expect(publish.publisherUsername).not.toHaveBeenCalled();
  });
});

describe("resolveOrCreateDropApp — creation ownership", () => {
  it("two concurrent calls for one new appname: only the insert that won created it", async () => {
    // Both lookups miss (the row does not exist yet); createDraft decides.
    registry.getRegistryApp.mockResolvedValue(null);
    publish.createDraft
      .mockResolvedValueOnce({ id: "app-alice-promo", slug: "alice-promo", name: "Promo", created: true })
      .mockResolvedValueOnce({ id: "app-alice-promo", slug: "alice-promo", name: "Promo", created: false });
    const [a, b] = await Promise.all([
      resolveOrCreateDropApp(supabase, OWNER, { appname: "promo" }),
      resolveOrCreateDropApp(supabase, OWNER, { appname: "promo" }),
    ]);
    expect(a.app.slug).toBe("alice-promo");
    expect(b.app.slug).toBe("alice-promo");
    expect([a.created, b.created].sort()).toEqual([false, true]);
  });

  it("an app the lookup already found was not created by this call", async () => {
    registry.getRegistryApp.mockResolvedValue(draftApp);
    const out = await resolveOrCreateDropApp(supabase, OWNER, { appname: "promo" });
    expect(out).toEqual({ app: draftApp, created: false });
    expect(publish.createDraft).not.toHaveBeenCalled();
  });
});

describe("discardEmptyDraft", () => {
  type Row = Record<string, unknown>;
  /**
   * The 0092 RPC as the database runs it: owned `draft`, both pointers null,
   * and no link or version row naming the app. The lock it takes is what
   * makes those checks final; the mock models only the checks.
   */
  function miniApps(rows: Row[], claims: { links?: string[]; versions?: string[] } = {}): SupabaseClient {
    return {
      rpc: async (fn: string, args: { p_app_id: string; p_owner_user_id: string }) => {
        if (fn !== "miniapp_discard_empty_draft") throw new Error(`unexpected rpc ${fn}`);
        const gone = rows.filter(
          (row) =>
            row["id"] === args.p_app_id &&
            row["owner_user_id"] === args.p_owner_user_id &&
            row["status"] === "draft" &&
            row["draft_version"] === null &&
            row["bundle_version"] === null &&
            !(claims.links ?? []).includes(args.p_app_id) &&
            !(claims.versions ?? []).includes(args.p_app_id)
        );
        for (const row of gone) rows.splice(rows.indexOf(row), 1);
        return { data: gone.length > 0, error: null };
      },
    } as unknown as SupabaseClient;
  }
  const base = { id: "app-1", owner_user_id: OWNER, status: "draft", draft_version: null, bundle_version: null };

  it("removes an owned draft that never received a version", async () => {
    const rows = [{ ...base }];
    expect(await discardEmptyDraft(miniApps(rows), OWNER, "app-1")).toBe(true);
    expect(rows).toEqual([]);
  });

  it("keeps an app once either pointer is set (a concurrent upload landed)", async () => {
    const staged = [{ ...base, draft_version: "v1" }];
    expect(await discardEmptyDraft(miniApps(staged), OWNER, "app-1")).toBe(false);
    expect(staged).toHaveLength(1);
    const uploaded = [{ ...base, bundle_version: "v1" }];
    expect(await discardEmptyDraft(miniApps(uploaded), OWNER, "app-1")).toBe(false);
    expect(uploaded).toHaveLength(1);
  });

  it("keeps an app another request has claimed but not yet filled (link or version row)", async () => {
    const linked = [{ ...base }];
    expect(await discardEmptyDraft(miniApps(linked, { links: ["app-1"] }), OWNER, "app-1")).toBe(false);
    expect(linked).toHaveLength(1);
    const reserved = [{ ...base }];
    expect(await discardEmptyDraft(miniApps(reserved, { versions: ["app-1"] }), OWNER, "app-1")).toBe(false);
    expect(reserved).toHaveLength(1);
  });

  it("never touches another owner's app or a non-draft", async () => {
    const other = [{ ...base, owner_user_id: "user-bob" }];
    expect(await discardEmptyDraft(miniApps(other), OWNER, "app-1")).toBe(false);
    expect(other).toHaveLength(1);
    const live = [{ ...base, status: "published" }];
    expect(await discardEmptyDraft(miniApps(live), OWNER, "app-1")).toBe(false);
    expect(live).toHaveLength(1);
  });

  it("reports a database failure as not discarded", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "connection reset" } }),
    } as unknown as SupabaseClient;
    expect(await discardEmptyDraft(supabase, OWNER, "app-1")).toBe(false);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
