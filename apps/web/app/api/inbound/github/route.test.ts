/**
 * GitHub App webhook: signature before anything else, one delivery id once,
 * then only the events that matter reach the import layer. A failed sync
 * still answers 200 (GitHub does not retry; the next push is the retry),
 * while a handler that throws gives the delivery id back so a redelivery
 * runs it again instead of being called a duplicate — and when even that
 * release fails, the lease on the id expires so the redelivery still runs.
 * The final mark is retried, and a handler that ran to completion has
 * recorded its effect (the link's head), so the re-run a lost mark allows
 * stages nothing twice.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import type { Row } from "@/lib/testing/fakeSupabase";
import type { RepoLink } from "@/lib/create/import";

const db = new FakeSupabase();

// The 0091 RPC is itself a write: it inserts a fresh delivery row, or takes
// over an unfinished one whose lease has run out; a processed row or a live
// lease refuses. Mirroring the migration keeps claim/dedupe behaviour real.
function wireDeliveryClaim(): void {
  db.rpcResults["github_delivery_claim"] = (rawArgs: unknown) => {
    const args = rawArgs as {
      p_delivery_id: string;
      p_event: string;
      p_lease_seconds: number;
    };
    const now = Date.now();
    const rows = db.rows("github_deliveries");
    const row = rows.find((r) => r["delivery_id"] === args.p_delivery_id);
    if (row) {
      const processed = row["processed_at"] != null;
      const expired =
        Date.parse(String(row["received_at"])) <
        now - args.p_lease_seconds * 1000;
      if (processed || !expired) return false;
      row["received_at"] = new Date(now).toISOString();
      row["event"] = args.p_event;
      return true;
    }
    rows.push({
      delivery_id: args.p_delivery_id,
      event: args.p_event,
      received_at: new Date(now).toISOString(),
      processed_at: null,
    });
    return true;
  };
}

// Counted complete-mark failures: the resolve hook sees every attempted
// update (recorded in db.queries either way) and fails the next N.
let failCompletes = 0;
const markAttempts: string[] = [];
const markSuccesses: string[] = [];

function wireMarkWatcher(): void {
  db.resolve = (q) => {
    if (q.table === "github_deliveries" && q.mode === "update") {
      const id = String(
        q.filters.find((f) => f.column === "delivery_id")?.value
      );
      markAttempts.push(id);
      if (failCompletes > 0) {
        failCompletes -= 1;
        return { error: { code: "XX000", message: "connection reset" } };
      }
      markSuccesses.push(id);
    }
    return undefined;
  };
}

function deliveryRow(id: string): Row | undefined {
  return db.rows("github_deliveries").find((r) => r["delivery_id"] === id);
}

function releasedIds(): string[] {
  return db.deletes
    .filter((d) => d.table === "github_deliveries")
    .flatMap((d) => d.rows.map((r) => String(r["delivery_id"])));
}

function backdate(id: string, msAgo: number): void {
  const row = deliveryRow(id);
  if (!row) throw new Error(`no delivery row ${id}`);
  row["received_at"] = new Date(Date.now() - msAgo).toISOString();
}

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.client(),
}));

const imports = vi.hoisted(() => ({
  linksForRepo: vi.fn(async (): Promise<RepoLink[]> => []),
  markInstallation: vi.fn(async () => undefined),
  syncStaticLink: vi.fn(async () => ({ slug: "alice-site", version: "v1", sha: "b".repeat(40), findings: [] })),
}));
vi.mock("@/lib/create/import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/import")>()),
  linksForRepo: imports.linksForRepo,
  markInstallation: imports.markInstallation,
  syncStaticLink: imports.syncStaticLink,
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

const SECRET = "whsec-test";
let deliveryCounter = 0;

function deliver(
  event: string,
  body: unknown,
  options: { secret?: string; delivery?: string | null; signature?: string | null; raw?: string } = {}
): NextRequest {
  const raw = options.raw ?? JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json", "x-github-event": event });
  const signature =
    options.signature === undefined
      ? `sha256=${createHmac("sha256", options.secret ?? SECRET).update(raw).digest("hex")}`
      : options.signature;
  if (signature !== null) headers.set("x-hub-signature-256", signature);
  const delivery = options.delivery === undefined ? `d-${++deliveryCounter}` : options.delivery;
  if (delivery !== null) headers.set("x-github-delivery", delivery);
  return new NextRequest("https://air.test/api/inbound/github", { method: "POST", headers, body: raw });
}

function link(over: Partial<RepoLink>): RepoLink {
  return {
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
    import_id: "import-old",
    ...over,
  };
}

const push = {
  ref: "refs/heads/main",
  after: "b".repeat(40),
  repository: { id: 123, full_name: "alice/site" },
  installation: { id: 10 },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  failCompletes = 0;
  markAttempts.length = 0;
  markSuccesses.length = 0;
  wireDeliveryClaim();
  wireMarkWatcher();
  db.tables["github_repo_links"] = [
    { id: "l-123", installation_id: 10, repo_id: 123 },
    { id: "l-124", installation_id: 10, repo_id: 124 },
    { id: "l-other-repo", installation_id: 10, repo_id: 999 },
    { id: "l-other-inst", installation_id: 11, repo_id: 123 },
  ];
  process.env["GITHUB_APP_ID"] = "4242";
  process.env["GITHUB_APP_SLUG"] = "wzrd-create";
  process.env["GITHUB_APP_PRIVATE_KEY"] = "-----BEGIN RSA PRIVATE KEY-----\\nx\\n-----END RSA PRIVATE KEY-----";
  process.env["GITHUB_APP_WEBHOOK_SECRET"] = SECRET;
  imports.linksForRepo.mockResolvedValue([]);
});

describe("POST /api/inbound/github — gate", () => {
  it("503 when the App is not configured, before reading anything", async () => {
    delete process.env["GITHUB_APP_WEBHOOK_SECRET"];
    const response = await POST(deliver("push", push));
    expect(response.status).toBe(503);
    expect(db.rows("github_deliveries")).toHaveLength(0);
  });

  it.each([
    ["missing", { signature: null }],
    ["wrong secret", { secret: "other" }],
    ["malformed", { signature: "sha256=nope" }],
  ])("401 on a %s signature and writes nothing", async (_label, options) => {
    const response = await POST(deliver("push", push, options));
    expect(response.status).toBe(401);
    expect(db.rows("github_deliveries")).toHaveLength(0);
    expect(imports.linksForRepo).not.toHaveBeenCalled();
  });

  it("401 when the body was altered after signing", async () => {
    const signed = JSON.stringify(push);
    const tampered = JSON.stringify({ ...push, after: "c".repeat(40) });
    const response = await POST(
      deliver("push", push, {
        raw: tampered,
        signature: `sha256=${createHmac("sha256", SECRET).update(signed).digest("hex")}`,
      })
    );
    expect(response.status).toBe(401);
  });

  it.each([
    ["no delivery id", { delivery: null }],
    ["bad delivery id", { delivery: "x y" }],
  ])("400 with %s", async (_label, options) => {
    const response = await POST(deliver("push", push, options));
    expect(response.status).toBe(400);
    expect(db.rows("github_deliveries")).toHaveLength(0);
  });

  it("400 without an event name", async () => {
    const request = deliver("", push);
    request.headers.delete("x-github-event");
    expect((await POST(request)).status).toBe(400);
  });

  it("400 on invalid JSON that was nonetheless signed", async () => {
    const response = await POST(deliver("push", null, { raw: "{not json" }));
    expect(response.status).toBe(400);
    expect(db.rows("github_deliveries")).toHaveLength(0);
  });

  it("acknowledges a redelivered id without reprocessing", async () => {
    imports.linksForRepo.mockResolvedValue([link({})]);
    const first = await POST(deliver("push", push, { delivery: "dup-1" }));
    expect(first.status).toBe(200);
    expect(imports.syncStaticLink).toHaveBeenCalledTimes(1);
    const second = await POST(deliver("push", push, { delivery: "dup-1" }));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    expect(imports.syncStaticLink).toHaveBeenCalledTimes(1);
  });

  it("fails loudly when the delivery table is unavailable", async () => {
    db.rpcErrors["github_delivery_claim"] = {
      code: "42P01",
      message: "relation missing",
    };
    await expect(POST(deliver("push", push))).rejects.toThrow(/delivery claim failed/);
  });
});

describe("POST /api/inbound/github — push", () => {
  it("stages a draft for each matching static link and reports it", async () => {
    imports.linksForRepo.mockResolvedValue([
      link({ id: "yes" }),
      link({ id: "dev", branch: "dev" }),
      link({ id: "build", mode: "build", workflow_path: ".github/workflows/wzrd-create.yml" }),
    ]);
    const response = await POST(deliver("push", push));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, synced: ["alice-site"], failed: [] });
    expect(imports.linksForRepo).toHaveBeenCalledWith(expect.anything(), 123);
    expect(imports.syncStaticLink).toHaveBeenCalledTimes(1);
    expect(imports.syncStaticLink).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "yes" }),
      "b".repeat(40)
    );
  });

  it("does not sync a link from a different installation on the same repo", async () => {
    imports.linksForRepo.mockResolvedValue([link({ installation_id: 11 })]);
    const response = await POST(deliver("push", push));
    expect(await response.json()).toEqual({ ok: true, synced: [], failed: [] });
    expect(imports.syncStaticLink).not.toHaveBeenCalled();
  });

  it("answers 200 and names the link when a sync fails", async () => {
    imports.linksForRepo.mockResolvedValue([link({ id: "l-fail" })]);
    imports.syncStaticLink.mockRejectedValueOnce(new Error("zipball too large"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(deliver("push", push));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, synced: [], failed: ["l-fail"] });
    spy.mockRestore();
  });

  it("ignores a branch deletion", async () => {
    imports.linksForRepo.mockResolvedValue([link({})]);
    const response = await POST(deliver("push", { ...push, deleted: true, after: "0".repeat(40) }));
    expect(await response.json()).toEqual({ ok: true, synced: [], failed: [] });
    expect(imports.syncStaticLink).not.toHaveBeenCalled();
  });

  it("400 on a malformed push (non-sha head)", async () => {
    expect((await POST(deliver("push", { ...push, after: "HEAD" }))).status).toBe(400);
  });
});

describe("POST /api/inbound/github — installation lifecycle", () => {
  it.each([
    ["deleted", { removed_at: expect.any(String) }],
    ["suspend", { suspended_at: expect.any(String) }],
    ["unsuspend", { suspended_at: null }],
  ])("marks the installation on %s", async (action, patch) => {
    const response = await POST(deliver("installation", { action, installation: { id: 10 } }));
    expect(response.status).toBe(200);
    expect(imports.markInstallation).toHaveBeenCalledWith(expect.anything(), 10, patch);
  });

  it("leaves the row alone on other installation actions", async () => {
    await POST(deliver("installation", { action: "new_permissions_accepted", installation: { id: 10 } }));
    expect(imports.markInstallation).not.toHaveBeenCalled();
  });

  it("drops the links of repositories removed from the installation", async () => {
    const response = await POST(
      deliver("installation_repositories", {
        action: "removed",
        installation: { id: 10 },
        repositories_removed: [{ id: 123 }, { id: 124 }],
      })
    );
    expect(response.status).toBe(200);
    const deleted = db.deletes
      .filter((d) => d.table === "github_repo_links")
      .flatMap((d) => d.rows);
    expect(deleted.map((r) => r["repo_id"])).toEqual([123, 124]);
    expect(deleted.every((r) => r["installation_id"] === 10)).toBe(true);
    expect(db.rows("github_repo_links")).toEqual([
      expect.objectContaining({ installation_id: 10, repo_id: 999 }),
      expect.objectContaining({ installation_id: 11, repo_id: 123 }),
    ]);
  });

  it("acknowledges and ignores unrelated events", async () => {
    const response = await POST(deliver("star", { action: "created" }));
    expect(await response.json()).toEqual({ ok: true, ignored: "star" });
  });
});

describe("POST /api/inbound/github — failed handlers", () => {
  it("releases the delivery when the handler throws, so a redelivery is processed", async () => {
    imports.markInstallation.mockRejectedValueOnce(new Error("db down"));
    const body = { action: "deleted", installation: { id: 10 } };
    await expect(POST(deliver("installation", body, { delivery: "d-retry" }))).rejects.toThrow("db down");
    expect(releasedIds()).toEqual(["d-retry"]);
    expect(deliveryRow("d-retry")).toBeUndefined();

    const retry = await POST(deliver("installation", body, { delivery: "d-retry" }));
    expect(await retry.json()).toEqual({ ok: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(2);
  });

  it("releases the delivery when the push lookup throws", async () => {
    imports.linksForRepo.mockRejectedValueOnce(new Error("lookup failed"));
    await expect(POST(deliver("push", push, { delivery: "d-push" }))).rejects.toThrow("lookup failed");
    expect(releasedIds()).toEqual(["d-push"]);
  });

  it("marks a fully processed delivery final: a redelivery is a duplicate even after the lease", async () => {
    await POST(deliver("installation", { action: "deleted", installation: { id: 10 } }, { delivery: "d-done" }));
    expect(releasedIds()).toEqual([]);
    expect(markSuccesses).toEqual(["d-done"]);
    expect(deliveryRow("d-done")?.["processed_at"]).not.toBeNull();

    backdate("d-done", 3600_000);
    const again = await POST(deliver("installation", { action: "deleted", installation: { id: 10 } }, { delivery: "d-done" }));
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(1);
  });

  it("a failed release cannot acknowledge the redelivery forever: the lease expires and it runs", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    imports.markInstallation.mockRejectedValueOnce(new Error("db down"));
    db.opErrors["github_deliveries:delete"] = {
      code: "XX000",
      message: "connection reset",
    };
    const body = { action: "deleted", installation: { id: 10 } };
    await expect(POST(deliver("installation", body, { delivery: "d-stuck" }))).rejects.toThrow("db down");
    expect(releasedIds()).toEqual([]);
    expect(deliveryRow("d-stuck")).toMatchObject({ processed_at: null });
    spy.mockRestore();

    // While the lease is live the redelivery waits (the attempt may still be running)…
    const early = await POST(deliver("installation", body, { delivery: "d-stuck" }));
    expect(await early.json()).toEqual({ ok: true, duplicate: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(1);

    // …and once it has run out, the unfinished row is taken over and processed.
    delete db.opErrors["github_deliveries:delete"];
    backdate("d-stuck", 16 * 60_000);
    const retry = await POST(deliver("installation", body, { delivery: "d-stuck" }));
    expect(await retry.json()).toEqual({ ok: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(2);
    expect(markSuccesses).toEqual(["d-stuck"]);

    const done = await POST(deliver("installation", body, { delivery: "d-stuck" }));
    expect(await done.json()).toEqual({ ok: true, duplicate: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(2);
  });

  it("a row from before 0091 stays the permanent acknowledgement it was: stamped final by the migration, never replayed", async () => {
    // The pre-lease route recorded no outcome, so 0091 stamps every existing row
    // processed; a stale suspend redelivered past the lease must not land.
    const migrated = new Date(Date.now() - 3 * 86_400_000).toISOString();
    db.rows("github_deliveries").push({
      delivery_id: "d-old",
      event: "installation",
      received_at: migrated,
      processed_at: migrated,
    });
    const again = await POST(
      deliver("installation", { action: "suspend", installation: { id: 10 } }, { delivery: "d-old" })
    );
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    expect(imports.markInstallation).not.toHaveBeenCalled();

    // A lost old event is replayed by deleting its row: the redelivery is a fresh claim.
    db.tables["github_deliveries"] = db
      .rows("github_deliveries")
      .filter((r) => r["delivery_id"] !== "d-old");
    const replay = await POST(
      deliver("installation", { action: "suspend", installation: { id: 10 } }, { delivery: "d-old" })
    );
    expect(await replay.json()).toEqual({ ok: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(1);
    expect(markSuccesses).toEqual(["d-old"]);
  });

  it("retries the final mark, so a transient failure still makes the redelivery a duplicate", async () => {
    failCompletes = 2;
    await POST(deliver("installation", { action: "deleted", installation: { id: 10 } }, { delivery: "d-flaky" }));
    expect(markAttempts).toHaveLength(3);
    expect(markSuccesses).toEqual(["d-flaky"]);

    backdate("d-flaky", 3600_000);
    const again = await POST(deliver("installation", { action: "deleted", installation: { id: 10 } }, { delivery: "d-flaky" }));
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(1);
  });

  it("a lost final mark cannot stage a push twice: the synced head makes the re-run a no-op", async () => {
    // The sync stamps the link's head; the final mark then fails for good.
    // After the lease the redelivery is taken over and runs the handler again,
    // which finds every link already at this head and stages nothing.
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const stamped = link({ id: "l-1" });
    imports.linksForRepo.mockResolvedValue([stamped]);
    imports.syncStaticLink.mockImplementationOnce(async () => {
      stamped.last_sha = push.after;
      return { slug: "alice-site", version: "v1", sha: push.after, findings: [] };
    });
    failCompletes = 3;
    const first = await POST(deliver("push", push, { delivery: "d-lost" }));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, synced: ["alice-site"], failed: [] });
    expect(markAttempts).toHaveLength(3);
    expect(deliveryRow("d-lost")).toMatchObject({ processed_at: null });
    spy.mockRestore();

    backdate("d-lost", 16 * 60_000);
    const again = await POST(deliver("push", push, { delivery: "d-lost" }));
    expect(await again.json()).toEqual({ ok: true, synced: [], failed: [] });
    expect(imports.syncStaticLink).toHaveBeenCalledTimes(1);
    expect(markSuccesses).toEqual(["d-lost"]);
  });

  it("a link already at the pushed head is not staged again", async () => {
    imports.linksForRepo.mockResolvedValue([link({ id: "same", last_sha: push.after }), link({ id: "behind" })]);
    const response = await POST(deliver("push", push));
    expect(await response.json()).toEqual({ ok: true, synced: ["alice-site"], failed: [] });
    expect(imports.syncStaticLink).toHaveBeenCalledTimes(1);
    expect(imports.syncStaticLink).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "behind" }),
      push.after
    );
  });

  it("keeps the claim when a static sync fails (recorded on the link, 200 to GitHub)", async () => {
    imports.linksForRepo.mockResolvedValue([link({})]);
    imports.syncStaticLink.mockRejectedValueOnce(new Error("zipball too large"));
    const response = await POST(deliver("push", push, { delivery: "d-sync" }));
    expect(response.status).toBe(200);
    expect(releasedIds()).toEqual([]);
    expect(markSuccesses).toEqual(["d-sync"]);
  });
});
