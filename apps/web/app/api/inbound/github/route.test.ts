/**
 * GitHub App webhook: signature before anything else, one delivery id once,
 * then only the events that matter reach the import layer. A failed sync
 * still answers 200 (GitHub does not retry; the next push is the retry),
 * while a handler that throws gives the delivery id back so a redelivery
 * runs it again instead of being called a duplicate — and when even that
 * release fails, the lease on the id expires so the redelivery still runs.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RepoLink } from "@/lib/create/import";

const db = vi.hoisted(() => ({
  /** github_deliveries rows: lease start + whether the attempt finished. */
  deliveries: new Map<string, { received_at: number; processed_at: number | null }>(),
  claimError: null as { code: string; message: string } | null,
  releaseError: null as { code: string; message: string } | null,
  deleted: [] as { installation: number; repos: number[] }[],
  released: [] as string[],
  completed: [] as string[],
}));

vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      // The 0091 RPC: insert, or take over an unfinished row whose lease
      // has run out; a processed row or a live lease refuses.
      rpc: async (
        fn: string,
        args: { p_delivery_id: string; p_event: string; p_lease_seconds: number }
      ) => {
        if (fn !== "github_delivery_claim") throw new Error(`unexpected rpc ${fn}`);
        if (db.claimError) return { data: null, error: db.claimError };
        const now = Date.now();
        const row = db.deliveries.get(args.p_delivery_id);
        if (row) {
          const expired = row.received_at < now - args.p_lease_seconds * 1000;
          if (row.processed_at !== null || !expired) return { data: false, error: null };
        }
        db.deliveries.set(args.p_delivery_id, { received_at: now, processed_at: null });
        return { data: true, error: null };
      },
      from(table: string) {
        if (table === "github_deliveries") {
          return {
            update(patch: { processed_at: string }) {
              return {
                eq: async (_col: string, value: string) => {
                  const row = db.deliveries.get(value);
                  if (row) row.processed_at = Date.parse(patch.processed_at);
                  db.completed.push(value);
                  return { error: null };
                },
              };
            },
            delete() {
              return {
                eq: async (_col: string, value: string) => {
                  if (db.releaseError) return { error: db.releaseError };
                  db.released.push(value);
                  db.deliveries.delete(value);
                  return { error: null };
                },
              };
            },
          };
        }
        if (table === "github_repo_links") {
          let installation = 0;
          return {
            delete() {
              return this;
            },
            eq(_col: string, value: number) {
              installation = value;
              return this;
            },
            in: async (_col: string, repos: number[]) => {
              db.deleted.push({ installation, repos });
              return { error: null };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    }) as unknown as SupabaseClient,
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
  db.deliveries.clear();
  db.claimError = null;
  db.releaseError = null;
  db.deleted.length = 0;
  db.released.length = 0;
  db.completed.length = 0;
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
    expect(db.deliveries.size).toBe(0);
  });

  it.each([
    ["missing", { signature: null }],
    ["wrong secret", { secret: "other" }],
    ["malformed", { signature: "sha256=nope" }],
  ])("401 on a %s signature and writes nothing", async (_label, options) => {
    const response = await POST(deliver("push", push, options));
    expect(response.status).toBe(401);
    expect(db.deliveries.size).toBe(0);
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
    expect(db.deliveries.size).toBe(0);
  });

  it("400 without an event name", async () => {
    const request = deliver("", push);
    request.headers.delete("x-github-event");
    expect((await POST(request)).status).toBe(400);
  });

  it("400 on invalid JSON that was nonetheless signed", async () => {
    const response = await POST(deliver("push", null, { raw: "{not json" }));
    expect(response.status).toBe(400);
    expect(db.deliveries.size).toBe(0);
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
    db.claimError = { code: "42P01", message: "relation missing" };
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
    expect(db.deleted).toEqual([{ installation: 10, repos: [123, 124] }]);
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
    expect(db.released).toEqual(["d-retry"]);
    expect(db.deliveries.has("d-retry")).toBe(false);

    const retry = await POST(deliver("installation", body, { delivery: "d-retry" }));
    expect(await retry.json()).toEqual({ ok: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(2);
  });

  it("releases the delivery when the push lookup throws", async () => {
    imports.linksForRepo.mockRejectedValueOnce(new Error("lookup failed"));
    await expect(POST(deliver("push", push, { delivery: "d-push" }))).rejects.toThrow("lookup failed");
    expect(db.released).toEqual(["d-push"]);
  });

  it("marks a fully processed delivery final: a redelivery is a duplicate even after the lease", async () => {
    await POST(deliver("installation", { action: "deleted", installation: { id: 10 } }, { delivery: "d-done" }));
    expect(db.released).toEqual([]);
    expect(db.completed).toEqual(["d-done"]);
    expect(db.deliveries.get("d-done")?.processed_at).not.toBeNull();

    db.deliveries.get("d-done")!.received_at -= 3600_000;
    const again = await POST(deliver("installation", { action: "deleted", installation: { id: 10 } }, { delivery: "d-done" }));
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(1);
  });

  it("a failed release cannot acknowledge the redelivery forever: the lease expires and it runs", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    imports.markInstallation.mockRejectedValueOnce(new Error("db down"));
    db.releaseError = { code: "XX000", message: "connection reset" };
    const body = { action: "deleted", installation: { id: 10 } };
    await expect(POST(deliver("installation", body, { delivery: "d-stuck" }))).rejects.toThrow("db down");
    expect(db.released).toEqual([]);
    expect(db.deliveries.get("d-stuck")).toMatchObject({ processed_at: null });
    spy.mockRestore();

    // While the lease is live the redelivery waits (the attempt may still be running)…
    const early = await POST(deliver("installation", body, { delivery: "d-stuck" }));
    expect(await early.json()).toEqual({ ok: true, duplicate: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(1);

    // …and once it has run out, the unfinished row is taken over and processed.
    db.releaseError = null;
    db.deliveries.get("d-stuck")!.received_at -= 16 * 60_000;
    const retry = await POST(deliver("installation", body, { delivery: "d-stuck" }));
    expect(await retry.json()).toEqual({ ok: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(2);
    expect(db.completed).toEqual(["d-stuck"]);

    const done = await POST(deliver("installation", body, { delivery: "d-stuck" }));
    expect(await done.json()).toEqual({ ok: true, duplicate: true });
    expect(imports.markInstallation).toHaveBeenCalledTimes(2);
  });

  it("keeps the claim when a static sync fails (recorded on the link, 200 to GitHub)", async () => {
    imports.linksForRepo.mockResolvedValue([link({})]);
    imports.syncStaticLink.mockRejectedValueOnce(new Error("zipball too large"));
    const response = await POST(deliver("push", push, { delivery: "d-sync" }));
    expect(response.status).toBe(200);
    expect(db.released).toEqual([]);
    expect(db.completed).toEqual(["d-sync"]);
  });
});
