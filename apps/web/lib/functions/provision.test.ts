/**
 * Per-app resources are created once (§11.1) and never orphaned (CR16):
 * the claim marker's nonce names the vendor resource, so a writer that died
 * between create and confirm leaves something the next build finds by name
 * and deletes before it claims again.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunctionsRow } from "./backend";

const cf = vi.hoisted(() => ({
  createD1Database: vi.fn<(name: string) => Promise<{ uuid: string }>>(),
  createKvNamespace: vi.fn<(title: string) => Promise<{ id: string }>>(),
  deleteD1Database: vi.fn<(id: string) => Promise<void>>(async () => undefined),
  deleteKvNamespace: vi.fn<(id: string) => Promise<void>>(async () => undefined),
  findD1Database: vi.fn<(name: string) => Promise<string | null>>(async () => null),
  findKvNamespace: vi.fn<(title: string) => Promise<string | null>>(async () => null),
}));

vi.mock("./cloudflare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cloudflare")>();
  return { ...actual, cloudflareConfigured: () => true, ...cf };
});

import { ensureResources, PENDING_PREFIX, PENDING_STALE_MS, vendorName } from "./provision";

type Row = Record<string, unknown>;
let rows: Row[];

function functionsRow(patch: Row): Row {
  return {
    app_id: "app-1",
    user_id: "user-1",
    script_name: "alice-rsvp",
    draft_script_name: "alice-rsvp-draft",
    d1_database_id: null,
    kv_namespace_id: null,
    egress: [],
    secret_names: [],
    ai_daily_cap_usd: 1,
    ai_spent_today_usd: 0,
    ai_spend_day: null,
    limits: { cpu_ms: 50, subrequests: 20 },
    status: "draft",
    approved_manifest: null,
    deployed_at: null,
    last_error: null,
    declared: null,
    declared_at: null,
    approved_at: null,
    runtime_token_id: null,
    secret_set_at: {},
    killed_at: null,
    killed_by: null,
    ...patch,
  };
}

function table() {
  const filters: Array<(r: Row) => boolean> = [];
  let patch: Row | null = null;
  const run = () => {
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (patch) for (const r of hit) Object.assign(r, patch);
    return { data: hit, error: null };
  };
  const b: Row = {
    select: () => b,
    update: (p: Row) => ((patch = p), b),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    is: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  };
  return b;
}

const supabase = {
  from: table,
  rpc: async () => ({ data: true, error: null }),
} as unknown as SupabaseClient;

const NOW = 1_800_000_000_000;

beforeEach(() => {
  vi.clearAllMocks();
  cf.findD1Database.mockResolvedValue(null);
  cf.findKvNamespace.mockResolvedValue(null);
  cf.createD1Database.mockImplementation(async (name) => ({ uuid: `uuid-of-${name}` }));
  cf.createKvNamespace.mockImplementation(async (title) => ({ id: `id-of-${title}` }));
  rows = [functionsRow({})];
});

describe("ensureResources", () => {
  it("creates each resource once under a name derived from the claim, and records the id", async () => {
    const out = await ensureResources(supabase, rows[0] as unknown as FunctionsRow, "alice-rsvp", { db: true, kv: true }, NOW);
    expect(cf.createD1Database).toHaveBeenCalledTimes(1);
    expect(cf.createKvNamespace).toHaveBeenCalledTimes(1);
    const dbName = cf.createD1Database.mock.calls[0]![0];
    expect(dbName).toMatch(/^air-alice-rsvp-db-[0-9a-f]{12}$/);
    expect(out.d1_database_id).toBe(`uuid-of-${dbName}`);
    expect(out.kv_namespace_id).toMatch(/^id-of-air-alice-rsvp-kv-/);
    expect(cf.deleteD1Database).not.toHaveBeenCalled();

    const again = await ensureResources(supabase, out, "alice-rsvp", { db: true, kv: true }, NOW);
    expect(again.d1_database_id).toBe(out.d1_database_id);
    expect(cf.createD1Database).toHaveBeenCalledTimes(1);
  });

  it("refuses while another writer's claim is fresh", async () => {
    rows[0]!["d1_database_id"] = `${PENDING_PREFIX}abcdefabcdef:${NOW - 1000}`;
    await expect(
      ensureResources(supabase, rows[0] as unknown as FunctionsRow, "alice-rsvp", { db: true, kv: false }, NOW)
    ).rejects.toMatchObject({ status: 409 });
    expect(cf.createD1Database).not.toHaveBeenCalled();
    expect(cf.findD1Database).not.toHaveBeenCalled();
  });

  it("deletes what a dead writer created before reclaiming its stale marker", async () => {
    const stale = `${PENDING_PREFIX}deadbeefcafe:${NOW - PENDING_STALE_MS - 1}`;
    rows[0]!["d1_database_id"] = stale;
    cf.findD1Database.mockImplementation(async (name) =>
      name === vendorName("db", "alice-rsvp", "deadbeefcafe") ? "orphan-uuid" : null
    );
    const out = await ensureResources(supabase, rows[0] as unknown as FunctionsRow, "alice-rsvp", { db: true, kv: false }, NOW);
    expect(cf.findD1Database).toHaveBeenCalledWith("air-alice-rsvp-db-deadbeefcafe");
    expect(cf.deleteD1Database).toHaveBeenCalledWith("orphan-uuid");
    expect(cf.createD1Database).toHaveBeenCalledTimes(1);
    expect(out.d1_database_id).not.toBe("orphan-uuid");
    expect(out.d1_database_id).not.toMatch(/^pending:/);
  });

  it("a stale marker whose resource never got created reclaims cleanly", async () => {
    rows[0]!["kv_namespace_id"] = `${PENDING_PREFIX}000000000000:${NOW - PENDING_STALE_MS - 1}`;
    const out = await ensureResources(supabase, rows[0] as unknown as FunctionsRow, "alice-rsvp", { db: false, kv: true }, NOW);
    expect(cf.findKvNamespace).toHaveBeenCalledWith("air-alice-rsvp-kv-000000000000");
    expect(cf.deleteKvNamespace).not.toHaveBeenCalled();
    expect(out.kv_namespace_id).toMatch(/^id-of-/);
  });

  it("deletes its own resource when the confirm loses the race", async () => {
    cf.createD1Database.mockImplementation(async (name) => {
      rows[0]!["d1_database_id"] = "someone-elses-uuid";
      return { uuid: `uuid-of-${name}` };
    });
    await expect(
      ensureResources(supabase, rows[0] as unknown as FunctionsRow, "alice-rsvp", { db: true, kv: false }, NOW)
    ).rejects.toMatchObject({ status: 409 });
    expect(cf.deleteD1Database).toHaveBeenCalledTimes(1);
    expect(String(cf.deleteD1Database.mock.calls[0]![0])).toMatch(/^uuid-of-air-alice-rsvp-db-/);
    expect(rows[0]!["d1_database_id"]).toBe("someone-elses-uuid");
  });
});
