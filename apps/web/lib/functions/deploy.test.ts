/**
 * CR16 deploy/delete protocol: a Worker is only put for an app whose row was
 * claimed (exists, not under deletion) through the same client that owns the
 * ledger, and a deletion that begins between the claim and the vendor write
 * finds the Worker torn down again by the deploy itself.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const cloudflare = vi.hoisted(() => ({
  cloudflareConfigured: vi.fn(() => true),
  uploadAssets: vi.fn(async () => ({ jwt: "jwt", uploaded: 1 })),
  putDispatchScript: vi.fn(async () => ({ digest: "d".repeat(64) })),
  deleteDispatchScript: vi.fn(async () => undefined),
  listDispatchScripts: vi.fn(async () => [] as string[]),
}));
vi.mock("./cloudflare", () => cloudflare);

const manifest = vi.hoisted(() => ({
  writeManifest: vi.fn(async () => undefined),
  deleteManifest: vi.fn(async () => undefined),
}));
vi.mock("./manifest", () => manifest);

const tokens = vi.hoisted(() => ({ appOriginConfigured: vi.fn(() => true) }));
vi.mock("./tokens", () => tokens);

const r2 = vi.hoisted(() => ({
  r2Configured: vi.fn(() => true),
  listKeys: vi.fn(async () => ["apps/alice-notes/v1700000000001/index.html"]),
  getObject: vi.fn(async () => ({ body: Buffer.from("<html></html>") })),
}));
vi.mock("../storage/r2", () => r2);

import {
  AppOriginRefusedError,
  deployStaticVersion,
  promoteVersion,
  reconcileAppOriginMarks,
} from "./deploy";
import { makeApp } from "@/app/mini/loader-test-utils";

interface AppRow {
  id: string;
  slug: string;
  deleting_at: string | null;
  app_origin_deployed_at: string | null;
}

const db = {
  apps: [] as AppRow[],
  rpcError: null as { message: string } | null,
  readError: null as { message: string } | null,
  /** Runs once, after the claim and before the vendor write is confirmed. */
  betweenClaimAndConfirm: null as (() => void) | null,
};

function fakeSupabase(): SupabaseClient {
  const rpc = vi.fn(async (fn: string, args: { p_app_id: string }) => {
    if (fn !== "miniapp_claim_app_origin") {
      return { data: null, error: { message: `unknown rpc ${fn}` } };
    }
    if (db.rpcError) return { data: null, error: db.rpcError };
    const row = db.apps.find((a) => a.id === args.p_app_id);
    if (!row || row.deleting_at !== null) return { data: false, error: null };
    row.app_origin_deployed_at ??= "2026-02-01T00:00:00.000Z";
    return { data: true, error: null };
  });
  const from = (table: string) => {
    if (table !== "mini_apps") throw new Error(`unexpected table ${table}`);
    const filters: ((row: AppRow) => boolean)[] = [];
    let pending: Partial<AppRow> | null = null;
    const chain = {
      select: () => chain,
      eq: (col: keyof AppRow, value: unknown) => {
        filters.push((row) => row[col] === value);
        return chain;
      },
      in: (col: keyof AppRow, values: unknown[]) => {
        filters.push((row) => values.includes(row[col]));
        return chain;
      },
      is: (col: keyof AppRow, value: null) => {
        filters.push((row) => row[col] === value);
        return chain;
      },
      update: (values: Partial<AppRow>) => {
        pending = values;
        return chain;
      },
      maybeSingle: async () => {
        if (db.betweenClaimAndConfirm) {
          const hook = db.betweenClaimAndConfirm;
          db.betweenClaimAndConfirm = null;
          hook();
        }
        if (db.readError) return { data: null, error: db.readError };
        const row = db.apps.find((a) => filters.every((f) => f(a))) ?? null;
        return { data: row ? { deleting_at: row.deleting_at } : null, error: null };
      },
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
        const rows = db.apps.filter((a) => filters.every((f) => f(a)));
        if (pending) for (const row of rows) Object.assign(row, pending);
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return chain;
  };
  return { rpc, from } as unknown as SupabaseClient;
}

const app = makeApp({
  id: "app-1",
  slug: "alice-notes",
  owner_user_id: "user-alice",
  status: "published",
  bundle_version: "v1700000000000",
});

const input = {
  appId: "app-1",
  slug: "alice-notes",
  version: "v1700000000001",
  ownerUserId: "user-alice",
  files: [{ path: "index.html", bytes: Buffer.from("<html></html>") }],
  target: "draft" as const,
};

beforeEach(() => {
  process.env["CF_MANIFEST_KV_ID"] = "kv-1";
  process.env["MINIAPP_SIGNING_KEY"] = "mini-signing-key";
  process.env["APP_ORIGIN_SIGNING_KEY"] = "app-origin-signing-key";
  db.apps = [
    { id: "app-1", slug: "alice-notes", deleting_at: null, app_origin_deployed_at: null },
  ];
  db.rpcError = null;
  db.readError = null;
  db.betweenClaimAndConfirm = null;
  tokens.appOriginConfigured.mockReturnValue(true);
  cloudflare.cloudflareConfigured.mockReturnValue(true);
  cloudflare.uploadAssets.mockClear();
  cloudflare.putDispatchScript.mockClear();
  cloudflare.deleteDispatchScript.mockClear();
  cloudflare.listDispatchScripts.mockReset();
  cloudflare.listDispatchScripts.mockResolvedValue([]);
  manifest.writeManifest.mockClear();
  manifest.deleteManifest.mockClear();
});

describe("deployStaticVersion — claim before the vendor write", () => {
  it("claims the app row (setting the deploy mark) before any Worker is put", async () => {
    const supabase = fakeSupabase();
    const result = await deployStaticVersion(supabase, input);
    expect(result).toEqual({ workerSha256: "d".repeat(64) });
    expect(db.apps[0]!.app_origin_deployed_at).not.toBeNull();
    expect(cloudflare.putDispatchScript).toHaveBeenCalledTimes(1);
  });

  it("keeps the first deploy's mark", async () => {
    db.apps[0]!.app_origin_deployed_at = "2026-01-01T00:00:00.000Z";
    await deployStaticVersion(fakeSupabase(), input);
    expect(db.apps[0]!.app_origin_deployed_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("refuses an app under deletion without touching the vendor", async () => {
    db.apps[0]!.deleting_at = "2026-03-01T00:00:00.000Z";
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toBeInstanceOf(
      AppOriginRefusedError
    );
    expect(cloudflare.uploadAssets).not.toHaveBeenCalled();
    expect(cloudflare.putDispatchScript).not.toHaveBeenCalled();
  });

  it("refuses an app whose row is gone (a stale RegistryApp) without touching the vendor", async () => {
    db.apps = [];
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toBeInstanceOf(
      AppOriginRefusedError
    );
    expect(cloudflare.putDispatchScript).not.toHaveBeenCalled();
  });

  it("a failed claim write fails the deploy before any Worker is put", async () => {
    db.rpcError = { message: "connection reset" };
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toThrow(
      /app origin claim failed/
    );
    expect(cloudflare.putDispatchScript).not.toHaveBeenCalled();
  });

  it("does nothing on the legacy lane", async () => {
    tokens.appOriginConfigured.mockReturnValue(false);
    const supabase = fakeSupabase();
    await expect(deployStaticVersion(supabase, input)).resolves.toBeNull();
    expect(db.apps[0]!.app_origin_deployed_at).toBeNull();
  });
});

describe("deployStaticVersion — deletion that begins mid-deploy", () => {
  it("tears the just-put Worker down and refuses when deletion started after the claim", async () => {
    db.betweenClaimAndConfirm = () => {
      db.apps[0]!.deleting_at = "2026-03-01T00:00:00.000Z";
    };
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toBeInstanceOf(
      AppOriginRefusedError
    );
    expect(cloudflare.putDispatchScript).toHaveBeenCalledTimes(1);
    expect(manifest.deleteManifest).toHaveBeenCalledWith("alice-notes");
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledWith("alice-notes");
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledWith("alice-notes-draft");
  });

  it("tears down when the row vanished under the deploy", async () => {
    db.betweenClaimAndConfirm = () => {
      db.apps = [];
    };
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toBeInstanceOf(
      AppOriginRefusedError
    );
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledTimes(2);
  });

  it("leaves the Worker up (claim on record) when the confirm read fails", async () => {
    db.readError = { message: "connection reset" };
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toThrow(
      /app origin confirm failed/
    );
    expect(cloudflare.deleteDispatchScript).not.toHaveBeenCalled();
    expect(db.apps[0]!.app_origin_deployed_at).not.toBeNull();
  });
});

describe("promoteVersion", () => {
  it("claims the app before the live Worker is put, so publish-only deploys are marked", async () => {
    const supabase = fakeSupabase();
    await promoteVersion(supabase, app, "v1700000000001");
    expect(db.apps[0]!.app_origin_deployed_at).not.toBeNull();
    expect(cloudflare.putDispatchScript).toHaveBeenCalledWith(
      expect.objectContaining({ script: "alice-notes" })
    );
    expect(manifest.writeManifest).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published", live: "v1700000000001" })
    );
  });

  it("refuses an app under deletion before the live Worker or the manifest move", async () => {
    db.apps[0]!.deleting_at = "2026-03-01T00:00:00.000Z";
    await expect(
      promoteVersion(fakeSupabase(), app, "v1700000000001")
    ).rejects.toBeInstanceOf(AppOriginRefusedError);
    expect(cloudflare.putDispatchScript).not.toHaveBeenCalled();
    expect(manifest.writeManifest).not.toHaveBeenCalled();
  });
});

describe("reconcileAppOriginMarks — vendor inventory is the source of truth", () => {
  it("marks apps that have a script in the namespace and reports scripts with no app", async () => {
    db.apps.push({
      id: "app-2",
      slug: "bob-todo",
      deleting_at: null,
      app_origin_deployed_at: "2026-01-01T00:00:00.000Z",
    });
    cloudflare.listDispatchScripts.mockResolvedValue([
      "alice-notes-draft",
      "bob-todo",
      "carol-gone",
    ]);
    const result = await reconcileAppOriginMarks(fakeSupabase());
    expect(result).toEqual({ marked: 1, unmatched: ["carol-gone"] });
    expect(db.apps[0]!.app_origin_deployed_at).not.toBeNull();
    expect(db.apps[1]!.app_origin_deployed_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("is a no-op on the legacy lane", async () => {
    tokens.appOriginConfigured.mockReturnValue(false);
    await expect(reconcileAppOriginMarks(fakeSupabase())).resolves.toEqual({
      marked: 0,
      unmatched: [],
    });
    expect(cloudflare.listDispatchScripts).not.toHaveBeenCalled();
  });
});
