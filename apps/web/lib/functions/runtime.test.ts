/**
 * Runtime-token rotation (§11.3, CR6): the secret goes to the Outbound KV
 * or nowhere; the active reference moves by compare-and-swap so two
 * rotations racing on one app never revoke each other's fresh token.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunctionsRow } from "./backend";

const cf = vi.hoisted(() => ({
  configured: true,
  kv: new Map<string, string>(),
}));

vi.mock("./cloudflare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cloudflare")>();
  return {
    ...actual,
    runtimeKvConfigured: () => cf.configured,
    putRuntimeKvValue: async (key: string, value: string) => {
      cf.kv.set(key, value);
    },
    deleteRuntimeKvValue: async (key: string) => {
      cf.kv.delete(key);
    },
    hasRuntimeKvValue: async (key: string) => cf.kv.has(key),
  };
});

import { ensureRuntimeToken, rotateRuntimeToken, runtimeTokenKey } from "./runtime";
import { approvalDeployed } from "./approval";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let clock = 0;
let seq = 0;

/** Optional hook run between a rotation's insert and its CAS (to interleave). */
let afterInsert: (() => Promise<void>) | null = null;

function table(name: string) {
  const rows = (tables[name] ??= []);
  const filters: Array<(r: Row) => boolean> = [];
  let patch: Row | null = null;
  let insert: Row | null = null;
  let single = false;
  const run = async () => {
    if (insert) {
      const row = { id: `tok-${++seq}`, created_at: String(++clock).padStart(6, "0"), revoked_at: null, ...insert };
      rows.push(row);
      if (afterInsert) {
        const hook = afterInsert;
        afterInsert = null;
        await hook();
      }
      return { data: single ? row : [row], error: null };
    }
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (patch) for (const r of hit) Object.assign(r, patch);
    return { data: single ? (hit[0] ?? null) : hit, error: null };
  };
  const b: Row = {
    select: () => b,
    insert: (r: Row) => ((insert = r), b),
    update: (p: Row) => ((patch = p), b),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), b),
    is: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    lt: (k: string, v: string) => (filters.push((r) => String(r[k]) < v), b),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), b),
    single: () => ((single = true), run()),
    maybeSingle: () => ((single = true), run()),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      run().then(resolve, reject),
  };
  return b;
}

const supabase = { from: table } as unknown as SupabaseClient;

const active = () =>
  (tables["miniapp_runtime_tokens"] ?? []).filter((r) => r["revoked_at"] === null).map((r) => r["id"]);

beforeEach(() => {
  cf.configured = true;
  cf.kv.clear();
  clock = 0;
  seq = 0;
  afterInsert = null;
  tables["miniapp_runtime_tokens"] = [];
  tables["miniapp_functions"] = [{ app_id: "app-1", runtime_token_id: null }];
});

describe("rotateRuntimeToken", () => {
  it("mints, writes the secret only to the runtime KV, and points the app at the new token", async () => {
    const { tokenId } = await rotateRuntimeToken(supabase, "app-1", "user-1");
    expect(tables["miniapp_functions"]![0]!["runtime_token_id"]).toBe(tokenId);
    expect(cf.kv.get(runtimeTokenKey(tokenId))).toMatch(/^art_/);
    const row = tables["miniapp_runtime_tokens"]!.find((r) => r["id"] === tokenId)!;
    expect(row["token_hash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(cf.kv.get(runtimeTokenKey(tokenId)));
  });

  it("a second rotation revokes the first and drops its KV copy", async () => {
    const first = (await rotateRuntimeToken(supabase, "app-1", "user-1")).tokenId;
    const second = (await rotateRuntimeToken(supabase, "app-1", "user-1")).tokenId;
    expect(active()).toEqual([second]);
    expect(cf.kv.has(runtimeTokenKey(first))).toBe(false);
    expect(cf.kv.has(runtimeTokenKey(second))).toBe(true);
    expect(tables["miniapp_functions"]![0]!["runtime_token_id"]).toBe(second);
  });

  it("refuses without a runtime KV, persisting nothing", async () => {
    cf.configured = false;
    await expect(rotateRuntimeToken(supabase, "app-1", "user-1")).rejects.toMatchObject({ status: 503 });
    expect(tables["miniapp_runtime_tokens"]).toEqual([]);
    expect(tables["miniapp_functions"]![0]!["runtime_token_id"]).toBeNull();
  });

  it("two rotations racing leave exactly one active token, the one the app points at", async () => {
    const original = (await rotateRuntimeToken(supabase, "app-1", "user-1")).tokenId;
    // B inserts and completes while A sits between its insert and its CAS.
    let b: Promise<{ tokenId: string }> | null = null;
    afterInsert = async () => {
      b = rotateRuntimeToken(supabase, "app-1", "user-1");
      await b;
    };
    const a = await rotateRuntimeToken(supabase, "app-1", "user-1");
    const bResult = await b!;
    const pointer = tables["miniapp_functions"]![0]!["runtime_token_id"];
    expect(active()).toEqual([pointer]);
    expect(a.tokenId).toBe(pointer);
    expect(bResult.tokenId).toBe(pointer);
    expect(pointer).not.toBe(original);
    expect([...cf.kv.keys()]).toEqual([runtimeTokenKey(pointer as string)]);
  });
});

describe("ensureRuntimeToken", () => {
  const rowFor = (tokenId: string | null) =>
    ({ app_id: "app-1", user_id: "user-1", runtime_token_id: tokenId }) as unknown as FunctionsRow;

  it("keeps an active token the Outbound Worker can resolve", async () => {
    const first = (await rotateRuntimeToken(supabase, "app-1", "user-1")).tokenId;
    expect(await ensureRuntimeToken(supabase, rowFor(first))).toBe(first);
    expect(active()).toEqual([first]);
  });

  it("rotates an active token whose secret never reached the runtime KV", async () => {
    // A token minted before the runtime KV existed: a DB row, no KV value.
    tables["miniapp_runtime_tokens"]!.push({
      id: "legacy",
      app_id: "app-1",
      created_at: "000000",
      revoked_at: null,
      token_hash: "0".repeat(64),
    });
    tables["miniapp_functions"]![0]!["runtime_token_id"] = "legacy";
    const ref = await ensureRuntimeToken(supabase, rowFor("legacy"));
    expect(ref).not.toBe("legacy");
    expect(active()).toEqual([ref]);
    expect(cf.kv.has(runtimeTokenKey(ref))).toBe(true);
    expect(tables["miniapp_functions"]![0]!["runtime_token_id"]).toBe(ref);
  });
});

describe("approvalDeployed", () => {
  const base = {
    app_id: "app-1",
    user_id: "user-1",
    script_name: "a",
    draft_script_name: "a-draft",
    d1_database_id: null,
    kv_namespace_id: null,
    egress: [],
    secret_names: [],
    ai_daily_cap_usd: 1,
    ai_spent_today_usd: 0,
    ai_spend_day: null,
    limits: { cpu_ms: 50, subrequests: 20 },
    status: "live",
    approved_manifest: { egress: [], db: false, kv: false, dailyCapUsd: 1, secretNames: [] },
    deployed_at: "2026-09-05T00:00:10.000Z",
    last_error: null,
    declared: { entry: "functions/index.ts", db: false, kv: false, egress: [], ai: { dailyCapUsd: 1 } },
    declared_at: "2026-09-05T00:00:00.000Z",
    approved_at: "2026-09-05T00:00:05.000Z",
    runtime_token_id: "tok-1",
    secret_set_at: {},
    killed_at: null,
    killed_by: null,
  } as unknown as FunctionsRow;

  it("is true only when the approval's deploy finished cleanly", () => {
    expect(approvalDeployed(base)).toBe(true);
    expect(approvalDeployed({ ...base, deployed_at: null })).toBe(false);
    expect(approvalDeployed({ ...base, last_error: "promote failed" })).toBe(false);
    expect(approvalDeployed({ ...base, deployed_at: "2026-09-05T00:00:01.000Z" })).toBe(false);
    expect(approvalDeployed({ ...base, status: "draft" })).toBe(false);
  });
});
