/**
 * MC5 (goal-create-v11 §11.3, §19 "Functions"): the control-plane side of
 * `https://air.internal/v1/*`. Only a live runtime token gets in; the role
 * the Dispatcher stamped decides what a caller may write; action names come
 * from the running version's manifest; media goes through the same guard as
 * the Apps API. Every call leaves one content-free `fn_request` row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunctionsRow } from "@/lib/functions/backend";
import type { RuntimePrincipal } from "@/lib/functions/runtime";

const today = new Date().toISOString().slice(0, 10);

function functionsRow(appId: string): FunctionsRow {
  return {
    app_id: appId,
    user_id: "user-1",
    script_name: appId,
    draft_script_name: `${appId}-draft`,
    d1_database_id: null,
    kv_namespace_id: null,
    egress: [],
    secret_names: [],
    ai_daily_cap_usd: 1,
    ai_spent_today_usd: 0,
    ai_spend_day: today,
    limits: { cpu_ms: 50, subrequests: 20 },
    status: "live",
    approved_manifest: { egress: [], db: false, kv: false, dailyCapUsd: 1, secretNames: [] },
    deployed_at: null,
    last_error: null,
    declared: null,
    declared_at: null,
    approved_at: null,
    runtime_token_id: `tok-${appId}`,
    secret_set_at: {},
    killed_at: null,
    killed_by: null,
  };
}

const tokens: Record<string, RuntimePrincipal> = {
  art_a: { tokenId: "tok-a", appId: "app-a", userId: "user-1", slug: "u-a", functions: functionsRow("app-a") },
  art_b: { tokenId: "tok-b", appId: "app-b", userId: "user-1", slug: "u-b", functions: functionsRow("app-b") },
};

const docs = new Map<string, unknown>();
const opsRows: { kind: string; ref: string }[] = [];
const manifests: Record<string, unknown> = {
  "apps/u-a/v1/manifest.json": { actions: ["rsvp", "admin.reset"], guestActions: ["rsvp"] },
};
const uploaded: { key: string; bytes: number }[] = [];
/** In-memory user_buckets row + the 0100 RPCs: check and charge are one step. */
const quota = { bytes_used: 0, quota_bytes: 1024 * 1024 };
let putFails = false;

function rpc(name: string, args: Record<string, unknown>): { data: unknown; error: null } {
  const bytes = Number(args["p_bytes"]);
  if (name === "user_bucket_reserve") {
    if (bytes >= 0 && quota.bytes_used + bytes <= quota.quota_bytes) {
      quota.bytes_used += bytes;
      return { data: true, error: null };
    }
    return { data: false, error: null };
  }
  if (name === "user_bucket_release") {
    quota.bytes_used = Math.max(quota.bytes_used - bytes, 0);
    return { data: quota.bytes_used, error: null };
  }
  throw new Error(`unexpected rpc ${name}`);
}

// Action-log leases (0101) resolve in memory; the Box is always awake.
const leases = new Map<string, string>();
vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (fn.startsWith("user_bucket_")) return rpc(fn, args);
        const key = `${args["p_user_id"]}/${args["p_app"]}/${args["p_resource"]}`;
        if (fn === "miniapp_state_lease") {
          const held = leases.get(key);
          if (held && held !== args["p_holder"]) return { data: false, error: null };
          leases.set(key, String(args["p_holder"]));
          return { data: true, error: null };
        }
        if (fn === "miniapp_state_release") {
          const freed = leases.get(key) === args["p_holder"];
          if (freed) leases.delete(key);
          return { data: freed, error: null };
        }
        return { data: null, error: { message: `unknown rpc ${fn}` } };
      },
    }) as unknown as SupabaseClient,
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
}));
vi.mock("@/lib/functions/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/functions/runtime")>();
  return {
    ...actual,
    authenticateRuntimeToken: vi.fn(async (_s: unknown, bearer: string) => tokens[bearer] ?? null),
  };
});
vi.mock("@/lib/miniapps/store", () => ({
  readAppState: vi.fn(async (_s: unknown, userId: string, app: string, resource: string) =>
    docs.get(`${userId}/${app}/${resource}`) ?? {}
  ),
  writeAppState: vi.fn(
    async (_s: unknown, userId: string, app: string, resource: string, state: unknown) => {
      docs.set(`${userId}/${app}/${resource}`, state);
    }
  ),
  // Box-scoped twins used under the action-log lease; box-1 is user-1's Box.
  readAppStateFrom: vi.fn(async (_box: string, app: string, resource: string) =>
    docs.get(`user-1/${app}/${resource}`) ?? {}
  ),
  writeAppStateTo: vi.fn(async (_box: string, app: string, resource: string, state: unknown) => {
    docs.set(`user-1/${app}/${resource}`, state);
  }),
}));
vi.mock("@/lib/security/limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/limits")>();
  return {
    ...actual,
    recordOpsEvent: vi.fn(async (_s: unknown, kind: string, _u: string, ref: string) => {
      opsRows.push({ kind, ref });
    }),
    uploadRateLimited: vi.fn(async () => false),
  };
});
vi.mock("@/lib/storage/r2", () => ({
  r2Configured: () => true,
  getObject: vi.fn(async (key: string) =>
    key in manifests ? { body: Buffer.from(JSON.stringify(manifests[key])) } : null
  ),
  putObject: vi.fn(async (key: string, bytes: Buffer) => {
    const fail = putFails;
    // Yield so a racing upload's reserve runs before this put settles.
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (fail) throw new Error("r2 down");
    uploaded.push({ key, bytes: bytes.length });
  }),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));
vi.mock("@/lib/storage/buckets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage/buckets")>();
  return {
    ...actual,
    ensureUserBucket: vi.fn(async () => ({
      user_id: "user-1",
      prefix: "u/alice/",
      bytes_used: quota.bytes_used,
      quota_bytes: quota.quota_bytes,
    })),
  };
});

import { NextRequest } from "next/server";
import { GET as stateGet, PUT as statePut } from "./state/route";
import { POST as actionsPost } from "./actions/route";
import { POST as mediaPost } from "./media/route";
import { guardMediaUpload } from "@/lib/storage/guard";

function req(
  url: string,
  init: { method?: string; bearer?: string; role?: string; app?: string; version?: string; body?: string | Buffer; type?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {};
  if (init.bearer) headers["authorization"] = `Bearer ${init.bearer}`;
  if (init.role) headers["X-Air-Role"] = init.role;
  if (init.app) headers["X-Air-App"] = init.app;
  if (init.version) headers["X-Air-Version"] = init.version;
  if (init.type) headers["content-type"] = init.type;
  if (init.body !== undefined) headers["content-length"] = String(Buffer.byteLength(init.body));
  const body = init.body === undefined ? undefined : new Uint8Array(Buffer.from(init.body));
  return new NextRequest(url, {
    method: init.method ?? (body === undefined ? "GET" : "POST"),
    headers,
    ...(body !== undefined ? { body } : {}),
  });
}

beforeEach(() => {
  docs.clear();
  opsRows.length = 0;
  uploaded.length = 0;
  quota.bytes_used = 0;
  quota.quota_bytes = 1024 * 1024;
  putFails = false;
});
afterEach(() => vi.unstubAllGlobals());

describe("/api/functions/state", () => {
  it("rejects a missing or unknown runtime token without a hint", async () => {
    const none = await stateGet(req("https://air.test/api/functions/state?resource=guests"));
    expect(none.status).toBe(401);
    const bad = await stateGet(
      req("https://air.test/api/functions/state?resource=guests", { bearer: "art_nope" })
    );
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: "unauthorized" });
    expect(opsRows).toEqual([]);
  });

  it("owner writes, guest reads, guest cannot write; the ring holds only slug:status", async () => {
    const put = await statePut(
      req("https://air.test/api/functions/state?resource=guests", {
        method: "PUT",
        bearer: "art_a",
        role: "owner",
        body: JSON.stringify({ count: 2 }),
      })
    );
    expect(put.status).toBe(200);
    expect(put.headers.get("cache-control")).toBe("no-store");
    const guest = await stateGet(
      req("https://air.test/api/functions/state?resource=guests", { bearer: "art_a", role: "guest" })
    );
    expect(await guest.json()).toEqual({ state: { count: 2 } });
    const forbidden = await statePut(
      req("https://air.test/api/functions/state?resource=guests", {
        method: "PUT",
        bearer: "art_a",
        role: "guest",
        body: JSON.stringify({ count: 3 }),
      })
    );
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: "owner_only" });
    expect(docs.get("user-1/u-a/guests")).toEqual({ count: 2 });
    expect(opsRows).toEqual([
      { kind: "fn_request", ref: "u-a:200" },
      { kind: "fn_request", ref: "u-a:200" },
      { kind: "fn_request", ref: "u-a:403" },
    ]);
  });

  it("keys state by the token's app, so a forged X-Air-App cannot reach another app", async () => {
    docs.set("user-1/u-b/guests", { secret: "b" });
    const forged = await stateGet(
      req("https://air.test/api/functions/state?resource=guests", {
        bearer: "art_a",
        role: "owner",
        app: "u-b",
      })
    );
    expect(forged.status).toBe(401);
    const honest = await stateGet(
      req("https://air.test/api/functions/state?resource=guests", { bearer: "art_a", role: "owner" })
    );
    expect(await honest.json()).toEqual({ state: {} });
  });

  it("validates the resource id and bounds the body", async () => {
    const badResource = await stateGet(
      req("https://air.test/api/functions/state?resource=../etc", { bearer: "art_a" })
    );
    expect(badResource.status).toBe(400);
    const big = await statePut(
      req("https://air.test/api/functions/state?resource=guests", {
        method: "PUT",
        bearer: "art_a",
        role: "owner",
        body: "x".repeat(256 * 1024 + 1),
      })
    );
    expect(big.status).toBe(413);
    const notJson = await statePut(
      req("https://air.test/api/functions/state?resource=guests", {
        method: "PUT",
        bearer: "art_a",
        role: "owner",
        body: "{nope",
      })
    );
    expect(notJson.status).toBe(400);
    expect(await notJson.json()).toEqual({ error: "invalid_json" });
  });
});

describe("/api/functions/actions", () => {
  it("accepts only manifest-declared names, guests only guestActions, and appends to the log", async () => {
    const undeclared = await actionsPost(
      req("https://air.test/api/functions/actions", {
        bearer: "art_a",
        role: "owner",
        version: "v1",
        body: JSON.stringify({ action: "delete_everything" }),
      })
    );
    expect(undeclared.status).toBe(403);
    expect(await undeclared.json()).toEqual({ error: "undeclared_action" });

    const guestAdmin = await actionsPost(
      req("https://air.test/api/functions/actions", {
        bearer: "art_a",
        role: "guest",
        version: "v1",
        body: JSON.stringify({ action: "admin.reset" }),
      })
    );
    expect(guestAdmin.status).toBe(403);
    expect(await guestAdmin.json()).toEqual({ error: "guest_forbidden" });

    const ok = await actionsPost(
      req("https://air.test/api/functions/actions", {
        bearer: "art_a",
        role: "guest",
        version: "v1",
        body: JSON.stringify({ action: "rsvp", payload: { name: "Sam" } }),
      })
    );
    expect(ok.status).toBe(200);
    const log = docs.get("user-1/u-a/actions") as Array<Record<string, unknown>>;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "rsvp", payload: { name: "Sam" }, role: "guest", source: "functions" });
  });

  it("accepts nothing when no version manifest is known", async () => {
    const res = await actionsPost(
      req("https://air.test/api/functions/actions", {
        bearer: "art_a",
        role: "owner",
        body: JSON.stringify({ action: "rsvp" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("rejects malformed action names and oversized bodies", async () => {
    const bad = await actionsPost(
      req("https://air.test/api/functions/actions", {
        bearer: "art_a",
        role: "owner",
        version: "v1",
        body: JSON.stringify({ action: "RSVP now!" }),
      })
    );
    expect(bad.status).toBe(400);
    const big = await actionsPost(
      req("https://air.test/api/functions/actions", {
        bearer: "art_a",
        role: "owner",
        version: "v1",
        body: JSON.stringify({ action: "rsvp", payload: "x".repeat(16 * 1024) }),
      })
    );
    expect(big.status).toBe(413);
  });
});

describe("/api/functions/media", () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]);

  it("lets the owner upload under the owner's bucket and app prefix", async () => {
    const res = await mediaPost(
      req("https://air.test/api/functions/media", {
        bearer: "art_a",
        role: "owner",
        body: png,
        type: "image/png",
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; bytes: number; contentType: string };
    expect(body.contentType).toBe("image/png");
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]!.key).toMatch(/^u\/alice\/apps\/u-a\/[0-9a-f]{16}\.png$/);
    expect(body.url).toContain(uploaded[0]!.key);
  });

  it("refuses guests, oversized declarations, and disallowed types", async () => {
    const guest = await mediaPost(
      req("https://air.test/api/functions/media", { bearer: "art_a", role: "guest", body: png, type: "image/png" })
    );
    expect(guest.status).toBe(403);
    const html = await mediaPost(
      req("https://air.test/api/functions/media", {
        bearer: "art_a",
        role: "owner",
        body: "<script>alert(1)</script>",
        type: "text/html",
      })
    );
    expect(html.status).toBe(400);
    expect(await html.json()).toEqual({ error: "media_rejected" });
    expect(uploaded).toHaveLength(0);
    expect(opsRows.some((row) => row.kind === "upload_rejected")).toBe(true);
    expect(quota.bytes_used).toBe(0);
  });

  // The guard rewrites the PNG, so the reserved and charged size is the
  // sanitized length, not the request body.
  const stored = guardMediaUpload(png, "image/png").length;
  const upload = () =>
    mediaPost(
      req("https://air.test/api/functions/media", {
        bearer: "art_a",
        role: "owner",
        body: png,
        type: "image/png",
      })
    );

  it("charges the quota before the bytes reach R2 and keeps the charge after", async () => {
    const res = await upload();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { bytes: number }).bytes).toBe(stored);
    expect(uploaded[0]!.bytes).toBe(stored);
    expect(quota.bytes_used).toBe(stored);
  });

  it("refuses with 413 when the reservation would overflow, without touching R2", async () => {
    quota.quota_bytes = stored - 1;
    const res = await upload();
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "media_rejected" });
    expect(uploaded).toHaveLength(0);
    expect(quota.bytes_used).toBe(0);
    expect(opsRows.some((row) => row.kind === "upload_rejected")).toBe(true);
  });

  it("two uploads racing under a quota that fits one: exactly one lands", async () => {
    // Room for one PNG and a bit — the stale read-then-upload gate let both
    // through here because each saw bytes_used = 0.
    quota.quota_bytes = stored + 10;
    const [a, b] = await Promise.all([upload(), upload()]);
    expect([a.status, b.status].sort()).toEqual([200, 413]);
    expect(uploaded).toHaveLength(1);
    expect(quota.bytes_used).toBe(stored);
    expect(quota.bytes_used).toBeLessThanOrEqual(quota.quota_bytes);
  });

  it("eight concurrent uploads never overshoot the quota", async () => {
    quota.quota_bytes = stored * 3;
    const results = await Promise.all(Array.from({ length: 8 }, upload));
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(3);
    expect(results.filter((r) => r.status === 413)).toHaveLength(5);
    expect(uploaded).toHaveLength(3);
    expect(quota.bytes_used).toBe(stored * 3);
  });

  it("releases the reservation when the R2 put fails, so the next upload fits", async () => {
    quota.quota_bytes = stored;
    putFails = true;
    const failed = await upload();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "internal" });
    expect(uploaded).toHaveLength(0);
    expect(quota.bytes_used).toBe(0);
    putFails = false;
    const retry = await upload();
    expect(retry.status).toBe(200);
    expect(quota.bytes_used).toBe(stored);
  });

  it("a failed upload racing a live one gives its bytes back to the live one's successor", async () => {
    quota.quota_bytes = stored * 2;
    putFails = true;
    const first = upload();
    await new Promise((resolve) => setTimeout(resolve, 1));
    putFails = false;
    const second = upload();
    const [f, s] = await Promise.all([first, second]);
    expect(f.status).toBe(500);
    expect(s.status).toBe(200);
    expect(quota.bytes_used).toBe(stored);
    const third = await upload();
    expect(third.status).toBe(200);
    expect(quota.bytes_used).toBe(stored * 2);
    expect(uploaded).toHaveLength(2);
  });
});
