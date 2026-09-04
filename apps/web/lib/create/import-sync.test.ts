/**
 * V11 §11 Import, the stateful paths: a push sync refuses a closing
 * account, a removed installation and a branch that stopped being static;
 * a good sync stages a draft (never publishes) and stamps the link; account
 * deletion marks installations removed *before* asking GitHub to uninstall
 * and keeps them removed when GitHub refuses.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BundleFile } from "@/lib/miniapps/bundles";
import { makeApp } from "@/app/mini/loader-test-utils";
import { makeZip } from "@/lib/create/zip-test-utils";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  updates: [] as { table: string; values: Record<string, unknown> }[],
  log: [] as string[],
}));

vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));

function supabase(): SupabaseClient {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["eq", "is", "in", "order", "select", "limit"]) chain[method] = self;
    chain["update"] = (values: Record<string, unknown>) => {
      db.updates.push({ table, values });
      db.log.push(`update:${table}`);
      return chain;
    };
    const result = () => ({ data: db.rows[table] ?? [], error: null });
    chain["maybeSingle"] = () => Promise.resolve({ data: result().data[0] ?? null, error: null });
    chain["then"] = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return chain;
  }
  return { from: builder } as unknown as SupabaseClient;
}

const github = vi.hoisted(() => ({
  installationToken: vi.fn(async () => "ghs_short_lived"),
  branchHeadSha: vi.fn(async () => "c".repeat(40)),
  downloadZipball: vi.fn(async (): Promise<Buffer> => Buffer.alloc(0)),
  deleteInstallation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/github/app", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/github/app")>()),
  ...github,
}));

const versions = vi.hoisted(() => ({
  uploadVersion: vi.fn(
    async (..._args: [unknown, unknown, BundleFile[], string, unknown]) => "v1700000000000"
  ),
}));
vi.mock("@/lib/create/versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/versions")>()),
  uploadVersion: versions.uploadVersion,
}));

const app = makeApp({
  slug: "alice-site",
  appname: "site",
  owner_user_id: "user-alice",
  status: "draft",
  visibility: "unlisted",
});
const registry = vi.hoisted(() => ({ getRegistryApp: vi.fn() }));
vi.mock("@/lib/miniapps/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/registry")>()),
  getRegistryApp: registry.getRegistryApp,
}));

vi.mock("@/lib/security/limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/limits")>()),
  recordOpsEvent: vi.fn(async () => undefined),
}));

import { forgetInstallations, syncStaticLink, type RepoLink } from "./import";

const HTML = "<!doctype html><html><body>hi</body></html>";
const SHA = "b".repeat(40);

const link: RepoLink = {
  id: "link-1",
  user_id: "user-alice",
  installation_id: 10,
  app_id: "app-1",
  repo_id: 123,
  full_name: "alice/site",
  branch: "main",
  dir: "",
  mode: "static",
  workflow_path: null,
  last_sha: null,
  last_synced_at: null,
  last_error: null,
  created_at: "2026-09-01T00:00:00Z",
};

function installation(over: Record<string, unknown> = {}) {
  return {
    installation_id: 10,
    user_id: "user-alice",
    account_login: "alice",
    account_type: "User",
    suspended_at: null,
    removed_at: null,
    ...over,
  };
}

function zipball(files: Record<string, string>): Buffer {
  return makeZip(Object.entries(files).map(([name, data]) => ({ name: `alice-site-${SHA.slice(0, 7)}/${name}`, data })));
}

function lastError(): unknown {
  return db.updates.filter((u) => u.table === "github_repo_links").at(-1)?.values["last_error"];
}

beforeEach(() => {
  vi.clearAllMocks();
  db.rows = {
    users: [{ deleting_at: null }],
    github_installations: [installation()],
    mini_apps: [{ slug: "alice-site" }],
  };
  db.updates = [];
  db.log = [];
  registry.getRegistryApp.mockResolvedValue(app);
  github.downloadZipball.mockResolvedValue(zipball({ "index.html": HTML, "app.js": "1" }));
});

describe("syncStaticLink", () => {
  it("stages the pushed head as a draft with a short-lived read-only token and stamps the link", async () => {
    const result = await syncStaticLink(supabase(), link, SHA);
    expect(result).toMatchObject({ slug: "alice-site", version: "v1700000000000", sha: SHA });
    expect(github.installationToken).toHaveBeenCalledWith(10, {
      repositoryIds: [123],
      permissions: { contents: "read", metadata: "read" },
    });
    expect(github.downloadZipball).toHaveBeenCalledWith("ghs_short_lived", "alice/site", SHA, expect.any(Number));
    expect(github.branchHeadSha).not.toHaveBeenCalled();
    expect(versions.uploadVersion).toHaveBeenCalledWith(
      expect.anything(),
      app,
      expect.arrayContaining([expect.objectContaining({ path: "index.html" })]),
      "import",
      expect.objectContaining({ promote: false })
    );
    const stamp = db.updates.find((u) => u.table === "github_repo_links");
    expect(stamp?.values).toMatchObject({ last_sha: SHA, last_error: null });
    expect(typeof stamp?.values["last_synced_at"]).toBe("string");
  });

  it("resolves the branch head itself when the caller has none", async () => {
    const result = await syncStaticLink(supabase(), link, null);
    expect(github.branchHeadSha).toHaveBeenCalledWith("ghs_short_lived", "alice/site", "main");
    expect(result.sha).toBe("c".repeat(40));
  });

  it("refuses while the account is being deleted, before any GitHub call", async () => {
    db.rows["users"] = [{ deleting_at: "2026-09-04T00:00:00Z" }];
    await expect(syncStaticLink(supabase(), link, SHA)).rejects.toThrow(/being deleted/);
    expect(github.installationToken).not.toHaveBeenCalled();
    expect(versions.uploadVersion).not.toHaveBeenCalled();
    expect(lastError()).toMatch(/being deleted/);
  });

  it.each([
    ["removed", { removed_at: "2026-09-04T00:00:00Z" }],
    ["suspended", { suspended_at: "2026-09-04T00:00:00Z" }],
  ])("refuses a %s installation", async (_label, over) => {
    db.rows["github_installations"] = [installation(over)];
    await expect(syncStaticLink(supabase(), link, SHA)).rejects.toThrow(/no longer active/);
    expect(github.installationToken).not.toHaveBeenCalled();
  });

  it("refuses when the installation row is gone", async () => {
    db.rows["github_installations"] = [];
    await expect(syncStaticLink(supabase(), link, SHA)).rejects.toThrow(/no longer active/);
  });

  it("refuses when the linked app no longer belongs to the owner", async () => {
    registry.getRegistryApp.mockResolvedValue({ ...app, owner_user_id: "user-mallory" });
    await expect(syncStaticLink(supabase(), link, SHA)).rejects.toThrow(/no longer exists/);
    expect(github.installationToken).not.toHaveBeenCalled();
  });

  it("refuses once the branch needs a build, recording why on the link", async () => {
    github.downloadZipball.mockResolvedValue(
      zipball({
        "package.json": JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "6" } }),
        "package-lock.json": "{}",
      })
    );
    await expect(syncStaticLink(supabase(), link, SHA)).rejects.toThrow(/now needs a build/);
    expect(versions.uploadVersion).not.toHaveBeenCalled();
    expect(lastError()).toMatch(/now needs a build/);
  });

  it("refuses a head whose files fail bundle validation", async () => {
    github.downloadZipball.mockResolvedValue(
      zipball({ "index.html": HTML, "sw.js": "navigator.serviceWorker.register('/sw.js')" })
    );
    await expect(syncStaticLink(supabase(), link, SHA)).rejects.toThrow(/service worker/i);
    expect(versions.uploadVersion).not.toHaveBeenCalled();
    expect(lastError()).toMatch(/service worker/i);
  });

  it("drops files the loader cannot serve instead of failing the import", async () => {
    github.downloadZipball.mockResolvedValue(zipball({ "index.html": HTML, "logo.svg": "<svg/>", LICENSE: "MIT" }));
    await syncStaticLink(supabase(), link, SHA);
    const files = versions.uploadVersion.mock.calls[0]![2];
    expect(files.map((f) => f.path)).toEqual(["index.html"]);
  });

  it("stages the selected subdirectory only", async () => {
    github.downloadZipball.mockResolvedValue(
      zipball({ "README.md": "# root", "site/index.html": HTML, "other/index.html": "no" })
    );
    await syncStaticLink(supabase(), { ...link, dir: "site" }, SHA);
    const files = versions.uploadVersion.mock.calls[0]![2];
    expect(files.map((f) => f.path)).toEqual(["index.html"]);
  });
});

describe("forgetInstallations", () => {
  it("marks every installation removed before uninstalling at GitHub", async () => {
    db.rows["github_installations"] = [installation(), installation({ installation_id: 11 })];
    let markedBeforeVendor = false;
    github.deleteInstallation.mockImplementationOnce(async () => {
      markedBeforeVendor = db.updates.some(
        (u) => u.table === "github_installations" && typeof u.values["removed_at"] === "string"
      );
    });
    const result = await forgetInstallations(supabase(), "user-alice");
    expect(result).toEqual({ uninstalled: 2, failed: 0 });
    expect(markedBeforeVendor).toBe(true);
    expect(github.deleteInstallation).toHaveBeenCalledWith(10);
    expect(github.deleteInstallation).toHaveBeenCalledWith(11);
  });

  it("keeps the row removed when GitHub refuses the uninstall", async () => {
    github.deleteInstallation.mockRejectedValueOnce(new Error("vendor 502"));
    const result = await forgetInstallations(supabase(), "user-alice");
    expect(result).toEqual({ uninstalled: 0, failed: 1 });
    expect(db.updates).toEqual([
      { table: "github_installations", values: { removed_at: expect.any(String) } },
    ]);
  });

  it("is a no-op for an account without installations", async () => {
    db.rows["github_installations"] = [];
    expect(await forgetInstallations(supabase(), "user-alice")).toEqual({ uninstalled: 0, failed: 0 });
    expect(github.deleteInstallation).not.toHaveBeenCalled();
  });
});
