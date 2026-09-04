import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const deploy = vi.hoisted(() => ({
  deployStaticVersion: vi.fn(async () => null as { workerSha256: string } | null),
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

interface AppRowLike {
  id: string;
  slug: string;
  bundle_version: string | null;
  draft_version: string | null;
  updated_at: string;
}

const db = {
  versions: [] as VersionRowLike[],
  apps: [] as AppRowLike[],
  /** Make the next matching op fail, e.g. { table: "miniapp_versions", op: "delete" }. */
  fail: null as { table: string; op: "insert" | "update" | "delete" } | null,
};

let seq = 0;

function failing(table: string, op: "insert" | "update" | "delete") {
  if (db.fail && db.fail.table === table && db.fail.op === op) {
    db.fail = null;
    return { data: null, error: { message: `${op} on ${table} refused` } };
  }
  return null;
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

const supabase = {
  from: (table: "miniapp_versions" | "mini_apps") => query(table),
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
  db.apps = [
    {
      id: "app-notes",
      slug: "alice-notes",
      bundle_version: "v1700000000001",
      draft_version: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  deploy.deployStaticVersion.mockReset();
  deploy.deployStaticVersion.mockResolvedValue(null);
  deploy.promoteVersion.mockReset();
  deploy.promoteVersion.mockResolvedValue(undefined);
  deploy.syncManifest.mockClear();
  bundles.storeBundle.mockReset();
  bundles.storeBundle.mockResolvedValue(undefined);
  r2.deletePrefix.mockClear();
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

  it("a failed registry move after promotion puts the Worker back on the previous release", async () => {
    deploy.deployStaticVersion.mockResolvedValue({ workerSha256: "a".repeat(64) });
    db.fail = { table: "mini_apps", op: "update" };
    await expect(uploadVersion(supabase, app, zip)).rejects.toThrow(/bundle version update failed/);
    expect(deploy.promoteVersion).toHaveBeenCalledTimes(2);
    expect(deploy.promoteVersion).toHaveBeenLastCalledWith(app, "v1700000000001");
    expect(db.apps[0]!.bundle_version).toBe("v1700000000001");
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
    expect(deploy.promoteVersion).toHaveBeenCalledWith(app, "v1700000000000");
    expect(deploy.syncManifest).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "alice-notes", bundle_version: "v1700000000000" })
    );
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(
      supabase, "rollback", "user-alice", "alice-notes"
    );
    // The rolled-back-to row is live again; the superseded one is retired.
    expect(db.versions[0]!.retired_at).toBeNull();
    expect(db.versions[1]!.retired_at).not.toBeNull();
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
      id: "app-other",
      slug: "bob-thing",
      bundle_version: null,
      draft_version: null,
      updated_at: "2026-01-01T00:00:00.000Z",
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

  it("pages through every row instead of stopping at a fixed cap", async () => {
    const total = SWEEP_PAGE * 2 + 7;
    for (let i = 0; i < total; i++) {
      version(`v${String(1_600_000_000_000 + i * 1000)}`);
    }
    expect(await sweepVersions(supabase, now)).toBe(total - RETAIN_DRAFTS);
    expect(db.versions).toHaveLength(RETAIN_DRAFTS);
  });
});
