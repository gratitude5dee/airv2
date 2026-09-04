/**
 * CR16 deploy/delete protocol: a Worker or manifest is only written for an
 * app that was claimed (exists, neither it nor its account under deletion)
 * through the same client that owns the ledger, and a deletion that begins
 * between the claim and the vendor write finds the origin torn down again by
 * the writer itself.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const cloudflare = vi.hoisted(() => ({
  cloudflareConfigured: vi.fn(() => true),
  uploadAssets: vi.fn(async () => ({ jwt: "jwt", uploaded: 1 })),
  putDispatchScript: vi.fn(async (_upload: { script: string }) => ({ digest: "d".repeat(64) })),
  deleteDispatchScript: vi.fn(async () => undefined),
  listDispatchScripts: vi.fn(async () => [] as string[]),
}));
vi.mock("./cloudflare", () => cloudflare);

const manifest = vi.hoisted(() => ({
  writeManifest: vi.fn(async () => undefined),
  deleteManifest: vi.fn(async () => undefined),
  readManifest: vi.fn(
    async (_slug: string): Promise<{
      slug: string;
      status: string;
      live: string | null;
      draft: string | null;
      owner_ref: string;
      functions: boolean;
      updated_at: string;
    } | null> => null
  ),
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
  ORIGIN_DRIFT_GRACE_MS,
  promoteVersion,
  reconcileAppOriginMarks,
  reconcileAppOrigins,
  syncManifest,
} from "./deploy";
import { makeApp } from "@/app/mini/loader-test-utils";
import type { RegistryApp } from "../miniapps/registry";

interface AppRow extends Partial<RegistryApp> {
  id: string;
  slug: string;
  deleting_at: string | null;
  app_origin_deployed_at: string | null;
}

const db = {
  apps: [] as AppRow[],
  /** users.deleting_at for the one owner every app here belongs to. */
  accountDeletingAt: null as string | null,
  rpcError: null as { message: string } | null,
  /** Fails the RPC from its second call on (the claim succeeded, the confirm cannot read). */
  confirmError: null as { message: string } | null,
  claims: 0,
  /** Runs once, before the second claim (i.e. after the first vendor write). */
  betweenClaimAndConfirm: null as (() => void) | null,
  /** Runs once, before the Nth claim (1-based); for races later in a multi-write flow. */
  beforeClaim: null as { n: number; run: () => void } | null,
  /** Fails every plain table read (the slug-owner check before a teardown). */
  readError: null as { message: string } | null,
  /** Paged reads issued (reconcileAppOrigins). */
  pages: 0,
};

function fakeSupabase(): SupabaseClient {
  const rpc = vi.fn(async (fn: string, args: { p_app_id: string }) => {
    if (fn !== "miniapp_claim_app_origin") {
      return { data: null, error: { message: `unknown rpc ${fn}` } };
    }
    db.claims += 1;
    if (db.claims === 2 && db.betweenClaimAndConfirm) {
      const hook = db.betweenClaimAndConfirm;
      db.betweenClaimAndConfirm = null;
      hook();
    }
    if (db.beforeClaim && db.beforeClaim.n === db.claims) {
      const hook = db.beforeClaim;
      db.beforeClaim = null;
      hook.run();
    }
    if (db.rpcError) return { data: null, error: db.rpcError };
    if (db.claims > 1 && db.confirmError) return { data: null, error: db.confirmError };
    const row = db.apps.find((a) => a.id === args.p_app_id);
    if (!row || row.deleting_at !== null || db.accountDeletingAt !== null) {
      return { data: false, error: null };
    }
    row.app_origin_deployed_at ??= "2026-02-01T00:00:00.000Z";
    return { data: true, error: null };
  });
  const from = (table: string) => {
    if (table !== "mini_apps") throw new Error(`unexpected table ${table}`);
    const filters: ((row: AppRow) => boolean)[] = [];
    let pending: Partial<AppRow> | null = null;
    let window: [number, number] | null = null;
    const chain = {
      select: () => chain,
      order: () => chain,
      range: (from: number, to: number) => {
        window = [from, to];
        db.pages += 1;
        return chain;
      },
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
      not: (col: keyof AppRow, _op: "is", value: null) => {
        filters.push((row) => row[col] !== value);
        return chain;
      },
      update: (values: Partial<AppRow>) => {
        pending = values;
        return chain;
      },
      maybeSingle: async () => {
        if (db.readError) return { data: null, error: db.readError };
        const rows = db.apps.filter((a) => filters.every((f) => f(a)));
        return { data: rows[0] ?? null, error: null };
      },
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
        let rows = db.apps.filter((a) => filters.every((f) => f(a)));
        if (pending) for (const row of rows) Object.assign(row, pending);
        if (window) rows = rows.slice(window[0], window[1] + 1);
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
  db.accountDeletingAt = null;
  db.rpcError = null;
  db.confirmError = null;
  db.claims = 0;
  db.betweenClaimAndConfirm = null;
  db.beforeClaim = null;
  db.readError = null;
  db.pages = 0;
  tokens.appOriginConfigured.mockReturnValue(true);
  cloudflare.cloudflareConfigured.mockReturnValue(true);
  cloudflare.uploadAssets.mockClear();
  cloudflare.putDispatchScript.mockClear();
  cloudflare.deleteDispatchScript.mockClear();
  cloudflare.listDispatchScripts.mockReset();
  cloudflare.listDispatchScripts.mockResolvedValue([]);
  manifest.writeManifest.mockClear();
  manifest.deleteManifest.mockClear();
  manifest.readManifest.mockReset();
  manifest.readManifest.mockResolvedValue(null);
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

  it("refuses an app whose account is under deletion, even before its own row is marked", async () => {
    db.accountDeletingAt = "2026-03-01T00:00:00.000Z";
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

  it("tears down when the account's deletion started after the claim", async () => {
    db.betweenClaimAndConfirm = () => {
      db.accountDeletingAt = "2026-03-01T00:00:00.000Z";
    };
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toBeInstanceOf(
      AppOriginRefusedError
    );
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledTimes(2);
  });

  it("leaves the Worker up (claim on record) when the confirm read fails", async () => {
    db.confirmError = { message: "connection reset" };
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toThrow(
      /app origin confirm failed/
    );
    expect(cloudflare.deleteDispatchScript).not.toHaveBeenCalled();
    expect(db.apps[0]!.app_origin_deployed_at).not.toBeNull();
  });

  it("does not tear down a slug that a new app row owns by the time the stale confirm runs", async () => {
    // Old account deleted and its username re-registered; the new owner
    // recreated `alice-notes` and deployed it before this writer confirmed.
    db.betweenClaimAndConfirm = () => {
      db.apps = [
        {
          id: "app-2",
          slug: "alice-notes",
          deleting_at: null,
          app_origin_deployed_at: "2026-03-02T00:00:00.000Z",
        },
      ];
    };
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toBeInstanceOf(
      AppOriginRefusedError
    );
    expect(cloudflare.deleteDispatchScript).not.toHaveBeenCalled();
    expect(manifest.deleteManifest).not.toHaveBeenCalled();
    expect(db.apps[0]!.app_origin_deployed_at).toBe("2026-03-02T00:00:00.000Z");
  });

  it("still tears down when the row is gone and nobody else holds the slug", async () => {
    db.betweenClaimAndConfirm = () => {
      db.apps = [];
    };
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toBeInstanceOf(
      AppOriginRefusedError
    );
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledTimes(2);
  });

  it("leaves the Worker standing when the slug-owner check cannot be read", async () => {
    db.betweenClaimAndConfirm = () => {
      db.apps[0]!.deleting_at = "2026-03-01T00:00:00.000Z";
    };
    db.readError = { message: "connection reset" };
    await expect(deployStaticVersion(fakeSupabase(), input)).rejects.toThrow(
      /app origin owner check failed/
    );
    expect(cloudflare.deleteDispatchScript).not.toHaveBeenCalled();
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

  it("tears the replaced live Worker down when deletion began after it was confirmed", async () => {
    // Claims: 1 deploy claim, 2 deploy confirm, 3 manifest claim. The account
    // marker is set and the deleter may abort before its own teardown, so the
    // attempted release must not stay serving.
    db.beforeClaim = {
      n: 3,
      run: () => {
        db.accountDeletingAt = "2026-03-01T00:00:00.000Z";
      },
    };
    await expect(
      promoteVersion(fakeSupabase(), app, "v1700000000001")
    ).rejects.toBeInstanceOf(AppOriginRefusedError);
    expect(cloudflare.putDispatchScript).toHaveBeenCalledTimes(1);
    expect(manifest.writeManifest).not.toHaveBeenCalled();
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledWith("alice-notes");
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledWith("alice-notes-draft");
    expect(manifest.deleteManifest).toHaveBeenCalledWith("alice-notes");
  });

  it("puts the previous release back on the live Worker when the manifest write fails", async () => {
    manifest.writeManifest.mockRejectedValueOnce(new Error("kv 502"));
    await expect(promoteVersion(fakeSupabase(), app, "v1700000000001")).rejects.toThrow(
      /kv 502/
    );
    expect(cloudflare.putDispatchScript).toHaveBeenCalledTimes(2);
    expect(cloudflare.putDispatchScript).toHaveBeenLastCalledWith(
      expect.objectContaining({
        script: "alice-notes",
        tags: expect.arrayContaining(["version:v1700000000000"]),
      })
    );
    expect(cloudflare.deleteDispatchScript).not.toHaveBeenCalled();
  });

  it("removes the live Worker when a first publish's manifest write fails", async () => {
    const draft = makeApp({
      id: "app-1",
      slug: "alice-notes",
      owner_user_id: "user-alice",
      status: "draft",
      bundle_version: "v1700000000001",
    });
    manifest.writeManifest.mockRejectedValueOnce(new Error("kv 502"));
    await expect(promoteVersion(fakeSupabase(), draft, "v1700000000001")).rejects.toThrow(
      /kv 502/
    );
    expect(cloudflare.putDispatchScript).toHaveBeenCalledTimes(1);
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledTimes(1);
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledWith("alice-notes");
  });

  it("tears the origin down when deletion began during the manifest write", async () => {
    // Claims: 1 deploy claim, 2 deploy confirm, 3 manifest claim, 4 manifest confirm.
    db.beforeClaim = {
      n: 4,
      run: () => {
        db.accountDeletingAt = "2026-03-01T00:00:00.000Z";
      },
    };
    await expect(
      promoteVersion(fakeSupabase(), app, "v1700000000001")
    ).rejects.toBeInstanceOf(AppOriginRefusedError);
    expect(manifest.writeManifest).toHaveBeenCalledTimes(1);
    expect(manifest.deleteManifest).toHaveBeenCalledWith("alice-notes");
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledWith("alice-notes");
    expect(cloudflare.deleteDispatchScript).toHaveBeenCalledWith("alice-notes-draft");
  });
});

describe("syncManifest — manifest writes follow the same protocol", () => {
  it("refuses without writing when the account is under deletion", async () => {
    db.accountDeletingAt = "2026-03-01T00:00:00.000Z";
    await expect(syncManifest(fakeSupabase(), app)).rejects.toBeInstanceOf(
      AppOriginRefusedError
    );
    expect(manifest.writeManifest).not.toHaveBeenCalled();
  });

  it("removes the manifest it just wrote when deletion began underneath it", async () => {
    db.betweenClaimAndConfirm = () => {
      db.apps[0]!.deleting_at = "2026-03-01T00:00:00.000Z";
    };
    await expect(syncManifest(fakeSupabase(), app)).rejects.toBeInstanceOf(
      AppOriginRefusedError
    );
    expect(manifest.writeManifest).toHaveBeenCalledTimes(1);
    expect(manifest.deleteManifest).toHaveBeenCalledWith("alice-notes");
  });

  it("writes and marks the app when nothing is being deleted", async () => {
    await expect(syncManifest(fakeSupabase(), app)).resolves.toBe(true);
    expect(manifest.writeManifest).toHaveBeenCalledTimes(1);
    expect(db.apps[0]!.app_origin_deployed_at).not.toBeNull();
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

  it("matches a live script for an app whose slug itself ends in -draft", async () => {
    db.apps = [
      { id: "app-3", slug: "dave-draft", deleting_at: null, app_origin_deployed_at: null },
    ];
    cloudflare.listDispatchScripts.mockResolvedValue(["dave-draft"]);
    const result = await reconcileAppOriginMarks(fakeSupabase());
    expect(result).toEqual({ marked: 1, unmatched: [] });
    expect(db.apps[0]!.app_origin_deployed_at).not.toBeNull();
  });

  it("marks both apps a -draft script can belong to", async () => {
    db.apps = [
      { id: "app-3", slug: "dave-draft", deleting_at: null, app_origin_deployed_at: null },
      { id: "app-4", slug: "dave", deleting_at: null, app_origin_deployed_at: null },
    ];
    cloudflare.listDispatchScripts.mockResolvedValue(["dave-draft"]);
    const result = await reconcileAppOriginMarks(fakeSupabase());
    expect(result).toEqual({ marked: 2, unmatched: [] });
    expect(db.apps.every((row) => row.app_origin_deployed_at !== null)).toBe(true);
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

describe("reconcileAppOrigins — the registry is the source of truth for the origin", () => {
  const NOW = new Date("2026-03-01T12:00:00.000Z");
  const OLD = new Date(NOW.getTime() - 2 * ORIGIN_DRIFT_GRACE_MS).toISOString();
  const FRESH = new Date(NOW.getTime() - ORIGIN_DRIFT_GRACE_MS / 2).toISOString();

  function registryRow(overrides: Partial<RegistryApp> = {}): AppRow {
    return {
      ...makeApp({
        id: "app-1",
        slug: "alice-notes",
        owner_user_id: "user-alice",
        publisher_username: "alice",
        status: "published",
        bundle_version: "v1700000000001",
        draft_version: "v1700000000001",
        updated_at: OLD,
        ...overrides,
      }),
      deleting_at: null,
      app_origin_deployed_at: "2026-01-01T00:00:00.000Z",
    };
  }

  const servedManifest = (
    over: Partial<{
      slug: string;
      live: string | null;
      draft: string | null;
      status: string;
      updated_at: string;
    }>
  ) => ({
    slug: "alice-notes",
    status: "published",
    live: "v1700000000001",
    draft: "v1700000000001",
    owner_ref: "alice",
    functions: false,
    updated_at: OLD,
    ...over,
  });

  beforeEach(() => {
    db.apps = [registryRow()];
  });

  it("a stale draft Worker left by a lost upload race is put back on the registry's draft", async () => {
    // The loser's manifest (naming its own version) landed last; the registry says v...001.
    manifest.readManifest.mockResolvedValue(servedManifest({ draft: "v1700000000009" }));
    const result = await reconcileAppOrigins(fakeSupabase(), NOW);
    expect(result).toEqual({ repaired: 1 });
    expect(r2.listKeys).toHaveBeenCalledWith("apps/alice-notes/v1700000000001/", 1000);
    expect(cloudflare.putDispatchScript).toHaveBeenCalledTimes(1);
    expect(cloudflare.putDispatchScript).toHaveBeenCalledWith(
      expect.objectContaining({ script: "alice-notes-draft" })
    );
    expect(manifest.writeManifest).toHaveBeenLastCalledWith(
      expect.objectContaining({ live: "v1700000000001", draft: "v1700000000001" })
    );
  });

  it("a live Worker the registry does not name is re-promoted from the registry's live version", async () => {
    manifest.readManifest.mockResolvedValue(
      servedManifest({ live: "v1700000000009", draft: "v1700000000009" })
    );
    const result = await reconcileAppOrigins(fakeSupabase(), NOW);
    expect(result).toEqual({ repaired: 1 });
    const scripts = cloudflare.putDispatchScript.mock.calls.map((c) => c[0].script);
    expect(scripts).toEqual(["alice-notes", "alice-notes-draft"]);
    expect(manifest.writeManifest).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "published", live: "v1700000000001", draft: "v1700000000001" })
    );
  });

  it("leaves a manifest that agrees with the registry alone", async () => {
    manifest.readManifest.mockResolvedValue(servedManifest({}));
    await expect(reconcileAppOrigins(fakeSupabase(), NOW)).resolves.toEqual({ repaired: 0 });
    expect(cloudflare.putDispatchScript).not.toHaveBeenCalled();
    expect(manifest.writeManifest).not.toHaveBeenCalled();
  });

  it("does not touch an upload still in flight (manifest or registry younger than the grace window)", async () => {
    manifest.readManifest.mockResolvedValue(
      servedManifest({ draft: "v1700000000009", updated_at: FRESH })
    );
    await expect(reconcileAppOrigins(fakeSupabase(), NOW)).resolves.toEqual({ repaired: 0 });

    db.apps = [registryRow({ updated_at: FRESH })];
    manifest.readManifest.mockResolvedValue(servedManifest({ draft: "v1700000000009" }));
    await expect(reconcileAppOrigins(fakeSupabase(), NOW)).resolves.toEqual({ repaired: 0 });
    expect(cloudflare.putDispatchScript).not.toHaveBeenCalled();
    expect(manifest.writeManifest).not.toHaveBeenCalled();
  });

  it("skips apps with no served manifest (never deployed, or torn down by deletion)", async () => {
    manifest.readManifest.mockResolvedValue(null);
    await expect(reconcileAppOrigins(fakeSupabase(), NOW)).resolves.toEqual({ repaired: 0 });
    expect(cloudflare.putDispatchScript).not.toHaveBeenCalled();
  });

  it("an app under deletion is left to the deleter, and one failure does not stop the sweep", async () => {
    db.apps = [
      { ...registryRow(), deleting_at: "2026-02-01T00:00:00.000Z" },
      registryRow({ id: "app-2", slug: "alice-todo", bundle_version: null, status: "draft" }),
    ];
    manifest.readManifest.mockImplementation(async (slug: string) =>
      slug === "alice-notes"
        ? servedManifest({ draft: "v1700000000009" })
        : { ...servedManifest({ draft: "v1700000000009", live: null, status: "draft" }), slug }
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await reconcileAppOrigins(fakeSupabase(), NOW);
    errors.mockRestore();
    expect(result).toEqual({ repaired: 1 });
    const scripts = cloudflare.putDispatchScript.mock.calls.map((c) => c[0].script);
    expect(scripts).toEqual(["alice-todo-draft"]);
  });

  it("is a no-op on the legacy lane", async () => {
    tokens.appOriginConfigured.mockReturnValue(false);
    await expect(reconcileAppOrigins(fakeSupabase(), NOW)).resolves.toEqual({ repaired: 0 });
    expect(manifest.readManifest).not.toHaveBeenCalled();
  });

  it("visits every marked app across pages, not only the first response", async () => {
    db.apps = Array.from({ length: 401 }, (_, i) =>
      registryRow({ id: `app-${String(i).padStart(4, "0")}`, slug: `alice-a${i}` })
    );
    manifest.readManifest.mockImplementation(async (slug: string) =>
      slug === "alice-a400" ? servedManifest({ slug, draft: "v1700000000009" }) : null
    );
    const result = await reconcileAppOrigins(fakeSupabase(), NOW);
    expect(result).toEqual({ repaired: 1 });
    expect(db.pages).toBe(3);
    expect(manifest.readManifest).toHaveBeenCalledTimes(401);
    expect(cloudflare.putDispatchScript).toHaveBeenCalledWith(
      expect.objectContaining({ script: "alice-a400-draft" })
    );
  });

  it("a repair is fenced: updated_at is touched only if no pointer commit landed meanwhile", async () => {
    manifest.readManifest.mockResolvedValue(servedManifest({ draft: "v1700000000009" }));
    await expect(reconcileAppOrigins(fakeSupabase(), NOW)).resolves.toEqual({ repaired: 1 });
    expect(db.apps[0]!.updated_at).not.toBe(OLD);
    expect(db.apps[0]!.draft_version).toBe("v1700000000001");
  });

  it("an upload that committed while the repair was writing is put back on top, not written over", async () => {
    manifest.readManifest.mockResolvedValue(servedManifest({ draft: "v1700000000009" }));
    // Between the repair's draft-Worker write and its fence, an upload commits v...002
    // (its own Worker landed before ours, so ours — v...001 — is what the origin serves).
    cloudflare.putDispatchScript.mockImplementationOnce(async () => {
      db.apps[0]!.draft_version = "v1700000000002";
      db.apps[0]!.updated_at = "2026-03-01T11:59:59.000Z";
      return { digest: "d".repeat(64) };
    });
    const result = await reconcileAppOrigins(fakeSupabase(), NOW);
    expect(result).toEqual({ repaired: 1 });
    const scripts = cloudflare.putDispatchScript.mock.calls.map((c) => c[0].script);
    expect(scripts).toEqual(["alice-notes-draft", "alice-notes", "alice-notes-draft"]);
    expect(r2.listKeys).toHaveBeenLastCalledWith("apps/alice-notes/v1700000000002/", 1000);
    expect(manifest.writeManifest).toHaveBeenLastCalledWith(
      expect.objectContaining({ live: "v1700000000001", draft: "v1700000000002" })
    );
    expect(db.apps[0]!.draft_version).toBe("v1700000000002");
    expect(db.apps[0]!.updated_at).not.toBe("2026-03-01T11:59:59.000Z");
  });

  it("gives up fencing after bounded attempts and leaves the app to the next sweep", async () => {
    manifest.readManifest.mockResolvedValue(servedManifest({ draft: "v1700000000009" }));
    let commits = 0;
    cloudflare.putDispatchScript.mockImplementation(async () => {
      commits += 1;
      db.apps[0]!.updated_at = `2026-03-01T11:59:${String(commits).padStart(2, "0")}.000Z`;
      return { digest: "d".repeat(64) };
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await reconcileAppOrigins(fakeSupabase(), NOW);
    const logged = errors.mock.calls.map((c) => String(c[0]));
    errors.mockRestore();
    expect(result).toEqual({ repaired: 1 });
    expect(logged).toEqual(expect.arrayContaining([expect.stringContaining("unfenced")]));
    expect(manifest.writeManifest.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
