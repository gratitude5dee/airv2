/**
 * Account deletion leaves no vendor resource behind (goal-create-v11 §11.7,
 * CR16, I6): every D1 database, KV namespace, runtime token and its
 * Outbound-KV copy owned by the user's apps is removed, the row is cleared
 * so a retry is a no-op, and a vendor 404 on retry is not an error.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const cf = vi.hoisted(() => ({
  deleteD1Database: vi.fn(async (_id: string) => undefined),
  deleteKvNamespace: vi.fn(async (_id: string) => undefined),
  deleteRuntimeKvValue: vi.fn(async (_key: string) => undefined),
}));

vi.mock("./cloudflare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cloudflare")>();
  return {
    ...actual,
    cloudflareConfigured: () => true,
    runtimeKvConfigured: () => true,
    deleteD1Database: cf.deleteD1Database,
    deleteKvNamespace: cf.deleteKvNamespace,
    deleteRuntimeKvValue: cf.deleteRuntimeKvValue,
  };
});

import { teardownBackends } from "./teardown";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;

function functionsRow(patch: Row): Row {
  return {
    app_id: "app-1",
    user_id: "user-1",
    script_name: "alice-rsvp",
    draft_script_name: "alice-rsvp-draft",
    d1_database_id: "d1-1",
    kv_namespace_id: "kv-1",
    egress: ["api.example.com"],
    secret_names: ["STRIPE_KEY"],
    ai_daily_cap_usd: 1,
    ai_spent_today_usd: 0,
    ai_spend_day: null,
    limits: { cpu_ms: 50, subrequests: 20 },
    status: "live",
    approved_manifest: { egress: ["api.example.com"], db: true, kv: true, dailyCapUsd: 1, secretNames: ["STRIPE_KEY"] },
    deployed_at: "2026-09-01T00:00:00.000Z",
    last_error: null,
    declared: null,
    declared_at: null,
    approved_at: "2026-09-01T00:00:00.000Z",
    runtime_token_id: "tok-1",
    secret_set_at: { STRIPE_KEY: { at: "2026-09-01T00:00:00.000Z", live: true, draft: true } },
    killed_at: null,
    killed_by: null,
    ...patch,
  };
}

function table(name: string) {
  const rows = (tables[name] ??= []);
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
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), b),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  };
  return b;
}

const supabase = { from: table } as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  tables = {
    miniapp_functions: [
      functionsRow({}),
      functionsRow({ app_id: "app-2", d1_database_id: "d1-2", kv_namespace_id: null, runtime_token_id: "tok-2" }),
      functionsRow({ app_id: "app-9", user_id: "user-2", d1_database_id: "d1-9", kv_namespace_id: "kv-9" }),
    ],
    miniapp_runtime_tokens: [
      { id: "tok-1", app_id: "app-1", revoked_at: null },
      { id: "tok-0", app_id: "app-1", revoked_at: "2026-08-01T00:00:00.000Z" },
      { id: "tok-2", app_id: "app-2", revoked_at: null },
      { id: "tok-9", app_id: "app-9", revoked_at: null },
    ],
  };
});

describe("teardownBackends", () => {
  it("deletes every D1, KV namespace and runtime token of the user's apps — and only theirs", async () => {
    const summary = await teardownBackends(supabase, "user-1");
    expect(summary).toEqual({ apps: 2, databases: 2, namespaces: 1 });
    expect(cf.deleteD1Database.mock.calls.map((c) => c[0]).sort()).toEqual(["d1-1", "d1-2"]);
    expect(cf.deleteKvNamespace.mock.calls.map((c) => c[0])).toEqual(["kv-1"]);
    expect(cf.deleteRuntimeKvValue.mock.calls.map((c) => c[0]).sort()).toEqual(["rt:tok-1", "rt:tok-2"]);

    const tokens = tables["miniapp_runtime_tokens"]!;
    expect(tokens.find((t) => t["id"] === "tok-1")!["revoked_at"]).not.toBeNull();
    expect(tokens.find((t) => t["id"] === "tok-2")!["revoked_at"]).not.toBeNull();
    expect(tokens.find((t) => t["id"] === "tok-9")!["revoked_at"]).toBeNull();

    const other = tables["miniapp_functions"]!.find((r) => r["app_id"] === "app-9")!;
    expect(other["d1_database_id"]).toBe("d1-9");
    expect(other["status"]).toBe("live");
  });

  it("clears the rows so nothing points at a deleted resource", async () => {
    await teardownBackends(supabase, "user-1");
    for (const row of tables["miniapp_functions"]!.filter((r) => r["user_id"] === "user-1")) {
      expect(row).toMatchObject({
        d1_database_id: null,
        kv_namespace_id: null,
        secret_names: [],
        secret_set_at: {},
        runtime_token_id: null,
        approved_manifest: null,
        status: "disabled",
        deployed_at: null,
      });
    }
  });

  it("is idempotent: a second run makes no vendor call", async () => {
    await teardownBackends(supabase, "user-1");
    vi.clearAllMocks();
    const again = await teardownBackends(supabase, "user-1");
    expect(again).toEqual({ apps: 2, databases: 0, namespaces: 0 });
    expect(cf.deleteD1Database).not.toHaveBeenCalled();
    expect(cf.deleteKvNamespace).not.toHaveBeenCalled();
    expect(cf.deleteRuntimeKvValue).not.toHaveBeenCalled();
  });

  it("a vendor failure surfaces (the caller returns a retryable 502) and leaves the row intact", async () => {
    cf.deleteD1Database.mockRejectedValueOnce(new Error("cloudflare 500"));
    await expect(teardownBackends(supabase, "user-1")).rejects.toThrow("cloudflare 500");
    const row = tables["miniapp_functions"]!.find((r) => r["app_id"] === "app-1")!;
    expect(row["d1_database_id"]).toBe("d1-1");
    expect(tables["miniapp_runtime_tokens"]!.find((t) => t["id"] === "tok-1")!["revoked_at"]).toBeNull();
  });
});
