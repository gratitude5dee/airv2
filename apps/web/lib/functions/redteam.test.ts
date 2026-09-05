/**
 * MC5 red team (goal-create-v11 §16, §19 "Functions"): what a hostile user
 * Worker can reach, what it can see, and what a planted secret value leaves
 * behind. The Outbound Worker runs here as a module with `fetch` mocked; the
 * control-plane side is exercised through the real helpers over an in-memory
 * PostgREST-style store. The gateway side of the same checks (unknown model,
 * independent per-app daily caps) lives in
 * app/api/gateway/v1/[...path]/route.app.test.ts.
 *
 * The real-namespace variant at the bottom talks to Cloudflare and is skipped
 * unless CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN are set.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import outbound, { egressAllowed } from "../../../../infra/workers/outbound/index.mjs";
import { functionsBindings, manifestFor, runtimeFor } from "./deploy";
import { appPrincipal, IDENTITY_HEADERS } from "./identity";
import { hashRuntimeToken, mintRuntimeToken } from "./tokens";
import { signManifest } from "./manifest";
import {
  backendDecisionPayload,
  parseFunctionsRow,
  type FunctionsRow,
} from "./backend";
import { egressHostRejection } from "./egress";
import { setSecret, summarizeSecrets } from "./secrets";
import {
  cloudflareConfigured,
  createKvNamespace,
  deleteKvNamespace,
  putDispatchScript,
} from "./cloudflare";
import { textContainsSecrets } from "@/lib/storage/guard";
import { findPlantedHits } from "@/lib/security/c18";
import type { RegistryApp } from "@/lib/miniapps/registry";

// ── planted values: every one of these must be absent from every store ─────
const PLANTED = {
  supabaseServiceKey: "eyJplantedServiceRoleKey.redteam.0123456789",
  r2Secret: "plantedR2SecretAccessKey0123456789abcdefXYZ",
  signingKey: "planted-app-origin-signing-key-redteam",
  cfToken: "plantedCloudflareApiToken_redteam_0001",
  providerKey: "sk-plantedProviderKeyRedteam0123456789abcdef",
  ownerSecret: "sk-ownerStripeLikeSecretRedteam9876543210zyxw",
};
const PLANTED_VALUES = Object.values(PLANTED);

// Captured before the planted values overwrite the environment.
const REAL_CLOUDFLARE = {
  accountId: process.env["CLOUDFLARE_ACCOUNT_ID"],
  apiToken: process.env["CLOUDFLARE_API_TOKEN"],
};

const PLATFORM_HOSTS = [
  "mini.wzrd.tech",
  "app.wzrd.tech",
  "alice-rsvp.apps.wzrd.tech",
  "box-alice.wzrd.tech",
  "abcdefghij.supabase.co",
  "api.cloudflare.com",
];

beforeEach(() => {
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = PLANTED.supabaseServiceKey;
  process.env["R2_SECRET_ACCESS_KEY"] = PLANTED.r2Secret;
  process.env["APP_ORIGIN_SIGNING_KEY"] = PLANTED.signingKey;
  process.env["MINIAPP_SIGNING_KEY"] = "mini-signing-key";
  process.env["CLOUDFLARE_ACCOUNT_ID"] = "acct-redteam";
  process.env["CLOUDFLARE_API_TOKEN"] = PLANTED.cfToken;
  process.env["OPENROUTER_API_KEY"] = PLANTED.providerKey;
  process.env["APPS_ORIGIN_SUFFIX"] = "apps.wzrd.tech";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Outbound Worker harness ────────────────────────────────────────────────
interface OutboundParams {
  app: string;
  owner_ref: string;
  principal: string;
  role: string;
  version: string;
  egress: string[];
  budget_usd: number;
  token_ref: string | null;
}

const RUNTIME_TOKEN = mintRuntimeToken();

function outboundEnv(params: Partial<OutboundParams> = {}, kv: Record<string, string> = {}) {
  const store = new Map(Object.entries(kv));
  return {
    CONTROL_PLANE_ORIGIN: "https://app.wzrd.tech",
    RUNTIME_TOKENS: { get: async (key: string) => store.get(key) ?? null },
    params: {
      app: "alice-rsvp",
      owner_ref: "p_owner",
      principal: "p_visitor",
      role: "guest",
      version: "v1",
      egress: [],
      budget_usd: 1,
      token_ref: "tok-ref-1",
      ...params,
    },
  };
}

function mockFetch(status = 200) {
  const calls: Request[] = [];
  const fn = vi.fn(async (input: Request | string, init?: RequestInit) => {
    calls.push(input instanceof Request ? input : new Request(input, init));
    return new Response(JSON.stringify({ ok: true }), {
      status,
      headers: { "content-type": "application/json", "set-cookie": "sb=1" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

const workerFetch = (request: Request, env: ReturnType<typeof outboundEnv>) =>
  outbound.fetch(request, env);

describe("Outbound Worker — egress is deny-by-default (CR7)", () => {
  it.each(PLATFORM_HOSTS)("a user Worker cannot reach %s", async (host) => {
    const { fn } = mockFetch();
    const res = await workerFetch(
      new Request(`https://${host}/anything`, { method: "POST", body: "x" }),
      outboundEnv({ egress: ["api.example.com"] })
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "egress_denied", host });
    expect(fn).not.toHaveBeenCalled();
  });

  it("the approval step refuses every platform host, so none can be on the list", () => {
    for (const host of PLATFORM_HOSTS.filter((h) => !h.endsWith("cloudflare.com"))) {
      expect(egressHostRejection(host)).not.toBeNull();
    }
    expect(egressHostRejection("api.example.com")).toBeNull();
  });

  it("an approved host must still be https; a killed manifest empties the list", async () => {
    const { fn } = mockFetch();
    const res = await workerFetch(
      new Request("http://api.example.com/v1"),
      outboundEnv({ egress: ["api.example.com"] })
    );
    expect(res.status).toBe(403);
    expect(fn).not.toHaveBeenCalled();
    expect(egressAllowed({ egress: [] }, "api.example.com")).toBe(false);
    expect(egressAllowed({ egress: ["API.Example.com"] }, "api.example.com")).toBe(true);
    expect(egressAllowed({ egress: ["example.com"] }, "api.example.com")).toBe(false);
  });

  it("an approved host is reachable on 443 only — no other port on it", async () => {
    const { fn } = mockFetch();
    for (const port of [":22", ":8443", ":80"]) {
      const res = await workerFetch(
        new Request(`https://api.example.com${port}/v1`),
        outboundEnv({ egress: ["api.example.com"] })
      );
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "egress_denied", host: "api.example.com" });
    }
    expect(fn).not.toHaveBeenCalled();
    const ok = await workerFetch(
      new Request("https://api.example.com:443/v1"),
      outboundEnv({ egress: ["api.example.com"] })
    );
    expect(ok.status).not.toBe(403);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("forged X-Air-* headers are stripped from user-originated requests", async () => {
    const { calls } = mockFetch();
    const res = await workerFetch(
      new Request("https://api.example.com/v1", {
        headers: {
          [IDENTITY_HEADERS.role]: "owner",
          [IDENTITY_HEADERS.principal]: "p_owner",
          "x-air-anything": "1",
          "x-custom": "kept",
        },
      }),
      outboundEnv({ egress: ["api.example.com"] })
    );
    expect(res.status).toBe(200);
    const sent = calls[0]!;
    for (const name of [...sent.headers.keys()]) expect(name.startsWith("x-air-")).toBe(false);
    expect(sent.headers.get("x-custom")).toBe("kept");
    expect(sent.headers.get("authorization")).toBeNull();
  });
});

describe("Outbound Worker — air.internal allowlist (§11.3)", () => {
  const kv = { "rt:tok-ref-1": RUNTIME_TOKEN.secret };

  it("refuses an unknown model before anything leaves", async () => {
    const { fn } = mockFetch();
    const res = await workerFetch(
      new Request("https://air.internal/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ model: "gpt-4o", messages: [] }),
      }),
      outboundEnv({}, kv)
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unknown_model");
    expect(fn).not.toHaveBeenCalled();
  });

  it("injects the runtime token (from its own KV) and the Dispatcher's role, never the user's", async () => {
    const { calls } = mockFetch();
    const res = await workerFetch(
      new Request("https://air.internal/v1/chat/completions", {
        method: "POST",
        headers: { [IDENTITY_HEADERS.role]: "owner", authorization: "Bearer forged" },
        body: JSON.stringify({ model: "fast", messages: [{ role: "user", content: "hi" }] }),
      }),
      outboundEnv({ role: "guest" }, kv)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    const sent = calls[0]!;
    expect(sent.url).toBe("https://app.wzrd.tech/api/gateway/v1/chat/completions");
    expect(sent.headers.get("authorization")).toBe(`Bearer ${RUNTIME_TOKEN.secret}`);
    expect(sent.headers.get(IDENTITY_HEADERS.role)).toBe("guest");
    expect(sent.headers.get(IDENTITY_HEADERS.app)).toBe("alice-rsvp");
  });

  it("the token reaches the control plane only, never an approved egress host", async () => {
    const { calls } = mockFetch();
    await workerFetch(
      new Request("https://api.example.com/hook", { method: "POST", body: "{}" }),
      outboundEnv({ egress: ["api.example.com"] }, kv)
    );
    expect(JSON.stringify([...calls[0]!.headers])).not.toContain(RUNTIME_TOKEN.secret);
  });

  it("no token in KV → backend_not_enabled; the params carry only an opaque reference", async () => {
    const { fn } = mockFetch();
    const env = outboundEnv({}, {});
    const res = await workerFetch(
      new Request("https://air.internal/v1/state?resource=default"),
      env
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("backend_not_enabled");
    expect(fn).not.toHaveBeenCalled();
    expect(JSON.stringify(env.params)).not.toContain("art_");
  });

  it("/v1/notify does not exist and state bodies are capped at 256 KiB", async () => {
    const { fn } = mockFetch();
    const notify = await workerFetch(
      new Request("https://air.internal/v1/notify", { method: "POST", body: "{}" }),
      outboundEnv({}, kv)
    );
    expect(notify.status).toBe(404);
    const big = await workerFetch(
      new Request("https://air.internal/v1/state?resource=default", {
        method: "PUT",
        body: "x".repeat(256 * 1024 + 1),
      }),
      outboundEnv({}, kv)
    );
    expect(big.status).toBe(413);
    expect(fn).not.toHaveBeenCalled();
  });
});

// ── what the user Worker is given ──────────────────────────────────────────
function functionsRow(patch: Partial<FunctionsRow> = {}): FunctionsRow {
  return parseFunctionsRow({
    app_id: "app-1",
    user_id: "user-1",
    script_name: "alice-rsvp",
    draft_script_name: "alice-rsvp-draft",
    d1_database_id: "d1-uuid",
    kv_namespace_id: "kv-id",
    egress: [],
    secret_names: ["STRIPE_KEY"],
    ai_daily_cap_usd: 1,
    ai_spent_today_usd: 0,
    ai_spend_day: null,
    limits: { cpu_ms: 50, subrequests: 20 },
    status: "live",
    approved_manifest: {
      egress: ["api.example.com"],
      db: true,
      kv: true,
      dailyCapUsd: 0.5,
      secretNames: ["STRIPE_KEY"],
    },
    deployed_at: "2026-09-01T00:00:00.000Z",
    last_error: null,
    declared: { entry: "functions/index.ts", db: true, kv: true, egress: ["evil.example"], ai: { dailyCapUsd: 5 } },
    declared_at: "2026-09-02T00:00:00.000Z",
    approved_at: "2026-09-01T00:00:00.000Z",
    runtime_token_id: "tok-ref-1",
    secret_set_at: { STRIPE_KEY: { at: "2026-09-01T00:00:00.000Z", live: true, draft: true } },
    killed_at: null,
    killed_by: null,
    ...patch,
  })!;
}

const registryApp = {
  id: "app-1",
  slug: "alice-rsvp",
  name: "RSVP",
  owner_user_id: "user-1",
  status: "published",
  bundle_version: "v2",
  draft_version: "v3",
  functions_enabled: true,
} as unknown as RegistryApp;

describe("bindings, params and manifest carry no platform credential (CR6, CR16)", () => {
  it("bindings are ASSETS + DB + KV only — no R2, no service binding, no plain_text", () => {
    for (const target of ["live", "draft"] as const) {
      const bindings = functionsBindings(functionsRow(), target);
      expect(bindings.map((b) => b.type).sort()).toEqual(["assets", "d1", "kv_namespace"]);
      expect(findPlantedHits(JSON.stringify(bindings), PLANTED_VALUES)).toEqual([]);
    }
  });

  it("the Outbound params come from the approved manifest, not the declaration, and hold a token reference only", () => {
    const runtime = runtimeFor(functionsRow())!;
    expect(runtime.egress).toEqual(["api.example.com"]);
    expect(runtime.budget_usd).toBe(0.5);
    expect(runtime.token_ref).toBe("tok-ref-1");
    const signed = signManifest(manifestFor(registryApp, functionsRow()));
    const text = JSON.stringify(signed);
    expect(text).not.toContain("evil.example");
    expect(text).not.toContain("art_");
    expect(findPlantedHits(text, PLANTED_VALUES)).toEqual([]);
    for (const host of PLATFORM_HOSTS) expect(runtime.egress).not.toContain(host);
  });

  it("a killed backend hands the Worker nothing to reach or spend", () => {
    const runtime = runtimeFor(functionsRow({ killed_at: "2026-09-03T00:00:00.000Z", killed_by: "admin" }))!;
    expect(runtime.killed).toBe(true);
    expect(manifestFor(registryApp, functionsRow({ killed_at: "now", killed_by: "owner" })).functions).toBe(false);
  });

  it("the script upload metadata names no credential and no platform host", async () => {
    let metadata = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const form = init?.body as FormData;
        metadata = await (form.get("metadata") as Blob).text();
        return new Response(JSON.stringify({ success: true, result: {} }), {
          headers: { "content-type": "application/json" },
        });
      })
    );
    await putDispatchScript({
      script: "alice-rsvp-draft",
      mainModule: "functions.mjs",
      modules: [{ name: "functions.mjs", content: "export default {}", type: "application/javascript+module" }],
      bindings: functionsBindings(functionsRow(), "draft"),
      tags: ["owner:user-1", "app:alice-rsvp", "v:v3"],
      compatibilityDate: "2026-09-01",
      limits: { cpu_ms: 50, subrequests: 20 },
      keepSecrets: true,
    });
    const parsed = JSON.parse(metadata) as { bindings: Array<{ type: string }>; keep_bindings: string[] };
    expect(parsed.bindings.map((b) => b.type)).not.toContain("r2_bucket");
    expect(parsed.bindings.map((b) => b.type)).not.toContain("service");
    expect(parsed.keep_bindings).toEqual(["secret_text"]);
    expect(findPlantedHits(metadata, PLANTED_VALUES)).toEqual([]);
    for (const host of PLATFORM_HOSTS) expect(metadata).not.toContain(host);
  });

  it("one owner is a different principal in each of their apps", () => {
    const a = appPrincipal("user-1", "app-a");
    const b = appPrincipal("user-1", "app-b");
    expect(a).not.toBe(b);
    expect(a).toBe(appPrincipal("user-1", "app-a"));
    expect(a).not.toContain("user-1");
  });
});

// ── the planted secret value ───────────────────────────────────────────────
vi.mock("./cloudflare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cloudflare")>();
  return {
    ...actual,
    putDispatchScriptSecret: vi.fn(async () => true),
    deleteDispatchScriptSecret: vi.fn(async () => undefined),
  };
});

type Row = Record<string, unknown>;

function memoryStore() {
  const tables: Record<string, Row[]> = { miniapp_functions: [], decisions: [], ops_events: [] };
  function table(name: string) {
    const rows = (tables[name] ??= []);
    const filters: [string, unknown][] = [];
    let op: { kind: "select" | "update" | "upsert" | "insert"; patch?: Row; rows?: Row[] } = { kind: "select" };
    const run = () => {
      if (op.kind === "upsert" || op.kind === "insert") {
        const out: Row[] = [];
        for (const r of op.rows!) {
          if (op.kind === "upsert" && rows.some((x) => x["app_id"] === r["app_id"])) continue;
          const full = { ...functionsRow({ secret_names: [], secret_set_at: {}, status: "disabled" }), ...r };
          rows.push(name === "miniapp_functions" ? full : r);
          out.push(full);
        }
        return { data: out, error: null };
      }
      const hit = rows.filter((r) => filters.every(([k, v]) => r[k] === v));
      if (op.kind === "update") for (const r of hit) Object.assign(r, op.patch);
      return { data: hit, error: null };
    };
    const b: Row = {
      select: () => b,
      eq: (k: string, v: unknown) => (filters.push([k, v]), b),
      order: () => b,
      limit: () => b,
      insert: (r: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(r) ? r : [r] }), b),
      upsert: (r: Row | Row[]) => ((op = { kind: "upsert", rows: Array.isArray(r) ? r : [r] }), b),
      update: (patch: Row) => ((op = { kind: "update", patch }), b),
      maybeSingle: async () => ({ data: (run().data as Row[])[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    };
    return b;
  }
  return { tables, supabase: { from: table } as unknown as SupabaseClient };
}

describe("a planted owner secret is absent from every store the sweep covers (§11.4, C18)", () => {
  it("only Cloudflare's secrets endpoint receives the value", async () => {
    const { tables, supabase } = memoryStore();
    const cf = await import("./cloudflare");
    const row = await setSecret(
      supabase,
      { id: "app-1", slug: "alice-rsvp", owner_user_id: "user-1" },
      "STRIPE_KEY",
      PLANTED.ownerSecret
    );
    expect(cf.putDispatchScriptSecret).toHaveBeenCalledWith("alice-rsvp", "STRIPE_KEY", PLANTED.ownerSecret);
    expect(cf.putDispatchScriptSecret).toHaveBeenCalledWith("alice-rsvp-draft", "STRIPE_KEY", PLANTED.ownerSecret);

    const stores = {
      postgres: tables,
      row,
      summary: summarizeSecrets(row),
      decision: backendDecisionPayload(
        { egress: [], db: false, kv: false, dailyCapUsd: 1, secretNames: row.secret_names },
        null
      ),
      manifest: signManifest(manifestFor(registryApp, row)),
      bindings: functionsBindings(row, "draft"),
    };
    expect(findPlantedHits(JSON.stringify(stores), PLANTED_VALUES)).toEqual([]);
    expect(row.secret_names).toEqual(["STRIPE_KEY"]);
  });

  it("the build's sweep refuses source that pastes the value, pointing at the Secrets tab", () => {
    expect(textContainsSecrets(`const key = "${PLANTED.ownerSecret}";`)).toBe("credential-like content");
    expect(textContainsSecrets(`const key = env.STRIPE_KEY;`)).toBeNull();
  });

  it("runtime tokens are stored as a hash only", () => {
    const { secret, hash } = mintRuntimeToken();
    expect(hash).toBe(hashRuntimeToken(secret));
    expect(hash).not.toContain(secret);
    expect(secret.startsWith("art_")).toBe(true);
  });
});

// ── real namespace (skipped without credentials) ───────────────────────────
const realCloudflare = Boolean(REAL_CLOUDFLARE.accountId) && Boolean(REAL_CLOUDFLARE.apiToken);

describe.skipIf(!realCloudflare)("real Cloudflare namespace", () => {
  it("creates and deletes a throwaway KV namespace idempotently", async () => {
    process.env["CLOUDFLARE_ACCOUNT_ID"] = REAL_CLOUDFLARE.accountId!;
    process.env["CLOUDFLARE_API_TOKEN"] = REAL_CLOUDFLARE.apiToken!;
    expect(cloudflareConfigured()).toBe(true);
    const { id } = await createKvNamespace(`air-redteam-${Date.now()}`);
    await deleteKvNamespace(id);
    await expect(deleteKvNamespace(id)).resolves.toBeUndefined();
  });
});
