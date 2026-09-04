import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const deploy = vi.hoisted(() => ({
  AppOriginRefusedError: class AppOriginRefusedError extends Error {
    constructor(slug: string) {
      super(`app ${slug} is being deleted`);
      this.name = "AppOriginRefusedError";
    }
  },
  deployStaticVersion: vi.fn<
    (
      supabase: unknown,
      input: { target: string; version: string }
    ) => Promise<{ workerSha256: string } | null>
  >(async () => null),
  loadBundleFiles: vi.fn(async () => [{ path: "index.html", data: Buffer.from("<h1>winner</h1>") }]),
  promoteVersion: vi.fn(async () => undefined),
  syncManifest: vi.fn(async () => undefined),
}));
vi.mock("../functions/deploy", () => deploy);

const r2 = vi.hoisted(() => ({
  deletePrefix: vi.fn(async () => 0),
  r2Configured: vi.fn(() => true),
  putObject: vi.fn(async () => undefined),
}));
vi.mock("../storage/r2", () => r2);

const bundles = vi.hoisted(() => ({ storeBundle: vi.fn(async () => undefined) }));
vi.mock("../miniapps/bundles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../miniapps/bundles")>()),
  storeBundle: bundles.storeBundle,
}));

const limits = vi.hoisted(() => ({
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("../security/limits", () => limits);

import {
  RETAIN_DRAFTS,
  RETAIN_SUPERSEDED_DAYS,
  SWEEP_PAGE,
  VERSION_RE,
  VersionError,
  bundleDigest,
  getVersion,
  newVersionId,
  parseVersionRow,
  pointLiveAt,
  recordVersion,
  rollbackTo,
  sweepVersions,
  uploadVersion,
} from "./versions";
import { makeApp } from "@/app/mini/loader-test-utils";

/* ------------------------------------------------------------ fake db */

interface VersionRowLike {
  id: string;
  app_id: string;
  user_id: string;
  version: string;
  lane: string;
  bundle_sha256: string;
  bundle_bytes: number;
  file_count: number;
  worker_sha256: string | null;
  kit_version: string | null;
  findings: unknown[];
  qa_score: number | null;
  created_at: string;
  published_at: string | null;
  retired_at: string | null;
  purged_at: string | null;
}

/** A full mini_apps row: REGISTRY_COLUMNS re-reads must parse. */
type AppRowLike = ReturnType<typeof makeApp> & { app_origin_deployed_at: string | null };

const db = {
  versions: [] as VersionRowLike[],
  apps: [] as AppRowLike[],
  /** Make the next matching op fail, e.g. { table: "miniapp_versions", op: "delete" };
   * `persist` keeps failing until cleared. */
  fail: null as FakeFailure | FakeFailure[] | null,
  /** Runs once, just before the next rpc: stands in for a concurrent commit. */
  beforeRpc: null as (() => void) | null,
};

type FakeOp = "insert" | "update" | "delete" | "rpc" | "select";
interface FakeFailure {
  table: string;
  op: FakeOp;
  persist?: boolean;
}

let seq = 0;

function failing(table: string, op: FakeOp) {
  const failures = Array.isArray(db.fail) ? db.fail : db.fail ? [db.fail] : [];
  const hit = failures.find((f) => f.table === table && f.op === op);
  if (!hit) return null;
  if (!hit.persist) {
    const rest = failures.filter((f) => f !== hit);
    db.fail = rest.length === 0 ? null : rest;
  }
  return { data: null, error: { message: `${op} on ${table} refused` } };
}

type Filter = (row: Record<string, unknown>) => boolean;

function query(table: "miniapp_versions" | "mini_apps") {
  const filters: Filter[] = [];
  let pendingUpdate: Record<string, unknown> | null = null;
  let pendingDelete = false;
  let pendingInsert: Record<string, unknown> | null = null;
  let ordered: { column: string; ascending: boolean } | null = null;
  let max = Infinity;

  const rows = (): Record<string, unknown>[] =>
    (db[table === "mini_apps" ? "apps" : "versions"] as unknown as Record<
      string,
      unknown
    >[]).filter((row) => filters.every((f) => f(row)));

  const withJoin = (row: Record<string, unknown>) => {
    if (table !== "miniapp_versions") return row;
    const app = db.apps.find((a) => a.id === row["app_id"]);
    return {
      ...row,
      mini_apps: app
        ? {
            slug: app.slug,
            bundle_version: app.bundle_version,
            draft_version: app.draft_version,
          }
        : null,
    };
  };

  const execute = () => {
    if (pendingInsert) {
      const refused = failing(table, "insert");
      if (refused) return refused;
      const row = {
        id: `ver-${++seq}`,
        created_at: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
        worker_sha256: null,
        kit_version: null,
        findings: [],
        qa_score: null,
        published_at: null,
        retired_at: null,
        purged_at: null,
        ...pendingInsert,
      } as unknown as VersionRowLike;
      if (
        db.versions.some(
          (v) => v.app_id === row.app_id && v.version === row.version
        )
      ) {
        return {
          data: null,
          error: { code: "23505", message: "duplicate key (app_id, version)" },
        };
      }
      db.versions.push(row);
      return { data: row, error: null };
    }
    const matched = rows();
    if (pendingUpdate) {
      const refused = failing(table, "update");
      if (refused) return refused;
      for (const row of matched) Object.assign(row, pendingUpdate);
      return { data: matched, error: null };
    }
    if (pendingDelete) {
      const refused = failing(table, "delete");
      if (refused) return refused;
      const ids = new Set(matched.map((r) => r["id"]));
      if (table === "miniapp_versions") {
        db.versions = db.versions.filter((v) => !ids.has(v.id));
      } else {
        db.apps = db.apps.filter((a) => !ids.has(a.id));
      }
      return { data: null, error: null };
    }
    const refusedRead = failing(table, "select");
    if (refusedRead) return refusedRead;
    let out = matched.map(withJoin);
    if (ordered) {
      const { column, ascending } = ordered;
      out = [...out].sort((a, b) => {
        const av = String(a[column]);
        const bv = String(b[column]);
        return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return { data: out.slice(0, max), error: null };
  };

  const builder = {
    select: () => builder,
    insert: (values: Record<string, unknown>) => {
      pendingInsert = values;
      return builder;
    },
    update: (values: Record<string, unknown>) => {
      pendingUpdate = values;
      return builder;
    },
    delete: () => {
      pendingDelete = true;
      return builder;
    },
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    },
    is: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    },
    lt: (column: string, value: string) => {
      filters.push((row) => String(row[column]) < value);
      return builder;
    },
    order: (column: string, opts?: { ascending?: boolean }) => {
      ordered = { column, ascending: opts?.ascending ?? true };
      return builder;
    },
    limit: (n: number) => {
      max = n;
      return builder;
    },
    single: () => {
      const result = execute();
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      return Promise.resolve({ data, error: result.error });
    },
    maybeSingle: () => {
      const result = execute();
      const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
      return Promise.resolve({ data, error: result.error });
    },
    then: (
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(execute()).then(resolve, reject),
  };
  return builder;
}

/** Mirrors 0085 + 0090 (point_live fence): one atomic step per call. */
function rpc(fn: string, args: Record<string, unknown>) {
  if (db.beforeRpc) {
    const hook = db.beforeRpc;
    db.beforeRpc = null;
    hook();
  }
  const refused = failing(fn, "rpc");
  if (refused) return Promise.resolve(refused);
  const now = new Date().toISOString();
  if (fn === "miniapp_point_live") {
    const row = db.versions.find(
      (v) => v.app_id === args["p_app_id"] && v.version === args["p_version"] && !v.purged_at
    );
    const app = db.apps.find((a) => a.id === args["p_app_id"]);
    if (!row || !app) return Promise.resolve({ data: null, error: null });
    if ((app.bundle_version ?? null) !== (args["p_expected"] ?? null)) {
      return Promise.resolve({ data: null, error: null });
    }
    if (app.updated_at !== args["p_expected_updated_at"]) {
      return Promise.resolve({ data: null, error: null });
    }
    app.bundle_version = row.version;
    app.updated_at = now;
    row.published_at = now;
    row.retired_at = null;
    const previous = args["p_expected"];
    if (typeof previous === "string" && previous !== row.version) {
      for (const v of db.versions) {
        if (v.app_id === app.id && v.version === previous && !v.retired_at) {
          v.retired_at = now;
        }
      }
    }
    return Promise.resolve({ data: now, error: null });
  }
  if (fn === "miniapp_tombstone_version") {
    const row = db.versions.find((v) => v.id === args["p_id"]);
    if (!row) return Promise.resolve({ data: false, error: null });
    if (row.purged_at) return Promise.resolve({ data: true, error: null });
    const app = db.apps.find((a) => a.id === row.app_id);
    if (app && (app.bundle_version === row.version || app.draft_version === row.version)) {
      return Promise.resolve({ data: false, error: null });
    }
    row.purged_at = now;
    return Promise.resolve({ data: true, error: null });
  }
  return Promise.resolve({ data: null, error: { message: `unknown rpc ${fn}` } });
}

const supabase = {
  from: (table: "miniapp_versions" | "mini_apps") => query(table),
  rpc,
} as unknown as SupabaseClient;

const files = [
  { path: "index.html", bytes: Buffer.from("<h1>hi</h1>") },
  { path: "app.js", bytes: Buffer.from("console.log(1)") },
];

const app = makeApp({
  id: "app-notes",
  slug: "alice-notes",
  owner_user_id: "user-alice",
  publisher_username: "alice",
  status: "published",
  bundle_version: "v1700000000001",
});

beforeEach(() => {
  seq = 0;
  db.versions = [];
  db.fail = null;
  db.beforeRpc = null;
  db.apps = [{ ...app, app_origin_deployed_at: null }];
  deploy.deployStaticVersion.mockReset();
  deploy.deployStaticVersion.mockResolvedValue(null);
  deploy.loadBundleFiles.mockClear();
  deploy.promoteVersion.mockReset();
  deploy.promoteVersion.mockResolvedValue(undefined);
  deploy.syncManifest.mockClear();
  bundles.storeBundle.mockReset();
  bundles.storeBundle.mockResolvedValue(undefined);
  r2.deletePrefix.mockClear();
  r2.r2Configured.mockReturnValue(true);
  limits.recordOpsEvent.mockClear();
});

/** Minimal stored-only zip writer. */
function makeZip(entries: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const localFull = Buffer.concat([local, name, entry.data]);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    locals.push(localFull);
    offset += localFull.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, eocd]);
}

const zip = makeZip([
  { name: "index.html", data: Buffer.from("<!doctype html><h1>hi</h1>") },
  { name: "app.js", data: Buffer.from("console.log(1)") },
]);

/* ------------------------------------------------------------ tests */

describe("bundle digests and version ids", () => {
  it("digest is content-addressed and independent of file order", () => {
    const a = bundleDigest(files);
    const b = bundleDigest([...files].reverse());
    expect(a).toEqual(b);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(a.bytes).toBe(11 + 14);
    expect(a.fileCount).toBe(2);
    const changed = bundleDigest([
      files[0]!,
      { path: "app.js", bytes: Buffer.from("console.log(2)") },
    ]);
    expect(changed.sha256).not.toBe(a.sha256);
  });

  it("version ids are epoch-ms and match the row check", () => {
    expect(newVersionId(1_700_000_000_000)).toBe("v1700000000000");
    expect(VERSION_RE.test(newVersionId())).toBe(true);
    expect(VERSION_RE.test("v1")).toBe(false);
    expect(VERSION_RE.test("latest")).toBe(false);
  });
});

describe("recordVersion (CR14: metadata only)", () => {
  it("stores digest, size, count, lane — never file contents", async () => {
    const row = await recordVersion(supabase, {
      appId: "app-notes",
      userId: "user-alice",
      version: "v1700000000002",
      lane: "drop",
      files,
      findings: [{ file: "index.html", rule: "inline-handler", hint: "move to app.js" }],
    });
    expect(row.bundle_sha256).toBe(bundleDigest(files).sha256);
    expect(row.bundle_bytes).toBe(25);
    expect(row.file_count).toBe(2);
    expect(row.lane).toBe("drop");
    expect(row.worker_sha256).toBeNull();
    expect(row.published_at).toBeNull();
    expect(JSON.stringify(db.versions)).not.toContain("<h1>hi</h1>");
    expect(JSON.stringify(db.versions)).not.toContain("console.log");
  });

  it("(app_id, version) is unique — a version is never overwritten", async () => {
    const input = {
      appId: "app-notes",
      userId: "user-alice",
      version: "v1700000000002",
      lane: "push" as const,
      files,
    };
    await recordVersion(supabase, input);
    await expect(recordVersion(supabase, input)).rejects.toMatchObject({ status: 409 });
  });

  it("parseVersionRow rejects malformed rows", () => {
    expect(parseVersionRow({ id: "x" })).toBeNull();
    expect(
      parseVersionRow({
        id: "ver-1",
        app_id: "app-notes",
        user_id: "user-alice",
        version: "v1700000000002",
        lane: "drop",
        bundle_sha256: "not-a-digest",
        bundle_bytes: 1,
        file_count: 1,
        worker_sha256: null,
        kit_version: null,
        findings: [],
        qa_score: null,
        created_at: "2026-01-01T00:00:00.000Z",
        published_at: null,
        retired_at: null,
      })
    ).toBeNull();
  });

  it("reports a same-millisecond collision as a retryable 409", async () => {
    const input = {
      appId: "app-notes", userId: "user-alice", version: "v1700000000002", lane: "push" as const, files,
    };
    await recordVersion(supabase, input);
    await expect(recordVersion(supabase, input)).rejects.toMatchObject({ status: 409 });
  });
});

describe("uploadVersion", () => {
  it("reserves the ledger row before touching R2, so a collision never shares a prefix", async () => {
    db.versions.push({
      id: "ver-live", app_id: "app-notes", user_id: "user-alice",
      version: newVersionId(), lane: "push", bundle_sha256: "0".repeat(64),
      bundle_bytes: 1, file_count: 1, worker_sha256: null, kit_version: null,
      findings: [], qa_score: null, created_at: "2026-01-01T00:00:00.000Z",
      published_at: null, retired_at: null, purged_at: null,
    });
    // Freeze the clock so the next id collides with the row above.
    const spy = vi.spyOn(Date, "now").mockReturnValue(Number(db.versions[0]!.version.slice(1)));
    try {
      await expect(uploadVersion(supabase, app, zip)).rejects.toMatchObject({ status: 409 });
    } finally {
      spy.mockRestore();
    }
    expect(bundles.storeBundle).not.toHaveBeenCalled();
    expect(db.versions).toHaveLength(1);
  });

  it("legacy lane: a published upload is stamped published and retires its predecessor", async () => {
    db.versions.push({
      id: "ver-prev", app_id: "app-notes", user_id: "user-alice",
      version: "v1700000000001", lane: "push", bundle_sha256: "0".repeat(64),
      bundle_bytes: 1, file_count: 1, worker_sha256: null, kit_version: null,
      findings: [], qa_score: null, created_at: "2026-01-01T00:00:00.000Z",
      published_at: "2026-01-01T00:00:00.000Z", retired_at: null, purged_at: null,
    });
    const version = await uploadVersion(supabase, app, zip);
    const row = db.versions.find((v) => v.version === version)!;
    expect(row.published_at).not.toBeNull();
    expect(db.versions[0]!.retired_at).not.toBeNull();
    expect(db.apps[0]!.bundle_version).toBe(version);
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
    expect(deploy.syncManifest).toHaveBeenCalled();
  });

  it("a failed promotion leaves the registry, ledger and R2 on the previous release", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    deploy.promoteVersion.mockRejectedValue(new Error("vendor 502"));
    await expect(uploadVersion(supabase, app, zip)).rejects.toThrow(/vendor 502/);
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
    expect(db.versions).toHaveLength(0);
    expect(r2.deletePrefix).toHaveBeenCalledWith(expect.stringContaining("alice-notes/v"));
  });

  it("a failed registry move after promotion puts the Worker back on the previous release and discards the version", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    db.fail = { table: "mini_apps", op: "update" };
    await expect(uploadVersion(supabase, app, zip)).rejects.toThrow(/bundle version update failed/);
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(2);
    expect(deploy.promoteVersion).toHaveBeenLastCalledWith(supabase, app, "v1700000000001");
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
    expect(db.versions).toHaveLength(0);
    expect(r2.deletePrefix).toHaveBeenCalledWith(expect.stringContaining("alice-notes/v"));
  });

  it("a discard whose row delete fails leaves a tombstone, never a selectable row", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    deploy.promoteVersion.mockRejectedValue(new Error("vendor 502"));
    db.fail = { table: "miniapp_versions", op: "delete" };
    await expect(uploadVersion(supabase, app, zip)).rejects.toThrow(/vendor 502/);
    expect(db.versions).toHaveLength(1);
    expect(db.versions[0]!.purged_at).not.toBeNull();
    expect(r2.deletePrefix).toHaveBeenCalledTimes(1);
  });

  it("a discard whose R2 delete fails leaves a tombstone the next sweep finishes", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    deploy.promoteVersion.mockRejectedValue(new Error("vendor 502"));
    r2.deletePrefix.mockRejectedValueOnce(new Error("r2 down"));
    await expect(uploadVersion(supabase, app, zip)).rejects.toThrow(/vendor 502/);
    expect(db.versions).toHaveLength(1);
    const left = db.versions[0]!;
    expect(left.purged_at).not.toBeNull();
    expect(r2.deletePrefix).toHaveBeenCalledTimes(1);

    await expect(getVersion(supabase, app.id, left.version)).resolves.toBeNull();
    expect(await sweepVersions(supabase)).toBe(1);
    expect(db.versions).toHaveLength(0);
    expect(r2.deletePrefix).toHaveBeenCalledTimes(2);
    expect(r2.deletePrefix).toHaveBeenLastCalledWith(`apps/alice-notes/${left.version}/`);
  });

  it("the deploy claims the app row through the same client that owns the ledger", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    await uploadVersion(supabase, app, zip);
    expect(deploy.deployStaticVersion).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ appId: app.id, slug: app.slug, target: "draft" })
    );
  });

  it("an app under deletion refuses the upload as 409 and discards the row (CR16)", async () => {
    deploy.deployStaticVersion.mockRejectedValue(
      new deploy.AppOriginRefusedError(app.slug)
    );
    await expect(uploadVersion(supabase, app, zip)).rejects.toMatchObject({
      status: 409,
      message: /being deleted/,
    });
    expect(db.versions).toHaveLength(0);
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
    expect(db.apps[0]!.draft_version).toBeNull();
  });

  it("a lost worker digest write fails the upload and discards the version", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    db.fail = { table: "miniapp_versions", op: "update" };
    await expect(uploadVersion(supabase, app, zip)).rejects.toThrow(/worker digest write failed/);
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
    expect(db.versions).toHaveLength(0);
    expect(r2.deletePrefix).toHaveBeenCalledWith(expect.stringContaining("alice-notes/v"));
  });

  it("a concurrent upload that moved the pointer first wins; the loser re-promotes it and discards itself", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    deploy.promoteVersion.mockImplementationOnce(async () => {
      // The other upload commits between our read of `app` and our CAS.
      db.apps[0]!.bundle_version = "v1700000000009";
      db.apps[0]!.draft_version = "v1700000000009";
    });
    await expect(uploadVersion(supabase, app, zip)).rejects.toMatchObject({ status: 409 });
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(2);
    // The restore runs on the row as re-read, not on the `app` this call observed.
    expect(deploy.promoteVersion).toHaveBeenLastCalledWith(
      supabase,
      expect.objectContaining({ id: "app-notes", bundle_version: "v1700000000009" }),
      "v1700000000009"
    );
    expect(db.apps[0]!.bundle_version).toBe("v1700000000009");
    expect(db.versions).toHaveLength(0);
    expect(r2.deletePrefix).toHaveBeenCalledWith(expect.stringContaining("alice-notes/v"));
  });

  it("stage-only: a lost CAS restores from the current row, so a concurrent delist is not re-published at the manifest", async () => {
    const staged = { ...app, status: "published" as const, draft_version: "v1700000000001" };
    db.apps[0]!.draft_version = "v1700000000001";
    deploy.deployStaticVersion.mockImplementation(async () => {
      // The owner delisted between our read of `app` and our CAS.
      db.apps[0]!.status = "draft";
      db.apps[0]!.visibility = "private";
      db.apps[0]!.updated_at = "2026-01-01T00:05:00.000Z";
      return { workerSha256: "a".repeat(64) };
    });
    await expect(
      uploadVersion(supabase, staged, zip, "drop", { promote: false })
    ).rejects.toMatchObject({ status: 409 });
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: "draft",
        visibility: "private",
        bundle_version: "v1700000000001",
        draft_version: "v1700000000001",
      })
    );
    expect(deploy.syncManifest).not.toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "published" })
    );
    expect(db.versions).toHaveLength(0);
  });

  it("live: a lost CAS to a concurrent publish restores that publish's status and pointer, not the stale start", async () => {
    const draft = { ...app, status: "draft" as const, bundle_version: null, draft_version: null };
    db.apps[0]!.status = "draft";
    db.apps[0]!.bundle_version = null;
    deploy.deployStaticVersion.mockImplementation(async () => {
      // Another upload landed and the owner published it before our CAS.
      db.apps[0]!.status = "published";
      db.apps[0]!.bundle_version = "v1700000000009";
      db.apps[0]!.draft_version = "v1700000000009";
      db.apps[0]!.updated_at = "2026-01-01T00:05:00.000Z";
      return { workerSha256: "a".repeat(64) };
    });
    await expect(uploadVersion(supabase, draft, zip)).rejects.toMatchObject({ status: 409 });
    // The live Worker was never ours to move; the shared draft Worker goes
    // back on the winner's draft, and the manifest carries the publish.
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
    expect(deploy.deployStaticVersion).toHaveBeenLastCalledWith(
      supabase,
      expect.objectContaining({ target: "draft", version: "v1700000000009" })
    );
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "published", bundle_version: "v1700000000009" })
    );
    expect(deploy.syncManifest).not.toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "draft" })
    );
  });

  it("stage-only: two concurrent staged uploads agree on one draft; the loser puts the shared draft Worker back on the winner", async () => {
    const staged = { ...app, status: "published" as const, draft_version: "v1700000000001" };
    db.apps[0]!.draft_version = "v1700000000001";
    const deploys: string[] = [];
    deploy.deployStaticVersion.mockImplementation(async (_supabase, input) => {
      deploys.push(`${input.target}:${input.version}`);
      // The other staged upload commits after our deploy but before our CAS.
      if (deploys.length === 1) db.apps[0]!.draft_version = "v1700000000009";
      return { workerSha256: "a".repeat(64) };
    });
    await expect(
      uploadVersion(supabase, staged, zip, "drop", { promote: false })
    ).rejects.toMatchObject({ status: 409 });
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
    expect(deploy.loadBundleFiles).toHaveBeenCalledWith("alice-notes", "v1700000000009");
    expect(deploys).toHaveLength(2);
    expect(deploys[1]).toBe("draft:v1700000000009");
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
    expect(db.apps[0]!.draft_version).toBe("v1700000000009");
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ bundle_version: "v1700000000001", draft_version: "v1700000000009" })
    );
    expect(db.versions).toHaveLength(0);
  });

  it("stage-only: an origin repair that touched the row mid-upload makes the swap lose; the origin is put back on the registry", async () => {
    const staged = { ...app, status: "published" as const, draft_version: "v1700000000001" };
    db.apps[0]!.draft_version = "v1700000000001";
    deploy.deployStaticVersion.mockImplementation(async () => {
      // The cron reconciler fenced a repair (same pointers, newer updated_at)
      // between our read of `app` and our CAS — our draft Worker may be under it.
      db.apps[0]!.updated_at = "2026-01-01T00:05:00.000Z";
      return { workerSha256: "a".repeat(64) };
    });
    await expect(
      uploadVersion(supabase, staged, zip, "drop", { promote: false })
    ).rejects.toMatchObject({ status: 409 });
    expect(deploy.deployStaticVersion).toHaveBeenLastCalledWith(
      supabase,
      expect.objectContaining({ target: "draft", version: "v1700000000001" })
    );
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ bundle_version: "v1700000000001", draft_version: "v1700000000001" })
    );
    expect(db.apps[0]!.draft_version).toBe("v1700000000001");
    expect(db.versions).toHaveLength(0);
  });

  it("stage-only: a lost CAS whose pointer re-read fails once retries and restores the winner, not the stale start", async () => {
    const staged = { ...app, status: "published" as const, draft_version: "v1700000000001" };
    db.apps[0]!.draft_version = "v1700000000001";
    deploy.deployStaticVersion.mockImplementation(async () => {
      if (db.apps[0]!.draft_version === "v1700000000001") {
        db.apps[0]!.draft_version = "v1700000000009";
        db.fail = { table: "mini_apps", op: "select" };
      }
      return { workerSha256: "a".repeat(64) };
    });
    await expect(
      uploadVersion(supabase, staged, zip, "drop", { promote: false })
    ).rejects.toMatchObject({ status: 409 });
    expect(deploy.deployStaticVersion).toHaveBeenLastCalledWith(
      supabase,
      expect.objectContaining({ target: "draft", version: "v1700000000009" })
    );
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ bundle_version: "v1700000000001", draft_version: "v1700000000009" })
    );
    expect(deploy.syncManifest).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ draft_version: "v1700000000001" })
    );
    expect(db.versions).toHaveLength(0);
  });

  it("a CAS that errors while the registry is unreadable never restores the start pointers (another upload may have won)", async () => {
    const staged = { ...app, status: "published" as const, draft_version: "v1700000000001" };
    db.apps[0]!.draft_version = "v1700000000001";
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    deploy.deployStaticVersion.mockImplementation(async () => {
      if (db.apps[0]!.draft_version === "v1700000000001") {
        db.apps[0]!.draft_version = "v1700000000009";
        db.fail = [
          { table: "mini_apps", op: "update" },
          { table: "mini_apps", op: "select", persist: true },
        ];
      }
      return { workerSha256: "a".repeat(64) };
    });
    await expect(
      uploadVersion(supabase, staged, zip, "drop", { promote: false })
    ).rejects.toThrow(/bundle version update failed/);
    db.fail = null;
    // No redeploy of v...001 (the observed start) and no manifest naming it.
    expect(deploy.deployStaticVersion).toHaveBeenCalledTimes(1);
    expect(deploy.syncManifest).toHaveBeenCalledTimes(1);
    expect(deploy.syncManifest).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ draft_version: "v1700000000001" })
    );
    expect(errors.mock.calls.map((c) => String(c[0]))).toEqual(
      expect.arrayContaining([expect.stringContaining("left to reconcile")])
    );
    expect(db.apps[0]!.draft_version).toBe("v1700000000009");
    errors.mockRestore();
  });

  it("stage-only: a lost CAS whose pointer re-read keeps failing leaves the origin alone rather than writing stale or empty pointers", async () => {
    const staged = { ...app, status: "published" as const, draft_version: "v1700000000001" };
    db.apps[0]!.draft_version = "v1700000000001";
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    deploy.deployStaticVersion.mockImplementation(async () => {
      if (db.apps[0]!.draft_version === "v1700000000001") {
        db.apps[0]!.draft_version = "v1700000000009";
        db.fail = { table: "mini_apps", op: "select", persist: true };
      }
      return { workerSha256: "a".repeat(64) };
    });
    await expect(
      uploadVersion(supabase, staged, zip, "drop", { promote: false })
    ).rejects.toMatchObject({ status: 409 });
    db.fail = null;
    // Only our own deploy and manifest write happened; nothing was "restored".
    expect(deploy.deployStaticVersion).toHaveBeenCalledTimes(1);
    expect(deploy.syncManifest).toHaveBeenCalledTimes(1);
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
    expect(errors.mock.calls.map((c) => String(c[0]))).toEqual(
      expect.arrayContaining([expect.stringContaining("registry pointers unreadable")])
    );
    expect(db.apps[0]!.draft_version).toBe("v1700000000009");
    expect(db.versions).toHaveLength(0);
    errors.mockRestore();
  });

  it("live: a lost CAS whose pointer re-read keeps failing does not promote the stale release back", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    deploy.deployStaticVersion.mockImplementation(async () => {
      if (db.apps[0]!.bundle_version === "v1700000000001") {
        db.apps[0]!.bundle_version = "v1700000000009";
        db.apps[0]!.draft_version = "v1700000000009";
        db.fail = { table: "mini_apps", op: "select", persist: true };
      }
      return { workerSha256: "a".repeat(64) };
    });
    await expect(uploadVersion(supabase, app, zip)).rejects.toMatchObject({ status: 409 });
    db.fail = null;
    // promoteVersion ran once, for our own version; never again for the stale one.
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(1);
    expect(deploy.promoteVersion).not.toHaveBeenCalledWith(supabase, app, "v1700000000001");
    expect(deploy.syncManifest).toHaveBeenCalledTimes(1);
    expect(db.apps[0]!.bundle_version).toBe("v1700000000009");
    expect(db.versions).toHaveLength(0);
    errors.mockRestore();
  });

  it("the manifest is written before the registry commits; a lost write fails cleanly and restores the draft Worker", async () => {
    const staged = { ...app, status: "published" as const, draft_version: "v1700000000001" };
    db.apps[0]!.draft_version = "v1700000000001";
    const deploys: string[] = [];
    deploy.deployStaticVersion.mockImplementation(async (_supabase, input) => {
      deploys.push(`${input.target}:${input.version}`);
      return { workerSha256: "a".repeat(64) };
    });
    deploy.syncManifest.mockRejectedValueOnce(new Error("kv unavailable"));
    await expect(
      uploadVersion(supabase, staged, zip, "drop", { promote: false })
    ).rejects.toThrow(/kv unavailable/);
    expect(deploys).toHaveLength(2);
    expect(deploys[1]).toBe("draft:v1700000000001");
    expect(deploy.syncManifest).toHaveBeenCalledTimes(2);
    expect(deploy.syncManifest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ bundle_version: "v1700000000001", draft_version: "v1700000000001" })
    );
    expect(db.apps[0]!.draft_version).toBe("v1700000000001");
    expect(db.versions).toHaveLength(0);
    expect(r2.deletePrefix).toHaveBeenCalledWith(expect.stringContaining("alice-notes/v"));
  });

  it("a lost manifest write on a live upload also puts the live Worker back before failing", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    deploy.syncManifest.mockRejectedValueOnce(new Error("kv unavailable"));
    await expect(uploadVersion(supabase, app, zip)).rejects.toThrow(/kv unavailable/);
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(2);
    expect(deploy.promoteVersion).toHaveBeenLastCalledWith(supabase, app, "v1700000000001");
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
    expect(db.versions).toHaveLength(0);
  });

  it("the manifest write precedes the registry commit, so nothing after the commit can fail the upload", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    const pointerAtManifestWrite: (string | null)[] = [];
    deploy.syncManifest.mockImplementation(async () => {
      pointerAtManifestWrite.push(db.apps[0]!.bundle_version);
      return undefined;
    });
    const version = await uploadVersion(supabase, app, zip);
    expect(pointerAtManifestWrite).toEqual(["v1700000000001"]);
    expect(db.apps[0]!.bundle_version).toBe(version);
  });

  it("stage-only: a lost CAS on a draft app also restores the winner's draft Worker", async () => {
    db.apps[0]!.bundle_version = null;
    const draftApp = { ...app, status: "draft" as const, bundle_version: null, draft_version: null };
    deploy.deployStaticVersion.mockImplementation(async () => {
      if (db.apps[0]!.draft_version === null) {
        db.apps[0]!.bundle_version = "v1700000000009";
        db.apps[0]!.draft_version = "v1700000000009";
      }
      return { workerSha256: "a".repeat(64) };
    });
    await expect(uploadVersion(supabase, draftApp, zip, "drop")).rejects.toMatchObject({
      status: 409,
    });
    expect(deploy.deployStaticVersion).toHaveBeenLastCalledWith(
      supabase,
      expect.objectContaining({ target: "draft", version: "v1700000000009" })
    );
  });

  it("app-origin lane: promotes the Worker before moving the registry pointer", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    const order: string[] = [];
    deploy.promoteVersion.mockImplementation(async () => {
      order.push(`promote:${db.apps[0]!.bundle_version}`);
    });
    const version = await uploadVersion(supabase, app, zip);
    expect(order).toEqual(["promote:v1700000000001"]);
    expect(db.apps[0]!.bundle_version).toBe(version);
    const row = db.versions.find((v) => v.version === version)!;
    expect(row.worker_sha256).toBe("a".repeat(64));
    expect(row.published_at).not.toBeNull();
  });
});

describe("pointLiveAt", () => {
  it("moves the pointer and stamps published/retired on the ledger", async () => {
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000001", lane: "push", files,
    });
    db.versions[0]!.published_at = "2026-01-01T00:00:00.000Z";
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000002", lane: "push", files,
    });
    await pointLiveAt(supabase, app, "v1700000000002");
    expect(db.apps[0]!.bundle_version).toBe("v1700000000002");
    expect(db.versions[1]!.published_at).not.toBeNull();
    expect(db.versions[1]!.retired_at).toBeNull();
    expect(db.versions[0]!.retired_at).not.toBeNull();
  });

  it("is a compare-and-swap on the pointer the caller observed", async () => {
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000002", lane: "push", files,
    });
    db.apps[0]!.bundle_version = "v1700000000009";
    await expect(pointLiveAt(supabase, app, "v1700000000002")).rejects.toMatchObject({
      status: 409,
    });
    expect(db.apps[0]!.bundle_version).toBe("v1700000000009");
    expect(db.versions[0]!.published_at).toBeNull();
  });

  it("refuses a version tombstoned since it was read", async () => {
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000002", lane: "push", files,
    });
    db.versions[0]!.purged_at = "2026-03-01T00:00:00.000Z";
    await expect(pointLiveAt(supabase, app, "v1700000000002")).rejects.toMatchObject({
      status: 409,
    });
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
  });

  it("is fenced on updated_at: an origin repair that touched the row since the read loses the swap", async () => {
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000002", lane: "push", files,
    });
    // Same pointer, newer updated_at: the reconciler put the live Worker back
    // on v...001 (over the v...002 the caller just wrote) and fenced it.
    db.apps[0]!.updated_at = "2026-01-01T00:05:00.000Z";
    await expect(pointLiveAt(supabase, app, "v1700000000002")).rejects.toMatchObject({
      status: 409,
    });
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
    expect(db.versions[0]!.published_at).toBeNull();
  });

  it("resolves to the updated_at it committed, which the next move against the row must observe", async () => {
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000002", lane: "push", files,
    });
    const committed = await pointLiveAt(supabase, app, "v1700000000002");
    expect(committed).toBe(db.apps[0]!.updated_at);
    expect(committed).not.toBe(app.updated_at);
    await expect(
      pointLiveAt(supabase, { ...app, bundle_version: "v1700000000002" }, "v1700000000001")
    ).rejects.toMatchObject({ status: 409 });
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000001", lane: "push", files,
    });
    await expect(
      pointLiveAt(
        supabase,
        { ...app, bundle_version: "v1700000000002", updated_at: committed },
        "v1700000000001"
      )
    ).resolves.toBeTruthy();
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
  });
});

describe("rollbackTo (§13.3)", () => {
  async function seed() {
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000000", lane: "push", files,
    });
    db.versions[0]!.published_at = "2026-01-01T00:00:00.000Z";
    db.versions[0]!.retired_at = "2026-01-02T00:00:00.000Z";
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000001", lane: "push", files,
    });
    db.versions[1]!.published_at = "2026-01-02T00:00:00.000Z";
  }

  it("moves live pointer, Worker, and manifest together and records an ops event", async () => {
    await seed();
    const target = await rollbackTo(supabase, app, "v1700000000000");
    expect(target.version).toBe("v1700000000000");
    expect(db.apps[0]!.bundle_version).toBe("v1700000000000");
    expect(deploy.promoteVersion).toHaveBeenCalledWith(supabase, app, "v1700000000000");
    expect(deploy.syncManifest).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ slug: "alice-notes", bundle_version: "v1700000000000" })
    );
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      supabase, "rollback", "user-alice", "alice-notes"
    );
    // The rolled-back-to row is live again; the superseded one is retired.
    expect(db.versions[0]!.retired_at).toBeNull();
    expect(db.versions[1]!.retired_at).not.toBeNull();
  });

  it("the manifest is written from the row as re-read after the commit, not the row this call read", async () => {
    await seed();
    // The owner delists between our pointer commit and our manifest write.
    deploy.promoteVersion.mockImplementationOnce(async () => {
      db.apps[0]!.status = "draft";
      db.apps[0]!.visibility = "private";
    });
    const target = await rollbackTo(supabase, app, "v1700000000000");
    expect(target.version).toBe("v1700000000000");
    expect(deploy.syncManifest).toHaveBeenCalledTimes(1);
    expect(deploy.syncManifest).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        status: "draft",
        visibility: "private",
        bundle_version: "v1700000000000",
      })
    );
  });

  it("a failed pointer move puts the Worker back on the release the registry still names", async () => {
    await seed();
    db.fail = { table: "miniapp_point_live", op: "rpc" };
    await expect(rollbackTo(supabase, app, "v1700000000000")).rejects.toThrow(
      /live pointer move failed/
    );
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(2);
    expect(deploy.promoteVersion).toHaveBeenLastCalledWith(supabase, app, "v1700000000001");
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
    expect(limits.recordOpsEvent).not.toHaveBeenCalled();
  });

  it("two concurrent rollbacks: the loser re-promotes the winner's release and reports 409", async () => {
    await seed();
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000002", lane: "push", files,
    });
    db.versions[2]!.published_at = "2026-01-03T00:00:00.000Z";
    db.versions[2]!.retired_at = "2026-01-04T00:00:00.000Z";
    deploy.promoteVersion.mockImplementationOnce(async () => {
      // The other rollback commits v...002 between our read of `app` and our CAS.
      db.apps[0]!.bundle_version = "v1700000000002";
    });
    await expect(rollbackTo(supabase, app, "v1700000000000")).rejects.toMatchObject({
      status: 409,
    });
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(2);
    expect(deploy.promoteVersion).toHaveBeenLastCalledWith(supabase, app, "v1700000000002");
    expect(db.apps[0]!.bundle_version).toBe("v1700000000002");
    expect(db.versions[0]!.published_at).toBe("2026-01-01T00:00:00.000Z");
    expect(deploy.syncManifest).not.toHaveBeenCalled();
    expect(limits.recordOpsEvent).not.toHaveBeenCalled();
  });

  it("a version the sweep tombstoned after the read is refused, not made live", async () => {
    await seed();
    deploy.promoteVersion.mockImplementationOnce(async () => {
      db.versions[0]!.purged_at = "2026-03-01T00:00:00.000Z";
    });
    await expect(rollbackTo(supabase, app, "v1700000000000")).rejects.toMatchObject({
      status: 409,
    });
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
    expect(deploy.promoteVersion).toHaveBeenLastCalledWith(supabase, app, "v1700000000001");
  });

  it("refuses versions of another app, unknown versions, and the live one", async () => {
    await seed();
    await recordVersion(supabase, {
      appId: "app-other", userId: "user-bob", version: "v1700000000005", lane: "push", files,
    });
    await expect(rollbackTo(supabase, app, "v1700000000005")).rejects.toMatchObject({
      status: 404,
    });
    await expect(rollbackTo(supabase, app, "v1799999999999")).rejects.toMatchObject({
      status: 404,
    });
    await expect(rollbackTo(supabase, app, "not-a-version")).rejects.toMatchObject({
      status: 404,
    });
    await expect(rollbackTo(supabase, app, "v1700000000001")).rejects.toMatchObject({
      status: 409,
    });
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
  });

  it("refuses drafts that were never published and tombstoned rows", async () => {
    await seed();
    await recordVersion(supabase, {
      appId: "app-notes", userId: "user-alice", version: "v1700000000002", lane: "push", files,
    });
    await expect(rollbackTo(supabase, app, "v1700000000002")).rejects.toMatchObject({
      status: 409,
    });
    db.versions[0]!.purged_at = "2026-03-01T00:00:00.000Z";
    await expect(rollbackTo(supabase, app, "v1700000000000")).rejects.toMatchObject({
      status: 404,
    });
    expect(deploy.promoteVersion).not.toHaveBeenCalled();
  });

  it("is owner-only and published-only", async () => {
    await seed();
    await expect(
      rollbackTo(supabase, { ...app, owner_user_id: null }, "v1700000000000")
    ).rejects.toBeInstanceOf(VersionError);
    await expect(
      rollbackTo(supabase, { ...app, status: "draft" }, "v1700000000000")
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("sweepVersions (§13.1 retention)", () => {
  const day = 86_400_000;
  const now = new Date("2026-06-01T00:00:00.000Z");

  function version(
    v: string,
    extra: Partial<VersionRowLike> = {},
    appId = "app-notes"
  ): VersionRowLike {
    const row: VersionRowLike = {
      id: `ver-${v}`,
      app_id: appId,
      user_id: "user-alice",
      version: v,
      lane: "push",
      bundle_sha256: "0".repeat(64),
      bundle_bytes: 1,
      file_count: 1,
      worker_sha256: null,
      kit_version: null,
      findings: [],
      qa_score: null,
      created_at: new Date(Number(v.slice(1))).toISOString(),
      published_at: null,
      retired_at: null,
      purged_at: null,
      ...extra,
    };
    db.versions.push(row);
    return row;
  }

  it("never removes the live or draft pointer, keeps 5 drafts, expires old superseded", async () => {
    db.apps[0]!.bundle_version = "v1700000000100";
    db.apps[0]!.draft_version = "v1700000000200";
    // live
    version("v1700000000100", { published_at: "2026-01-01T00:00:00.000Z" });
    // superseded long ago → gone
    version("v1700000000050", {
      published_at: "2025-01-01T00:00:00.000Z",
      retired_at: new Date(now.getTime() - (RETAIN_SUPERSEDED_DAYS + 1) * day).toISOString(),
    });
    // superseded recently → kept
    version("v1700000000060", {
      published_at: "2025-06-01T00:00:00.000Z",
      retired_at: new Date(now.getTime() - 2 * day).toISOString(),
    });
    // draft pointer (unpublished) → kept regardless
    version("v1700000000200");
    // seven unpublished drafts, newest first: keep 5, drop the 2 oldest
    for (let i = 0; i < 7; i++) version(`v170000000030${i}`);

    const removed = await sweepVersions(supabase, now);
    const left = db.versions.map((v) => v.version).sort();
    expect(removed).toBe(3);
    expect(left).toContain("v1700000000100");
    expect(left).toContain("v1700000000200");
    expect(left).toContain("v1700000000060");
    expect(left).not.toContain("v1700000000050");
    expect(left).not.toContain("v1700000000300");
    expect(left).not.toContain("v1700000000301");
    for (let i = 2; i < 7; i++) expect(left).toContain(`v170000000030${i}`);
    expect(r2.deletePrefix).toHaveBeenCalledTimes(3);
    expect(r2.deletePrefix).toHaveBeenCalledWith(
      expect.stringContaining("alice-notes/v1700000000050")
    );
  });

  it("counts drafts per app, not globally", async () => {
    db.apps.push({
      ...makeApp({ id: "app-other", slug: "bob-thing", owner_user_id: "user-bob" }),
      app_origin_deployed_at: null,
    });
    for (let i = 0; i < RETAIN_DRAFTS; i++) version(`v170000000040${i}`);
    for (let i = 0; i < RETAIN_DRAFTS; i++) version(`v170000000050${i}`, {}, "app-other");
    expect(await sweepVersions(supabase, now)).toBe(0);
    expect(db.versions).toHaveLength(RETAIN_DRAFTS * 2);
  });

  it("tombstones before deleting artifacts; a failed row delete leaves no selectable row", async () => {
    db.apps[0]!.bundle_version = "v1700000000100";
    version("v1700000000100", { published_at: "2026-01-01T00:00:00.000Z" });
    const old = version("v1700000000050", {
      published_at: "2025-01-01T00:00:00.000Z",
      retired_at: new Date(now.getTime() - (RETAIN_SUPERSEDED_DAYS + 1) * day).toISOString(),
    });
    db.fail = { table: "miniapp_versions", op: "delete" };
    expect(await sweepVersions(supabase, now)).toBe(0);
    expect(old.purged_at).not.toBeNull();
    expect(r2.deletePrefix).toHaveBeenCalledTimes(1);
    await expect(rollbackTo(supabase, { ...app, bundle_version: "v1700000000100" }, old.version))
      .rejects.toMatchObject({ status: 404 });
    // The next sweep finishes the job.
    expect(await sweepVersions(supabase, now)).toBe(1);
    expect(db.versions.map((v) => v.version)).toEqual(["v1700000000100"]);
  });

  it("a candidate a rollback made live since the read is left alone", async () => {
    db.apps[0]!.bundle_version = "v1700000000100";
    version("v1700000000100", { published_at: "2026-01-01T00:00:00.000Z" });
    const old = version("v1700000000050", {
      published_at: "2025-01-01T00:00:00.000Z",
      retired_at: new Date(now.getTime() - (RETAIN_SUPERSEDED_DAYS + 1) * day).toISOString(),
    });
    // The sweep read `old` as retired; a rollback commits before the tombstone.
    db.beforeRpc = () => {
      db.apps[0]!.bundle_version = "v1700000000050";
    };
    expect(await sweepVersions(supabase, now)).toBe(0);
    expect(old.purged_at).toBeNull();
    expect(db.versions).toHaveLength(2);
    expect(r2.deletePrefix).not.toHaveBeenCalled();
  });

  it("a failed R2 delete leaves the tombstone for the next sweep and never the artifacts orphaned", async () => {
    db.apps[0]!.bundle_version = "v1700000000100";
    version("v1700000000100", { published_at: "2026-01-01T00:00:00.000Z" });
    const old = version("v1700000000050", {
      published_at: "2025-01-01T00:00:00.000Z",
      retired_at: new Date(now.getTime() - (RETAIN_SUPERSEDED_DAYS + 1) * day).toISOString(),
    });
    r2.deletePrefix.mockRejectedValueOnce(new Error("r2 down"));
    expect(await sweepVersions(supabase, now)).toBe(0);
    expect(old.purged_at).not.toBeNull();
    expect(db.versions).toHaveLength(2);
    expect(await sweepVersions(supabase, now)).toBe(1);
    expect(r2.deletePrefix).toHaveBeenCalledTimes(2);
  });

  it("without R2 nothing is removed: rows outlive the sweep so artifacts stay reachable", async () => {
    r2.r2Configured.mockReturnValue(false);
    db.apps[0]!.bundle_version = "v1700000000100";
    version("v1700000000100", { published_at: "2026-01-01T00:00:00.000Z" });
    const old = version("v1700000000050", {
      published_at: "2025-01-01T00:00:00.000Z",
      retired_at: new Date(now.getTime() - (RETAIN_SUPERSEDED_DAYS + 1) * day).toISOString(),
    });
    expect(await sweepVersions(supabase, now)).toBe(0);
    expect(old.purged_at).toBeNull();
    expect(db.versions).toHaveLength(2);
    expect(r2.deletePrefix).not.toHaveBeenCalled();
  });

  it("pages through every row instead of stopping at a fixed cap", async () => {
    const total = SWEEP_PAGE * 2 + 7;
    for (let i = 0; i < total; i++) {
      version(`v${String(1_600_000_000_000 + i * 1000)}`);
    }
    expect(await sweepVersions(supabase, now)).toBe(total - RETAIN_DRAFTS);
    expect(db.versions).toHaveLength(RETAIN_DRAFTS);
  });
});
