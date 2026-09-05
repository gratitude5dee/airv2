/**
 * The Apps API (MA3) and the Functions runtime API (MC5) append to the same
 * `actions.json`. Interleave one POST from each against a Box whose read
 * stalls and show both entries land, in order, through the shared lease.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistryApp } from "@/lib/miniapps/registry";
import type { AppsApiSession } from "@/lib/miniapps/appsApi";
import type { FunctionsRow } from "@/lib/functions/backend";
import type { RuntimePrincipal } from "@/lib/functions/runtime";

const app = {
  id: "app-a",
  slug: "u-a",
  owner_user_id: "user-1",
  bundle_version: "v1",
} as unknown as RegistryApp;
const appsSession: AppsApiSession = {
  app,
  session: { userId: "user-1", resourceId: "u-a", role: "owner" },
};
const principal: RuntimePrincipal = {
  tokenId: "tok-a",
  appId: "app-a",
  userId: "user-1",
  slug: "u-a",
  functions: { app_id: "app-a", user_id: "user-1" } as unknown as FunctionsRow,
};

const docs = new Map<string, unknown>();
const reads: string[] = [];
let readGate: Promise<void> | null = null;
const leases = new Map<string, string>();
let leaseAlwaysBusy = false;

vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      rpc: async (fn: string, args: Record<string, unknown>) => {
        const key = `${args["p_user_id"]}/${args["p_app"]}/${args["p_resource"]}`;
        if (fn === "miniapp_state_lease") {
          if (leaseAlwaysBusy || leases.has(key)) return { data: false, error: null };
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
vi.mock("@/lib/miniapps/store", () => ({
  readAppState: vi.fn(async (_s: unknown, userId: string, slug: string, resource: string) => {
    reads.push(resource);
    if (readGate) await readGate;
    return docs.get(`${userId}/${slug}/${resource}`) ?? {};
  }),
  writeAppState: vi.fn(
    async (_s: unknown, userId: string, slug: string, resource: string, state: unknown) => {
      docs.set(`${userId}/${slug}/${resource}`, state);
    }
  ),
}));
vi.mock("@/lib/miniapps/appsApi", () => ({
  appsApiSession: vi.fn(async () => appsSession),
  bundleManifest: vi.fn(async () => ({ actions: ["rsvp"], guestActions: ["rsvp"] })),
  stateUserId: (auth: AppsApiSession) => auth.session.userId,
}));
vi.mock("@/lib/functions/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/functions/runtime")>();
  return {
    ...actual,
    authenticateRuntimeToken: vi.fn(async (_s: unknown, bearer: string) =>
      bearer === "art_a" ? principal : null
    ),
  };
});
vi.mock("@/lib/storage/r2", () => ({
  r2Configured: () => true,
  getObject: vi.fn(async () => ({
    body: Buffer.from(JSON.stringify({ actions: ["rsvp"], guestActions: ["rsvp"] })),
  })),
}));
vi.mock("@/lib/security/limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/limits")>();
  return { ...actual, recordOpsEvent: vi.fn(async () => undefined) };
});
vi.mock("@/lib/miniapps/actionLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/miniapps/actionLog")>();
  return {
    ...actual,
    // Tight retry budget so the test runs in milliseconds.
    appendActionLogEntry: (
      ...args: Parameters<typeof actual.appendActionLogEntry>
    ) => actual.appendActionLogEntry(args[0], args[1], args[2], args[3], {
      attempts: 8,
      backoffMs: 2,
      ...(args[4] ?? {}),
    }),
  };
});

import { NextRequest } from "next/server";
import { POST as appsPost } from "./route";
import { POST as functionsPost } from "../../../functions/actions/route";

const appsReq = (action: string): NextRequest =>
  new NextRequest("https://app.test/api/apps/v1/action", {
    method: "POST",
    body: JSON.stringify({ action, payload: { via: "apps-api" } }),
  });
const functionsReq = (action: string): NextRequest => {
  const body = JSON.stringify({ action, payload: { via: "functions" } });
  return new NextRequest("https://air.test/api/functions/actions", {
    method: "POST",
    headers: {
      authorization: "Bearer art_a",
      "X-Air-Role": "owner",
      "X-Air-Version": "v1",
      "content-length": String(Buffer.byteLength(body)),
    },
    body,
  });
};
const log = (): Array<Record<string, unknown>> =>
  (docs.get("user-1/u-a/actions") as Array<Record<string, unknown>> | undefined) ?? [];

beforeEach(() => {
  docs.clear();
  leases.clear();
  reads.length = 0;
  readGate = null;
  leaseAlwaysBusy = false;
});
afterEach(() => vi.restoreAllMocks());

describe("action log: Apps API and Functions runtime share one leased append", () => {
  it("an Apps API append racing a Functions append keeps both entries", async () => {
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    const first = appsPost(appsReq("rsvp"));
    await vi.waitFor(() => expect(reads).toHaveLength(1));
    const second = functionsPost(functionsReq("rsvp"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(reads).toHaveLength(1);
    open();
    const [a, b] = await Promise.all([first, second]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(log().map((e) => e["payload"])).toEqual([{ via: "apps-api" }, { via: "functions" }]);
    expect(log()[1]?.["source"]).toBe("functions");
    expect(leases.size).toBe(0);
  });

  it("the reverse order keeps both too", async () => {
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    const first = functionsPost(functionsReq("rsvp"));
    await vi.waitFor(() => expect(reads).toHaveLength(1));
    const second = appsPost(appsReq("rsvp"));
    open();
    const [a, b] = await Promise.all([first, second]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(log().map((e) => e["payload"])).toEqual([{ via: "functions" }, { via: "apps-api" }]);
  });

  it("both routes answer 503 (not a lost write) when the lease cannot be taken", async () => {
    leaseAlwaysBusy = true;
    const apps = await appsPost(appsReq("rsvp"));
    expect(apps.status).toBe(503);
    expect(apps.headers.get("retry-after")).toBe("1");
    const fns = await functionsPost(functionsReq("rsvp"));
    expect(fns.status).toBe(503);
    expect(await fns.json()).toEqual({ error: "state_busy" });
    expect(reads).toHaveLength(0);
    expect(log()).toEqual([]);
  });
});
