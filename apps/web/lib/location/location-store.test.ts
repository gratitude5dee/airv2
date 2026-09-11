/**
 * Focused state-machine coverage for the Find My request store: expedite
 * fences, claim CAS, release backoff, and the atomic held-burst handoff.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claimDueLocationRequests,
  expediteLocationRequest,
  releaseLocationRequest,
  RESOLUTION_BACKOFF_MS,
  type LocationRequest,
} from "./requests";
import { resolveDueLocationRequests } from "./resolve";
import { createSpectrumSender } from "../spectrum/sender";
import { scheduleFlush } from "../orchestrator/flush";

vi.mock("../spectrum/sender", () => ({ createSpectrumSender: vi.fn() }));
vi.mock("../orchestrator/flush", () => ({
  scheduleFlush: vi.fn().mockResolvedValue(new Date().toISOString()),
}));

type Call = { table: string; method: string; args: unknown[] };
type Result = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
};
interface Query {
  table: string;
  op: string | null;
  args: unknown[];
  returning: boolean;
  calls: Call[];
}

/**
 * Minimal Postgrest chain mock: every method records and re-chains, the
 * structural verb pins on first use, a `.select()` after a mutation marks
 * `returning`. Awaiting the chain (maybeSingle/single included) resolves
 * the test's dispatch over the recorded query.
 */
function fakeDb(resolve: (q: Query) => Result) {
  const calls: Call[] = [];
  const OPS = new Set(["select", "insert", "update", "delete", "upsert"]);
  const chain = (
    table: string,
    op: string | null,
    args: unknown[],
    returning: boolean
  ): unknown => {
    const self = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          const p = Promise.resolve().then(() =>
            resolve({ table, op, args, returning, calls })
          );
          if (prop === "then") return p.then.bind(p);
          if (prop === "catch") return p.catch.bind(p);
          return p.finally.bind(p);
        }
        const method = String(prop);
        return (...a: unknown[]) => {
          calls.push({ table, method, args: a });
          if (OPS.has(method) && !op) return chain(table, method, a, returning);
          if (method === "select" && op && op !== "select") {
            return chain(table, op, args, true);
          }
          return chain(table, op, args, returning);
        };
      },
      apply() {
        return chain(table, op, args, returning);
      },
    });
    return self;
  };
  const supabase = {
    from: (table: string) => chain(table, null, [], false),
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

const base: LocationRequest = {
  id: "req-1",
  user_id: "u1",
  space_id: "iMessage;+;+15551234567",
  phone: "+15551234567",
  sender_address: "+15559990000",
  request_key: "k1",
  status: "awaiting_share",
  purpose: "nearby",
  entity_type: "place",
  search_text: "tacos",
  burst_input: ["tacos near me"],
  revision: 0,
  next_attempt_at: new Date(Date.now() - 1000).toISOString(),
  expires_at: new Date(Date.now() + 600_000).toISOString(),
  coarse_label: null,
  resolved_at: null,
  created_at: new Date().toISOString(),
};

describe("expediteLocationRequest", () => {
  it("bumps an awaiting_share row and folds a caption into the held burst", async () => {
    const { supabase, calls } = fakeDb((q) => {
      if (q.table === "location_requests" && q.op === "select") {
        return { data: { ...base } };
      }
      return { data: null, error: null };
    });
    const id = await expediteLocationRequest(supabase, base.space_id, ["omw"]);
    expect(id).toBe("req-1");
    const update = calls.find(
      (c) => c.table === "location_requests" && c.method === "update"
    );
    expect(update?.args[0]).toMatchObject({
      revision: 1,
      burst_input: ["tacos near me", "omw"],
    });
    expect(update?.args[0]).toHaveProperty("next_attempt_at");
    // The expedite fence excludes 'resolving' — the select's pending list
    // (which includes it) is a different .in() call.
    const statusIns = calls
      .filter((c) => c.method === "in" && c.args[0] === "status")
      .map((c) => c.args[1] as string[]);
    expect(
      statusIns.some(
        (s) => s.includes("awaiting_share") && !s.includes("resolving")
      )
    ).toBe(true);
  });

  it("never bumps a resolving row's revision — it only folds the caption", async () => {
    const { supabase, calls } = fakeDb((q) => {
      if (q.table === "location_requests" && q.op === "select") {
        return { data: { ...base, status: "resolving", revision: 5 } };
      }
      return { data: null, error: null };
    });
    const id = await expediteLocationRequest(supabase, base.space_id, ["omw"]);
    expect(id).toBe("req-1");
    const update = calls.find(
      (c) => c.table === "location_requests" && c.method === "update"
    );
    expect(update?.args[0]).toEqual({
      burst_input: ["tacos near me", "omw"],
    });
  });

  it("treats an in-flight resolving row as underway — no update with no caption", async () => {
    const { supabase, calls } = fakeDb((q) => {
      if (q.table === "location_requests" && q.op === "select") {
        return { data: { ...base, status: "resolving" } };
      }
      return { data: null, error: null };
    });
    const id = await expediteLocationRequest(supabase, base.space_id);
    expect(id).toBe("req-1");
    expect(
      calls.some((c) => c.table === "location_requests" && c.method === "update")
    ).toBe(false);
  });
});

describe("claimDueLocationRequests", () => {
  it("claims CAS winners only and bumps revision on the claim", async () => {
    const rows = [
      { ...base, id: "req-a", revision: 1 },
      { ...base, id: "req-b", revision: 2 },
    ];
    let claims = 0;
    const { supabase, calls } = fakeDb((q) => {
      if (q.table === "location_requests" && q.op === "select") {
        return { data: rows };
      }
      if (q.op === "update" && q.returning) {
        claims += 1;
        return claims === 1 ? { data: { id: "req-a" } } : { data: null };
      }
      return { data: null, error: null };
    });
    const claimed = await claimDueLocationRequests(supabase, 10);
    expect(claimed.map((r) => r.id)).toEqual(["req-a"]);
    expect(claimed[0]!.status).toBe("resolving");
    expect(claimed[0]!.revision).toBe(2);
    // The claim update fences on the read revision + awaiting_share.
    const claimsCalls = calls.filter(
      (c) => c.method === "eq" && c.args[0] === "revision"
    );
    expect(claimsCalls.length).toBeGreaterThan(0);
    expect(
      calls.some(
        (c) =>
          c.method === "eq" && c.args[0] === "status" && c.args[1] === "awaiting_share"
      )
    ).toBe(true);
  });
});

describe("releaseLocationRequest", () => {
  it("returns the row to awaiting_share at the next backoff step, revision-fenced", async () => {
    const { supabase, calls } = fakeDb(() => ({ data: null, error: null }));
    const request = { ...base, status: "resolving" as const, revision: 2 };
    const before = Date.now();
    await releaseLocationRequest(supabase, request, 3);
    const update = calls.find((c) => c.method === "update");
    expect(update?.args[0]).toMatchObject({ status: "awaiting_share" });
    const at = new Date(
      (update?.args[0] as { next_attempt_at: string }).next_attempt_at
    ).getTime();
    const expected = RESOLUTION_BACKOFF_MS[3]!;
    expect(at - before).toBeGreaterThanOrEqual(expected - 50);
    expect(at - before).toBeLessThanOrEqual(expected + 5_000);
    // revision fence — a row expedited mid-resolution can't be released back
    expect(
      calls.some(
        (c) => c.method === "eq" && c.args[0] === "revision" && c.args[1] === 2
      )
    ).toBe(true);
  });
});

describe("resolveDueLocationRequests", () => {
  const sender = {
    sendText: vi.fn().mockResolvedValue(undefined),
    getSharedLocation: vi.fn(),
    requestLocation: vi.fn(),
    getAttachment: vi.fn(),
    sendApp: vi.fn(),
    sendRichLink: vi.fn(),
    sendAttachment: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const sharedLocation = {
    latitude: 37.77,
    longitude: -122.41,
    locationType: "live",
    accuracy: 10,
    isLocatingInProgress: false,
    expiresAt: new Date(Date.now() + 600_000),
    locationTimestamp: new Date(),
    shortAddress: "Mission District",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSpectrumSender).mockResolvedValue(
      sender as unknown as Awaited<ReturnType<typeof createSpectrumSender>>
    );
    sender.getSharedLocation.mockResolvedValue(sharedLocation);
  });

  function claimedResolveDb(request: LocationRequest = base) {
    return fakeDb((q) => {
      if (q.table === "location_requests" && q.op === "select") {
        return { data: [{ ...request }] };
      }
      if (q.op === "update" && q.returning) return { data: { id: request.id } };
      return { data: null, error: null };
    });
  }

  it("delivers the held burst in one atomic insert before consuming", async () => {
    const { supabase, calls } = claimedResolveDb();
    const out = await resolveDueLocationRequests(supabase);
    expect(out).toEqual({ resolved: 1, expired: 0 });

    // A retry can't duplicate the held burst: the deterministic prefix is
    // purged first, then the whole set lands in ONE insert.
    const like = calls.find(
      (c) => c.table === "batch_queue" && c.method === "like"
    );
    expect(like?.args).toEqual(["message_id", "location:req-1:%"]);
    const inserts = calls.filter(
      (c) => c.table === "batch_queue" && c.method === "insert"
    );
    expect(inserts).toHaveLength(1);
    const rows = inserts[0]!.args[0] as { body: string; sender_id: string }[];
    expect(rows[0]!.body).toContain("[context]");
    expect(rows[0]!.body).toContain("Mission District");
    expect(rows.map((r) => r.body)).toContain("tacos near me");
    expect(rows.every((r) => r.sender_id === base.sender_address)).toBe(true);

    // Consume happens after the burst is queued.
    const consumeIdx = calls.findIndex(
      (c) =>
        c.table === "location_requests" &&
        c.method === "update" &&
        (c.args[0] as { status?: string }).status === "consumed"
    );
    expect(consumeIdx).toBeGreaterThan(calls.indexOf(inserts[0]!));
    expect(vi.mocked(scheduleFlush)).toHaveBeenCalledOnce();
  });

  it("expires a stale request without touching the queue", async () => {
    const stale = {
      ...base,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    };
    const { supabase, calls } = claimedResolveDb(stale);
    const out = await resolveDueLocationRequests(supabase);
    expect(out).toEqual({ resolved: 0, expired: 1 });
    expect(
      calls.some((c) => c.table === "batch_queue" && c.method === "insert")
    ).toBe(false);
    expect(sender.sendText).toHaveBeenCalledWith(
      base.space_id,
      base.phone,
      expect.stringContaining("didn't get your location")
    );
  });

  it("releases back to awaiting_share when no share landed yet", async () => {
    sender.getSharedLocation.mockResolvedValue(undefined);
    const { supabase, calls } = claimedResolveDb();
    const out = await resolveDueLocationRequests(supabase);
    expect(out).toEqual({ resolved: 0, expired: 0 });
    expect(
      calls.some(
        (c) =>
          c.table === "location_requests" &&
          c.method === "update" &&
          (c.args[0] as { status?: string }).status === "awaiting_share"
      )
    ).toBe(true);
  });
});
