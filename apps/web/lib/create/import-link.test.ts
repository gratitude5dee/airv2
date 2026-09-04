/**
 * V11 §11 Import, linking a repository to an app: the link row is written
 * before any external effect, so a refused or failed write (unique source,
 * database) stages nothing and commits nothing; a first import keeps the
 * link (and app) only when something actually staged; a failed re-import
 * puts the working link back field-for-field; a source already feeding
 * another app is refused before any row exists; an app this request
 * created is removed again when the link cannot be kept. Two imports of one
 * app may overlap: each fences its writes on its own import_id, so the one
 * that fails never undoes the one that succeeded.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BundleFile } from "@/lib/miniapps/bundles";
import { makeApp } from "@/app/mini/loader-test-utils";
import { makeZip } from "@/lib/create/zip-test-utils";

type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  nextId: 1,
  log: [] as string[],
  /** Runs right before an upsert is applied (a concurrent writer). */
  beforeUpsert: null as (() => void) | null,
  /** Errors the next N upserts return (the database refusing). */
  failUpserts: 0,
  /** Errors the next N updates return. */
  failUpdates: 0,
}));

vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));

/** Just enough PostgREST: filters, maybeSingle/single, upsert with the two unique keys, delete, update. */
function supabase(): SupabaseClient {
  function builder(table: string) {
    const rows = () => (db.tables[table] ??= []);
    const filters: ((row: Row) => boolean)[] = [];
    let op: { kind: "select" } | { kind: "upsert"; row: Row } | { kind: "delete" } | { kind: "update"; values: Row } = {
      kind: "select",
    };
    const matches = () => rows().filter((row) => filters.every((f) => f(row)));
    const run = (): { data: Row[]; error: { code: string; message: string } | null } => {
      if (op.kind === "select") return { data: matches(), error: null };
      if (op.kind === "delete") {
        const gone = matches();
        db.tables[table] = rows().filter((row) => !gone.includes(row));
        db.log.push(`delete:${table}:${gone.length}`);
        return { data: gone, error: null };
      }
      if (op.kind === "update") {
        if (db.failUpdates > 0) {
          db.failUpdates -= 1;
          return { data: [], error: { code: "XX000", message: "connection reset" } };
        }
        const hit = matches();
        for (const row of hit) Object.assign(row, op.values);
        db.log.push(`update:${table}`);
        return { data: hit, error: null };
      }
      const incoming = op.row;
      if (db.failUpserts > 0) {
        db.failUpserts -= 1;
        return { data: [], error: { code: "XX000", message: "connection reset" } };
      }
      db.beforeUpsert?.();
      const byApp = rows().find((row) => row["app_id"] === incoming["app_id"]);
      const clash = rows().find(
        (row) =>
          row !== byApp &&
          row["repo_id"] === incoming["repo_id"] &&
          row["branch"] === incoming["branch"] &&
          row["dir"] === incoming["dir"]
      );
      if (clash) return { data: [], error: { code: "23505", message: "duplicate key" } };
      db.log.push(`upsert:${table}`);
      if (byApp) {
        Object.assign(byApp, incoming);
        return { data: [byApp], error: null };
      }
      const created = {
        id: `link-${db.nextId++}`,
        last_sha: null,
        last_synced_at: null,
        created_at: "2026-09-04T00:00:00Z",
        ...incoming,
      };
      rows().push(created);
      return { data: [created], error: null };
    };
    const chain: Record<string, unknown> = {};
    chain["select"] = () => chain;
    chain["eq"] = (col: string, value: unknown) => {
      filters.push((row) => row[col] === value);
      return chain;
    };
    chain["is"] = (col: string, value: unknown) => {
      filters.push((row) => (row[col] ?? null) === value);
      return chain;
    };
    chain["upsert"] = (row: Row) => {
      op = { kind: "upsert", row };
      return chain;
    };
    chain["delete"] = () => {
      op = { kind: "delete" };
      return chain;
    };
    chain["update"] = (values: Row) => {
      op = { kind: "update", values };
      return chain;
    };
    chain["maybeSingle"] = () => {
      const result = run();
      return Promise.resolve({ data: result.data[0] ?? null, error: result.error });
    };
    chain["single"] = () => {
      const result = run();
      if (result.error) return Promise.resolve({ data: null, error: result.error });
      return Promise.resolve(
        result.data[0]
          ? { data: result.data[0], error: null }
          : { data: null, error: { code: "PGRST116", message: "no rows" } }
      );
    };
    chain["then"] = (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve);
    return chain;
  }
  return { from: builder } as unknown as SupabaseClient;
}

const SHA = "b".repeat(40);
const HTML = "<!doctype html><html><body>hi</body></html>";

const github = vi.hoisted(() => ({
  installationToken: vi.fn(async () => "ghs_short_lived"),
  getRepository: vi.fn(async () => ({
    id: 123,
    full_name: "alice/site",
    private: false,
    default_branch: "main",
    archived: false,
  })),
  branchHeadSha: vi.fn(async () => "b".repeat(40)),
  downloadZipball: vi.fn(async (): Promise<Buffer> => Buffer.alloc(0)),
  getFile: vi.fn(async () => null),
  putFile: vi.fn(async () => ({ commitSha: "c".repeat(40) })),
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
  id: "app-1",
  slug: "alice-site",
  appname: "site",
  owner_user_id: "user-alice",
  status: "draft",
  visibility: "unlisted",
});
const drop = vi.hoisted(() => ({
  resolveOrCreateDropApp: vi.fn(async () => ({ app: {} as unknown, created: true })),
  discardEmptyDraft: vi.fn(async () => true),
}));
vi.mock("@/lib/create/drop", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/drop")>()),
  ...drop,
}));

const limits = vi.hoisted(() => ({
  recordOpsEvent: vi.fn(async (..._args: [unknown, string, string, string]) => undefined),
}));
vi.mock("@/lib/security/limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/limits")>()),
  ...limits,
}));

import { WORKFLOW_PATH, linkRepository } from "./import";

function zipball(files: Record<string, string>): Buffer {
  return makeZip(
    Object.entries(files).map(([name, data]) => ({ name: `alice-site-${SHA.slice(0, 7)}/${name}`, data }))
  );
}

function existingLink(over: Row = {}): Row {
  return {
    id: "link-old",
    user_id: "user-alice",
    installation_id: 10,
    app_id: "app-1",
    repo_id: 123,
    full_name: "alice/site",
    branch: "main",
    dir: "site",
    mode: "static",
    workflow_path: null,
    last_sha: "a".repeat(40),
    last_synced_at: "2026-09-01T00:00:00Z",
    last_error: null,
    created_at: "2026-09-01T00:00:00Z",
    import_id: "import-old",
    ...over,
  };
}

function links(): Row[] {
  return db.tables["github_repo_links"] ?? [];
}

const input = { installationId: 10, fullName: "alice/site", branch: "main" };

beforeEach(() => {
  vi.clearAllMocks();
  db.tables = {
    users: [{ id: "user-alice", deleting_at: null }],
    github_installations: [
      {
        installation_id: 10,
        user_id: "user-alice",
        account_login: "alice",
        account_type: "User",
        suspended_at: null,
        removed_at: null,
      },
    ],
    github_repo_links: [],
  };
  db.nextId = 1;
  db.log = [];
  db.beforeUpsert = null;
  db.failUpserts = 0;
  db.failUpdates = 0;
  process.env["MINIAPP_ORIGIN"] = "https://mini.wzrd.test";
  drop.resolveOrCreateDropApp.mockResolvedValue({ app, created: true });
  github.downloadZipball.mockResolvedValue(zipball({ "index.html": HTML, "site/index.html": HTML }));
});

describe("linkRepository — first import", () => {
  it("creates the link, stages a draft and stamps the head", async () => {
    const result = await linkRepository(supabase(), "user-alice", input);
    expect(result).toMatchObject({ slug: "alice-site", mode: "static", version: "v1700000000000" });
    expect(links()).toHaveLength(1);
    expect(links()[0]).toMatchObject({ app_id: "app-1", repo_id: 123, branch: "main", dir: "", last_sha: SHA });
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "import", "user-alice", "alice/site@main");
    expect(drop.discardEmptyDraft).not.toHaveBeenCalled();
  });

  it("removes the link and the app it created when staging fails", async () => {
    versions.uploadVersion.mockRejectedValueOnce(new Error("r2 down"));
    await expect(linkRepository(supabase(), "user-alice", input)).rejects.toThrow("r2 down");
    expect(links()).toEqual([]);
    expect(drop.discardEmptyDraft).toHaveBeenCalledWith(expect.anything(), "user-alice", "app-1");
  });

  it("keeps a pre-existing app when staging fails", async () => {
    drop.resolveOrCreateDropApp.mockResolvedValue({ app, created: false });
    versions.uploadVersion.mockRejectedValueOnce(new Error("r2 down"));
    await expect(linkRepository(supabase(), "user-alice", input)).rejects.toThrow("r2 down");
    expect(links()).toEqual([]);
    expect(drop.discardEmptyDraft).not.toHaveBeenCalled();
  });

  it("refuses a source already feeding another app before creating anything", async () => {
    db.tables["github_repo_links"] = [existingLink({ id: "link-bob", app_id: "app-bob", user_id: "user-bob", dir: "" })];
    drop.resolveOrCreateDropApp.mockResolvedValue({ app, created: true });
    await expect(linkRepository(supabase(), "user-alice", input)).rejects.toMatchObject({ status: 409 });
    expect(versions.uploadVersion).not.toHaveBeenCalled();
    expect(drop.discardEmptyDraft).toHaveBeenCalledWith(expect.anything(), "user-alice", "app-1");
    expect(links().map((l) => l["id"])).toEqual(["link-bob"]);
  });

  it("two first imports of one new app: the one that fails keeps neither the app nor the link from the other", async () => {
    // A wins the app insert, saves the link and starts staging; B finds the
    // app, saves over the same row, stages and stamps; then A fails. A's
    // delete is fenced on its own import_id, so B's link (and the app) stay.
    drop.resolveOrCreateDropApp
      .mockResolvedValueOnce({ app, created: true })
      .mockResolvedValueOnce({ app, created: false });
    versions.uploadVersion.mockImplementationOnce(async () => {
      await linkRepository(supabase(), "user-alice", input);
      throw new Error("r2 down");
    });
    await expect(linkRepository(supabase(), "user-alice", input)).rejects.toThrow("r2 down");
    expect(links()).toHaveLength(1);
    expect(links()[0]).toMatchObject({ app_id: "app-1", dir: "", last_sha: SHA, last_error: null });
    expect(drop.discardEmptyDraft).not.toHaveBeenCalled();
    expect(db.log).not.toContain("delete:github_repo_links:1");
  });

  it("removes the app it created when the link cannot be saved", async () => {
    // Nothing found by the pre-check, but the unique index refuses at write time.
    let calls = 0;
    db.beforeUpsert = () => {
      calls += 1;
      db.tables["github_repo_links"] = [
        existingLink({ id: "link-bob", app_id: "app-bob", user_id: "user-bob", dir: "" }),
      ];
    };
    await expect(linkRepository(supabase(), "user-alice", input)).rejects.toMatchObject({ status: 409 });
    expect(calls).toBe(1);
    expect(versions.uploadVersion).not.toHaveBeenCalled();
    expect(drop.discardEmptyDraft).toHaveBeenCalledWith(expect.anything(), "user-alice", "app-1");
  });
});

describe("linkRepository — re-import", () => {
  beforeEach(() => {
    db.tables["github_repo_links"] = [existingLink()];
    drop.resolveOrCreateDropApp.mockResolvedValue({ app, created: false });
  });

  it("moves the link (same row) before staging, then stamps the new head", async () => {
    versions.uploadVersion.mockImplementationOnce(async () => {
      // By the time the draft stages, the row already names the new source.
      expect(links()[0]).toMatchObject({ id: "link-old", dir: "", last_sha: "a".repeat(40) });
      return "v1700000000000";
    });
    const result = await linkRepository(supabase(), "user-alice", { ...input, dir: "" });
    expect(result.dir).toBe("");
    expect(links()).toHaveLength(1);
    expect(links()[0]).toMatchObject({ id: "link-old", dir: "", last_sha: SHA, last_error: null });
    expect(versions.uploadVersion).toHaveBeenCalledTimes(1);
  });

  it("a refused link write stages nothing: the source is taken at write time", async () => {
    // The pre-check saw nothing, but another app claims the source just
    // before the upsert; the unique index decides and no draft moves.
    db.beforeUpsert = () => {
      db.tables["github_repo_links"]!.push(
        existingLink({ id: "link-bob", app_id: "app-bob", user_id: "user-bob", dir: "" })
      );
    };
    await expect(linkRepository(supabase(), "user-alice", { ...input, dir: "" })).rejects.toMatchObject({
      status: 409,
    });
    expect(versions.uploadVersion).not.toHaveBeenCalled();
    expect(links().find((l) => l["id"] === "link-old")).toEqual(existingLink());
  });

  it("a database failure on the link write stages nothing and commits nothing", async () => {
    db.failUpserts = 1;
    await expect(linkRepository(supabase(), "user-alice", { ...input, dir: "" })).rejects.toThrow(
      /link save failed: connection reset/
    );
    expect(versions.uploadVersion).not.toHaveBeenCalled();
    expect(github.putFile).not.toHaveBeenCalled();
    expect(links()).toEqual([existingLink()]);
  });

  it("puts the working link back exactly as it was when the replacement fails to stage", async () => {
    versions.uploadVersion.mockRejectedValueOnce(new Error("r2 down"));
    await expect(linkRepository(supabase(), "user-alice", { ...input, dir: "" })).rejects.toThrow("r2 down");
    expect(links()).toEqual([existingLink()]);
    expect(db.log).not.toContain("delete:github_repo_links:1");
    expect(drop.discardEmptyDraft).not.toHaveBeenCalled();
  });

  it("retries the restore, and reports it when the old link cannot be put back", async () => {
    versions.uploadVersion.mockRejectedValueOnce(new Error("r2 down"));
    db.failUpdates = 2;
    await expect(linkRepository(supabase(), "user-alice", { ...input, dir: "" })).rejects.toThrow("r2 down");
    expect(links()).toEqual([existingLink()]);

    db.tables["github_repo_links"] = [existingLink()];
    versions.uploadVersion.mockRejectedValueOnce(new Error("r2 down"));
    db.failUpdates = 3;
    await expect(linkRepository(supabase(), "user-alice", { ...input, dir: "" })).rejects.toMatchObject({
      status: 502,
      message: expect.stringMatching(/previous link \(alice\/site@main\/site\) could not be restored/),
    });
  });

  it("puts the working link back when switching to build mode fails to commit the workflow", async () => {
    github.downloadZipball.mockResolvedValue(
      zipball({
        "package.json": JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "6" } }),
        "package-lock.json": "{}",
      })
    );
    github.putFile.mockRejectedValueOnce(new Error("contents:write refused"));
    await expect(
      linkRepository(supabase(), "user-alice", { ...input, dir: "", commitWorkflow: true })
    ).rejects.toThrow("contents:write refused");
    expect(links()).toEqual([existingLink()]);
  });

  it("a refused link write for build mode never touches the repository", async () => {
    github.downloadZipball.mockResolvedValue(
      zipball({
        "package.json": JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "6" } }),
        "package-lock.json": "{}",
      })
    );
    db.failUpserts = 1;
    await expect(
      linkRepository(supabase(), "user-alice", { ...input, dir: "", commitWorkflow: true })
    ).rejects.toMatchObject({ status: 502 });
    expect(github.putFile).not.toHaveBeenCalled();
    expect(links()).toEqual([existingLink()]);
  });

  it("switches a working link to build mode once the workflow is committed", async () => {
    github.downloadZipball.mockResolvedValue(
      zipball({
        "package.json": JSON.stringify({ scripts: { build: "vite build" }, devDependencies: { vite: "6" } }),
        "package-lock.json": "{}",
      })
    );
    const result = await linkRepository(supabase(), "user-alice", { ...input, dir: "", commitWorkflow: true });
    expect(result).toMatchObject({ mode: "build", workflow_path: WORKFLOW_PATH, version: null });
    expect(links()[0]).toMatchObject({ id: "link-old", mode: "build", dir: "", workflow_path: WORKFLOW_PATH });
  });

  it("a failing re-import leaves a concurrent one's finished link alone", async () => {
    // A saves its row, then B saves over it, stages and stamps; then A's
    // staging fails. A's restore is fenced on the import_id it wrote, which
    // B replaced, so B's working link stands and the old one is not put back.
    versions.uploadVersion.mockImplementationOnce(async () => {
      await linkRepository(supabase(), "user-alice", { ...input, dir: "" });
      throw new Error("r2 down");
    });
    await expect(linkRepository(supabase(), "user-alice", { ...input, dir: "" })).rejects.toThrow("r2 down");
    expect(links()).toHaveLength(1);
    expect(links()[0]).toMatchObject({ id: "link-old", dir: "", last_sha: SHA, last_error: null });
    expect(links()[0]!["import_id"]).not.toBe("import-old");
    expect(versions.uploadVersion).toHaveBeenCalledTimes(2);
    expect(db.log).not.toContain("delete:github_repo_links:1");
  });

  it("an import overtaken while staging reports it and leaves the newer link as written", async () => {
    // A saves dir "", B saves dir "site" over it and finishes; A's draft
    // stages fine but its final stamp finds the row is no longer its own.
    versions.uploadVersion.mockImplementationOnce(async () => {
      await linkRepository(supabase(), "user-alice", { ...input, dir: "site" });
      return "v1700000000001";
    });
    await expect(linkRepository(supabase(), "user-alice", { ...input, dir: "" })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/another import of this app replaced the link/),
    });
    expect(links()).toHaveLength(1);
    expect(links()[0]).toMatchObject({ id: "link-old", dir: "site", last_sha: SHA, last_error: null });
    expect(links()[0]!["last_synced_at"]).not.toBe("2026-09-01T00:00:00Z");
  });

  it("refuses to point the app at a different repository", async () => {
    github.getRepository.mockResolvedValueOnce({
      id: 999,
      full_name: "alice/other",
      private: false,
      default_branch: "main",
      archived: false,
    });
    await expect(linkRepository(supabase(), "user-alice", { ...input, fullName: "alice/other" })).rejects.toThrow(
      /already linked to alice\/site/
    );
    expect(links()).toEqual([existingLink()]);
  });
});
