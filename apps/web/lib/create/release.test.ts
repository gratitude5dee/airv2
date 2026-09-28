/**
 * V12 §6.3 dev channel: promotion is gated by CR22, deploys the version's
 * digest to `<slug>-dev`, stamps the registry pointer with a TTL and syncs
 * the manifest; revocation deletes the Worker first and nulls the pointer;
 * the sweep revokes what has expired.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";
import type { RegistryApp } from "../miniapps/registry";
import type { VersionRow } from "./versions";

import { expectLog } from "../testing/expectLog";
const deploy = vi.hoisted(() => ({
  appOriginLaneReady: vi.fn(() => true),
  deployStaticVersion: vi.fn(async (_s: unknown, _i: { target: string }) => ({
    workerSha256: "d".repeat(64),
  })),
  loadRelease: vi.fn(async () => ({
    files: [{ path: "index.html", bytes: Buffer.from("<html></html>") }],
    module: null as Buffer | null,
  })),
  syncManifest: vi.fn(async () => true),
  scriptNameFor: (slug: string, target: string) =>
    target === "live" ? slug : `${slug}-${target}`,
}));
vi.mock("../functions/deploy", () => deploy);

const cloudflare = vi.hoisted(() => ({ deleteDispatchScript: vi.fn(async () => undefined) }));
vi.mock("../functions/cloudflare", () => cloudflare);

const versions = vi.hoisted(() => ({
  getVersion: vi.fn(async (): Promise<unknown> => null),
}));
vi.mock("./versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./versions")>()),
  getVersion: versions.getVersion,
}));

const limits = vi.hoisted(() => ({ recordOpsEvent: vi.fn(async () => undefined) }));
vi.mock("../security/limits", () => limits);

import {
  devGateReasons,
  devReleaseActive,
  devUrl,
  expireDevReleases,
  promoteToDev,
  ReleaseError,
  renewDev,
  revokeDev,
} from "./release";

const NOW = new Date("2026-03-01T12:00:00.000Z");

function versionRow(over: Partial<VersionRow> & Record<string, unknown> = {}): VersionRow {
  return {
    id: "row-1",
    app_id: "app-1",
    user_id: "user-alice",
    version: "v1700000000001",
    lane: "vibe",
    bundle_sha256: "a".repeat(64),
    bundle_bytes: 10,
    file_count: 1,
    worker_sha256: "b".repeat(64),
    kit_version: null,
    functions: null,
    findings: [],
    qa_score: 85,
    created_at: "2026-02-01T00:00:00.000Z",
    published_at: null,
    retired_at: null,
    purged_at: null,
    ...over,
  };
}

const db = {
  apps: [] as RegistryApp[],
  updates: [] as Record<string, unknown>[],
  updateError: null as { message: string } | null,
};

function fakeSupabase(): SupabaseClient {
  const from = (table: string) => {
    if (table !== "mini_apps") throw new Error(`unexpected table ${table}`);
    const filters: ((row: RegistryApp) => boolean)[] = [];
    let pending: Record<string, unknown> | null = null;
    const rows = () => db.apps.filter((a) => filters.every((f) => f(a)));
    const chain = {
      select: () => chain,
      update: (values: Record<string, unknown>) => {
        pending = values;
        return chain;
      },
      eq: (col: keyof RegistryApp, value: unknown) => {
        filters.push((row) => row[col] === value);
        return chain;
      },
      not: (col: keyof RegistryApp, _op: "is", value: null) => {
        filters.push((row) => row[col] !== value && row[col] !== undefined);
        return chain;
      },
      lte: (col: keyof RegistryApp, value: string) => {
        filters.push((row) => String(row[col]) <= value);
        return chain;
      },
      limit: () => chain,
      maybeSingle: async () => {
        if (db.updateError) return { data: null, error: db.updateError };
        const matched = rows();
        if (pending) {
          db.updates.push(pending);
          for (const row of matched) Object.assign(row, pending);
        }
        return { data: matched[0] ?? null, error: null };
      },
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve),
    };
    return chain;
  };
  return { from } as unknown as SupabaseClient;
}

const app = () =>
  makeApp({
    id: "app-1",
    slug: "alice-promo",
    appname: "promo",
    owner_user_id: "user-alice",
    publisher_username: "alice",
    status: "draft",
    draft_version: "v1700000000001",
  });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["CREATE_DEV_TTL_DAYS"];
  delete process.env["CREATE_DEV_MIN_QA"];
  delete process.env["LINKAPP_ORIGIN"];
  deploy.appOriginLaneReady.mockReturnValue(true);
  versions.getVersion.mockResolvedValue(versionRow());
  db.apps = [app()];
  db.updates = [];
  db.updateError = null;
});

describe("devGateReasons (CR22)", () => {
  it("passes a clean version with a QA score at the threshold and every test green", () => {
    expect(devGateReasons(versionRow({ qa_score: 70, tests_total: 3, tests_passed: 3 }))).toEqual([]);
  });

  it("names every failing leg", () => {
    const row = versionRow({
      findings: [{ file: "index.html", rule: "kit-foreign", hint: "no", severity: "hard" }],
      qa_score: 69,
      tests_total: 3,
      tests_passed: 2,
    });
    expect(devGateReasons(row)).toEqual(["hard_findings", "qa_score", "tests_failing"]);
  });

  it("treats a missing QA score as failing and soft findings as fine", () => {
    expect(
      devGateReasons(
        versionRow({
          qa_score: null,
          findings: [{ file: "a", rule: "inline-handler", hint: "h", severity: "soft" }],
        })
      )
    ).toEqual(["qa_score"]);
  });

  it("skips the tests leg when the version declares none (pre-0118 rows) and honours CREATE_DEV_MIN_QA", () => {
    expect(devGateReasons(versionRow({ tests_total: null, tests_passed: null }))).toEqual([]);
    process.env["CREATE_DEV_MIN_QA"] = "90";
    expect(devGateReasons(versionRow({ qa_score: 85 }))).toEqual(["qa_score"]);
  });
});

describe("promoteToDev", () => {
  it("deploys the digest to <slug>-dev, stamps the pointer with the TTL, syncs the manifest and logs dev_release", async () => {
    const result = await promoteToDev(fakeSupabase(), app(), "v1700000000001", NOW);
    expect(result).toEqual({
      channel: "dev",
      version: "v1700000000001",
      url: "https://link.wzrd.tech/alice/promo",
      expires_at: "2026-03-15T12:00:00.000Z",
    });
    expect(deploy.deployStaticVersion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: "alice-promo", version: "v1700000000001", target: "dev" })
    );
    expect(db.updates[0]).toMatchObject({
      dev_version: "v1700000000001",
      dev_released_at: NOW.toISOString(),
      dev_expires_at: "2026-03-15T12:00:00.000Z",
    });
    // The manifest is written from the fresh row, so it carries the dev pointer.
    expect(deploy.syncManifest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dev_version: "v1700000000001" })
    );
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "dev_release",
      "user-alice",
      "alice-promo"
    );
  });

  it("refuses with 409 not_ready and the CR22 reasons before touching the vendor", async () => {
    versions.getVersion.mockResolvedValue(versionRow({ qa_score: 10 }));
    const error = await promoteToDev(fakeSupabase(), app(), "v1700000000001", NOW).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(ReleaseError);
    expect((error as ReleaseError).status).toBe(409);
    expect((error as ReleaseError).message).toBe("not_ready");
    expect((error as ReleaseError).reasons).toEqual(["qa_score"]);
    expect(deploy.deployStaticVersion).not.toHaveBeenCalled();
    expect(db.updates).toHaveLength(0);
    expect(limits.recordOpsEvent).not.toHaveBeenCalled();
  });

  it("404s an unknown version and 400s a malformed one", async () => {
    versions.getVersion.mockResolvedValue(null);
    await expect(promoteToDev(fakeSupabase(), app(), "v1700000000009")).rejects.toMatchObject({
      status: 404,
    });
    await expect(promoteToDev(fakeSupabase(), app(), "latest")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("refuses a version whose bundle is gone", async () => {
    deploy.loadRelease.mockResolvedValueOnce({ files: [], module: null });
    await expect(promoteToDev(fakeSupabase(), app(), "v1700000000001")).rejects.toMatchObject({
      status: 409,
      reasons: ["no_bundle"],
    });
  });

  it("is unavailable when the app-origin lane is off (nothing could serve the release)", async () => {
    deploy.appOriginLaneReady.mockReturnValue(false);
    await expect(promoteToDev(fakeSupabase(), app(), "v1700000000001")).rejects.toMatchObject({
      status: 503,
    });
    expect(versions.getVersion).not.toHaveBeenCalled();
  });

  it("honours CREATE_DEV_TTL_DAYS and LINKAPP_ORIGIN", async () => {
    process.env["CREATE_DEV_TTL_DAYS"] = "3";
    process.env["LINKAPP_ORIGIN"] = "https://links.example/";
    const result = await promoteToDev(fakeSupabase(), app(), "v1700000000001", NOW);
    expect(result.expires_at).toBe("2026-03-04T12:00:00.000Z");
    expect(result.url).toBe("https://links.example/alice/promo");
  });
});

describe("renewDev", () => {
  it("re-promotes the current dev version with a fresh expiry", async () => {
    db.apps = [
      { ...app(), dev_version: "v1700000000001", dev_expires_at: "2026-03-02T00:00:00.000Z" },
    ];
    const result = await renewDev(fakeSupabase(), db.apps[0]!, NOW);
    expect(result.version).toBe("v1700000000001");
    expect(result.expires_at).toBe("2026-03-15T12:00:00.000Z");
    expect(deploy.deployStaticVersion).toHaveBeenCalledTimes(1);
  });

  it("409s when there is nothing to renew", async () => {
    await expect(renewDev(fakeSupabase(), app())).rejects.toMatchObject({ status: 409 });
  });
});

describe("revokeDev", () => {
  it("deletes the -dev Worker, nulls the pointers, syncs the manifest and logs dev_revoke", async () => {
    db.apps = [
      {
        ...app(),
        dev_version: "v1700000000001",
        dev_released_at: NOW.toISOString(),
        dev_expires_at: "2026-03-15T12:00:00.000Z",
      },
    ];
    const result = await revokeDev(fakeSupabase(), db.apps[0]!);
    expect(result).toEqual({ version: "v1700000000001" });
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledWith("alice-promo-dev");
    expect(db.updates[0]).toMatchObject({
      dev_version: null,
      dev_released_at: null,
      dev_expires_at: null,
    });
    expect(deploy.syncManifest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dev_version: null })
    );
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      expect.anything(),
      "dev_revoke",
      "user-alice",
      "alice-promo"
    );
  });

  it("is a quiet no-op without a dev release", async () => {
    expect(await revokeDev(fakeSupabase(), app())).toBeNull();
    expect(limits.recordOpsEvent).not.toHaveBeenCalled();
    expect(deploy.syncManifest).not.toHaveBeenCalled();
  });
});

describe("expireDevReleases", () => {
  it("revokes exactly the releases past their expiry", async () => {
    db.apps = [
      { ...app(), id: "app-1", slug: "alice-old", dev_version: "v1700000000001", dev_expires_at: "2026-02-28T00:00:00.000Z" },
      { ...app(), id: "app-2", slug: "alice-new", dev_version: "v1700000000002", dev_expires_at: "2026-03-10T00:00:00.000Z" },
      { ...app(), id: "app-3", slug: "alice-none" },
    ];
    const result = await expireDevReleases(fakeSupabase(), NOW);
    expect(result).toEqual({ revoked: 1 });
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledTimes(1);
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledWith("alice-old-dev");
    expect(db.apps[0]!.dev_version).toBeNull();
    expect(db.apps[1]!.dev_version).toBe("v1700000000002");
  });

  it("keeps sweeping when one revoke fails", async () => {
    db.apps = [
      { ...app(), id: "app-1", slug: "alice-old", dev_version: "v1700000000001", dev_expires_at: "2026-02-28T00:00:00.000Z" },
      { ...app(), id: "app-2", slug: "alice-older", dev_version: "v1700000000002", dev_expires_at: "2026-02-20T00:00:00.000Z" },
    ];
    cloudflare.deleteDispatchScript.mockRejectedValueOnce(new Error("cf 502"));
    const result = await expireDevReleases(fakeSupabase(), NOW);
    expect(result).toEqual({ revoked: 1 });
    expectLog(/dev\ release\ expiry\ failed/, { level: "error" });
  });
});

describe("devUrl / devReleaseActive", () => {
  it("builds the link-host URL from the nested path", () => {
    expect(devUrl({ slug: "alice-promo" })).toBe("https://link.wzrd.tech/alice/promo");
  });

  it("is active only while the pointer is set and unexpired", () => {
    expect(devReleaseActive({ dev_version: null, dev_expires_at: null }, NOW)).toBe(false);
    expect(
      devReleaseActive({ dev_version: "v1", dev_expires_at: "2026-02-01T00:00:00.000Z" }, NOW)
    ).toBe(false);
    expect(
      devReleaseActive({ dev_version: "v1", dev_expires_at: "2026-04-01T00:00:00.000Z" }, NOW)
    ).toBe(true);
    expect(devReleaseActive({ dev_version: "v1", dev_expires_at: "garbage" }, NOW)).toBe(false);
  });
});
