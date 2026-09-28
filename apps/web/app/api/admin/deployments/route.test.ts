/**
 * Admin deployments contract (V12 §12): bearer auth, parameter validation,
 * the DeploymentsResponse shape, app totals, the per-app join with the
 * latest build / version rows / Functions state, the channel and user_id
 * filters, the limit, and the Dispatcher probe (null when unconfigured,
 * false on a timeout, never a throw).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AdminFakeDb } from "@/lib/admin/testing/fakeDb";
import { makeApp } from "@/app/mini/loader-test-utils";

const db = vi.hoisted(() => ({ fake: null as unknown as { client(): unknown } }));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => db.fake.client() }));

const lane = vi.hoisted(() => ({ ready: false }));
vi.mock("@/lib/functions/deploy", () => ({
  appOriginLaneReady: () => lane.ready,
}));

const functions = vi.hoisted(() => ({
  loadFunctions: vi.fn<
    (supabase: unknown, appId: string) => Promise<{ status: string } | null>
  >(async () => null),
}));
vi.mock("@/lib/functions/backend", () => ({ loadFunctions: functions.loadFunctions }));

const fleet = vi.hoisted(() => ({
  listChannels: vi.fn(async () => [
    { name: "dev", release_id: "rel-1", template_box_id: null, updated_at: "2026-09-01T00:00:00.000Z" },
  ]),
}));
vi.mock("@/lib/fleet/channels", () => ({ listChannels: fleet.listChannels }));

vi.mock("@/lib/create/kit", () => ({
  kitVersion: () => "2026.09",
  restrictedConfig: () => ({ version: "b1", sha256: "0".repeat(64), key: "k" }),
}));

import { GET } from "./route";

const base = "https://air.test/api/admin/deployments";
const authed = (qs = "") =>
  new NextRequest(`${base}${qs}`, { headers: { authorization: "Bearer admin-key", "x-admin-operator": "carol" } });
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SHA = "a".repeat(64);
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function version(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: `ver-${String(overrides["version"])}`,
    app_id: "app-x",
    user_id: OWNER,
    version: "v1700000000001",
    lane: "vibe",
    bundle_sha256: SHA,
    bundle_bytes: 10,
    file_count: 1,
    worker_sha256: null,
    kit_version: "2026.09",
    functions: null,
    findings: [],
    qa_score: null,
    tests_total: null,
    tests_passed: null,
    mirrored_at: null,
    mirror_commit: null,
    created_at: "2026-09-01T00:00:00.000Z",
    published_at: null,
    retired_at: null,
    purged_at: null,
    ...overrides,
  };
}

let fake: AdminFakeDb;

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  delete process.env["VERCEL_GIT_COMMIT_SHA"];
  fake = new AdminFakeDb();
  db.fake = fake;
  lane.ready = false;
  functions.loadFunctions.mockResolvedValue(null);
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/admin/deployments", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("400s on a bad channel, limit or user_id", async () => {
    expect((await GET(authed("?channel=staging"))).status).toBe(400);
    expect((await GET(authed("?limit=0"))).status).toBe(400);
    expect((await GET(authed("?limit=501"))).status).toBe(400);
    expect((await GET(authed("?user_id=alice"))).status).toBe(400);
  });

  it("answers the platform facts with no apps", async () => {
    process.env["VERCEL_GIT_COMMIT_SHA"] = "abc1234";
    const body = await (await GET(authed())).json();
    expect(body).toEqual({
      control_plane: { git_sha: "abc1234", deployed_at: null, region: null },
      kit: { version: "2026.09", restricted_version: "b1" },
      dispatcher: { healthy: null, checked_at: null },
      channels: [expect.objectContaining({ name: "dev", release_id: "rel-1" })],
      apps: { total: 0, dev_live: 0, prod_live: 0, drafts_only: 0, expiring_7d: 0 },
      rows: [],
    });
  });

  it("joins each Create app with its build, versions and Functions state", async () => {
    const live = makeApp({
      id: "app-live",
      slug: "alice-shop",
      appname: "shop",
      publisher_username: "alice",
      owner_user_id: OWNER,
      lane: "vibe",
      status: "published",
      visibility: "public",
      listed_at: "2026-09-01T00:00:00.000Z",
      bundle_version: "v1700000000001",
      draft_version: "v1700000000002",
      dev_version: "v1700000000002",
      dev_expires_at: inDays(2),
      updated_at: "2026-09-03T00:00:00.000Z",
    });
    const draftOnly = makeApp({
      id: "app-draft",
      slug: "bob-notes",
      appname: "notes",
      publisher_username: "bob",
      owner_user_id: OTHER,
      lane: "drop",
      status: "draft",
      draft_version: "v1700000000003",
      updated_at: "2026-09-02T00:00:00.000Z",
    });
    const expired = makeApp({
      id: "app-old",
      slug: "carol-game",
      owner_user_id: OTHER,
      lane: "vibe",
      status: "draft",
      dev_version: "v1700000000004",
      dev_expires_at: inDays(-1),
      updated_at: "2026-09-01T00:00:00.000Z",
    });
    fake.tables["mini_apps"] = [
      live,
      draftOnly,
      expired,
      makeApp({ id: "first-party", slug: "browser", lane: null }),
    ] as unknown as Record<string, unknown>[];
    fake.tables["miniapp_versions"] = [
      version({ app_id: "app-live", version: "v1700000000001", worker_sha256: "b".repeat(64), qa_score: 80, mirrored_at: "2026-09-02T00:00:00.000Z" }),
      version({ app_id: "app-live", version: "v1700000000002", qa_score: 92, tests_total: 3, tests_passed: 2, created_at: "2026-09-02T00:00:00.000Z" }),
      version({ app_id: "app-draft", version: "v1700000000003", qa_score: 55 }),
    ];
    fake.tables["create_builds"] = [
      { id: "b1", app_id: "app-live", status: "succeeded", log: [], findings: [], sizes: null, version: "v1700000000002", error: null, started_at: "2026-09-02T00:00:00.000Z", finished_at: "2026-09-02T00:01:00.000Z" },
      { id: "b0", app_id: "app-live", status: "failed", log: [], findings: [{ file: "a", rule: "x", hint: "", severity: "hard" }], sizes: null, version: null, error: "hard findings", started_at: "2026-09-01T00:00:00.000Z", finished_at: "2026-09-01T00:01:00.000Z" },
      { id: "b2", app_id: "app-draft", status: "failed", log: [], findings: [{ file: "a", rule: "csp.host-reference", hint: "", severity: "hard" }, { file: "a", rule: "soft", hint: "" }], sizes: null, version: null, error: "hard findings", started_at: "2026-09-02T00:00:00.000Z", finished_at: null },
    ];
    functions.loadFunctions.mockImplementation(async (_supabase: unknown, appId: string) =>
      appId === "app-live" ? { status: "live" } : null
    );

    const body = await (await GET(authed())).json();
    expect(body.apps).toEqual({ total: 3, dev_live: 1, prod_live: 1, drafts_only: 2, expiring_7d: 1 });
    expect(body.rows.map((row: { slug: string }) => row.slug)).toEqual([
      "alice-shop",
      "bob-notes",
      "carol-game",
    ]);
    expect(body.rows[0]).toEqual({
      slug: "alice-shop",
      username: "alice",
      appname: "shop",
      lane: "vibe",
      status: "published",
      visibility: "public",
      listed: true,
      dev_version: "v1700000000002",
      dev_expires_at: live.dev_expires_at,
      live_version: "v1700000000001",
      draft_version: "v1700000000002",
      last_build: { status: "succeeded", finished_at: "2026-09-02T00:01:00.000Z", findings_hard: 0 },
      qa_score: 92,
      tests: { passed: 2, total: 3 },
      worker_sha256_prefix: "bbbbbbb",
      functions_status: "live",
      mirrored_at: "2026-09-02T00:00:00.000Z",
    });
    expect(body.rows[1]).toMatchObject({
      slug: "bob-notes",
      live_version: null,
      last_build: { status: "failed", finished_at: null, findings_hard: 1 },
      qa_score: 55,
      tests: null,
      worker_sha256_prefix: null,
      functions_status: "disabled",
      mirrored_at: null,
    });
    expect(body.rows[2]).toMatchObject({ slug: "carol-game", last_build: null, qa_score: null });
  });

  it("filters by channel and user_id and honours the limit", async () => {
    fake.tables["mini_apps"] = [
      makeApp({ id: "a", slug: "u-a", owner_user_id: OWNER, lane: "vibe", status: "published", bundle_version: "v1700000000001", updated_at: "2026-09-03T00:00:00.000Z" }),
      makeApp({ id: "b", slug: "u-b", owner_user_id: OWNER, lane: "vibe", status: "draft", dev_version: "v1700000000002", dev_expires_at: inDays(5), updated_at: "2026-09-02T00:00:00.000Z" }),
      makeApp({ id: "c", slug: "v-c", owner_user_id: OTHER, lane: "vibe", status: "draft", dev_version: "v1700000000003", dev_expires_at: inDays(5), updated_at: "2026-09-01T00:00:00.000Z" }),
    ] as unknown as Record<string, unknown>[];
    const dev = await (await GET(authed("?channel=dev"))).json();
    expect(dev.rows.map((row: { slug: string }) => row.slug)).toEqual(["u-b", "v-c"]);
    expect(dev.apps.total).toBe(3);
    const prod = await (await GET(authed("?channel=prod"))).json();
    expect(prod.rows.map((row: { slug: string }) => row.slug)).toEqual(["u-a"]);
    const limited = await (await GET(authed("?limit=1"))).json();
    expect(limited.rows).toHaveLength(1);
    expect(limited.apps.total).toBe(3);
    const owner = await (await GET(authed(`?user_id=${OWNER}`))).json();
    expect(owner.apps.total).toBe(2);
    expect(fake.filters).toContainEqual({
      table: "mini_apps",
      op: "eq",
      column: "owner_user_id",
      value: OWNER,
    });
  });

  it("probes the Dispatcher when the lane is configured and never throws", async () => {
    lane.ready = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true }) as Response)
    );
    let body = await (await GET(authed())).json();
    expect(body.dispatcher.healthy).toBe(true);
    expect(typeof body.dispatcher.checked_at).toBe("string");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      })
    );
    body = await (await GET(authed())).json();
    expect(body.dispatcher.healthy).toBe(false);
  });

  it("degrades to no channels and no apps when those reads fail", async () => {
    fleet.listChannels.mockRejectedValueOnce(new Error("channels down"));
    fake.errors["mini_apps"] = { message: "column lane does not exist" };
    const response = await GET(authed());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.channels).toEqual([]);
    expect(body.rows).toEqual([]);
  });
});
