/**
 * Focused state-machine coverage for the Find My request store: expedite
 * fences, claim CAS, release backoff, and the atomic held-burst handoff.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import {
  claimDueLocationRequests,
  completeLocationRequest,
  expediteLocationRequest,
  releaseLocationRequest,
  supersedeLocationRequests,
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

const db = new FakeSupabase();

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

beforeEach(() => {
  db.reset();
});

describe("expediteLocationRequest", () => {
  it("bumps an awaiting_share row and folds a caption into the held burst", async () => {
    db.tables["location_requests"] = [{ ...base }];
    const id = await expediteLocationRequest(db.client(), base.space_id, ["omw"]);
    expect(id).toBe("req-1");
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0]?.patch).toMatchObject({
      revision: 1,
      burst_input: ["tacos near me", "omw"],
    });
    expect(db.updates[0]?.patch).toHaveProperty("next_attempt_at");
    // The expedite fence excludes 'resolving' — the select's pending list
    // (which includes it) is a different .in() call.
    const statusIns = db.filters
      .filter((f) => f.op === "in" && f.column === "status")
      .map((f) => f.value as string[]);
    expect(
      statusIns.some(
        (s) => s.includes("awaiting_share") && !s.includes("resolving")
      )
    ).toBe(true);
  });

  it("never bumps a resolving row's revision — it only folds the caption", async () => {
    db.tables["location_requests"] = [
      { ...base, status: "resolving", revision: 5 },
    ];
    const id = await expediteLocationRequest(db.client(), base.space_id, ["omw"]);
    expect(id).toBe("req-1");
    expect(db.updates[0]?.patch).toEqual({
      burst_input: ["tacos near me", "omw"],
    });
  });

  it("treats an in-flight resolving row as underway — no update with no caption", async () => {
    db.tables["location_requests"] = [{ ...base, status: "resolving" }];
    const id = await expediteLocationRequest(db.client(), base.space_id);
    expect(id).toBe("req-1");
    expect(
      db.updates.some((u) => u.table === "location_requests")
    ).toBe(false);
  });
});

describe("supersedeLocationRequests", () => {
  it("bumps revision on a resolving row so its claimed fence goes stale", async () => {
    db.tables["location_requests"] = [
      { ...base, status: "resolving", revision: 5 },
    ];
    await supersedeLocationRequests(db.client(), base.space_id);
    expect(db.updates[0]?.patch).toEqual({ status: "cancelled", revision: 6 });
    db.expectQuery({ table: "location_requests", filters: { revision: 5 } });
  });
});

describe("completeLocationRequest", () => {
  const resolving = { ...base, status: "resolving" as const, revision: 2 };

  it("throws on a supabase error so the resolver recovers", async () => {
    db.errors["location_requests"] = { message: "transient" };
    await expect(
      completeLocationRequest(db.client(), resolving, { status: "expired" })
    ).rejects.toThrow("completion failed");
  });

  it("throws when the revision fence matches no row", async () => {
    // A supersede/expedite moved the row past the revision the sweeper holds.
    db.tables["location_requests"] = [
      { ...base, status: "resolving", revision: 3 },
    ];
    await expect(
      completeLocationRequest(db.client(), resolving, { status: "expired" })
    ).rejects.toThrow("revision fence");
  });
});

describe("claimDueLocationRequests", () => {
  it("claims CAS winners only and bumps revision on the claim", async () => {
    db.tables["location_requests"] = [
      { ...base, id: "req-a", revision: 1 },
      {
        ...base,
        id: "req-b",
        revision: 2,
        next_attempt_at: new Date(Date.now() - 500).toISOString(),
      },
    ];
    // req-b's claim loses the CAS: a concurrent writer bumped it between the
    // pending select and the fenced update, so the update returns no row.
    db.resolve = (q) =>
      q.table === "location_requests" &&
      q.mode === "update" &&
      q.filters.some((f) => f.column === "id" && f.value === "req-b")
        ? { data: null }
        : undefined;
    const claimed = await claimDueLocationRequests(db.client(), 10);
    expect(claimed.map((r) => r.id)).toEqual(["req-a"]);
    expect(claimed[0]!.status).toBe("resolving");
    expect(claimed[0]!.revision).toBe(2);
    // The claim update fences on the read revision + awaiting_share.
    db.expectQuery({
      table: "location_requests",
      filters: { status: "awaiting_share" },
    });
    expect(
      db.filters.some((f) => f.op === "eq" && f.column === "revision")
    ).toBe(true);
  });
});

describe("releaseLocationRequest", () => {
  it("returns the row to awaiting_share at the next backoff step, revision-fenced", async () => {
    const request = { ...base, status: "resolving" as const, revision: 2 };
    db.tables["location_requests"] = [{ ...request }];
    const before = Date.now();
    await releaseLocationRequest(db.client(), request, 3);
    const patch = db.updates[0]?.patch;
    expect(patch).toMatchObject({ status: "awaiting_share" });
    const at = new Date(patch?.["next_attempt_at"] as string).getTime();
    const expected = RESOLUTION_BACKOFF_MS[3]!;
    expect(at - before).toBeGreaterThanOrEqual(expected - 50);
    expect(at - before).toBeLessThanOrEqual(expected + 5_000);
    // revision fence — a row expedited mid-resolution can't be released back
    db.expectQuery({ table: "location_requests", filters: { revision: 2 } });
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

  function claimedResolveDb(
    request: LocationRequest = base,
    overrides?: { freshBurst?: string[]; superseded?: boolean }
  ) {
    db.tables["location_requests"] = [{ ...request }];
    // The provider probe runs between the claim and the delivery re-read:
    // land an expedite's caption append or a supersede's cancel on the real
    // row at the moment the resolver reads it back under its claimed
    // revision.
    const claimedRevision = request.revision + 1;
    db.resolve = (q) => {
      if (q.table === "location_requests" && q.mode === "select" && q.single) {
        const row = db.rows("location_requests").find((r) => r["id"] === request.id);
        if (row && overrides?.superseded) {
          Object.assign(row, {
            status: "cancelled",
            revision: claimedRevision + 1,
          });
        } else if (row && overrides?.freshBurst) {
          Object.assign(row, { burst_input: overrides.freshBurst });
        }
      }
      return undefined;
    };
  }

  it("delivers the held burst in one atomic insert before consuming", async () => {
    claimedResolveDb();
    const out = await resolveDueLocationRequests(db.client());
    expect(out).toEqual({ resolved: 1, expired: 0 });

    // A retry can't duplicate the held burst: the deterministic prefix is
    // purged first, then the whole set lands in ONE insert.
    const like = db.filters.find(
      (f) => f.table === "batch_queue" && f.op === "like"
    );
    expect([like?.column, like?.value]).toEqual([
      "message_id",
      "location:req-1:%",
    ]);
    const inserts = db.queries.filter(
      (q) => q.table === "batch_queue" && q.mode === "insert"
    );
    expect(inserts).toHaveLength(1);
    const rows = inserts[0]!.args[0] as { body: string; sender_id: string }[];
    expect(rows[0]!.body).toContain("[context]");
    expect(rows[0]!.body).toContain("Mission District");
    expect(rows.map((r) => r.body)).toContain("tacos near me");
    expect(rows.every((r) => r.sender_id === base.sender_address)).toBe(true);

    // Consume happens after the burst is queued.
    const consumeIdx = db.queries.findIndex(
      (q) =>
        q.table === "location_requests" &&
        q.mode === "update" &&
        (q.args[0] as { status?: string }).status === "consumed"
    );
    expect(consumeIdx).toBeGreaterThan(db.queries.indexOf(inserts[0]!));
    expect(vi.mocked(scheduleFlush)).toHaveBeenCalledOnce();
  });

  it("expires a stale request without touching the queue", async () => {
    const stale = {
      ...base,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    };
    claimedResolveDb(stale);
    const out = await resolveDueLocationRequests(db.client());
    expect(out).toEqual({ resolved: 0, expired: 1 });
    expect(
      db.queries.some((q) => q.table === "batch_queue" && q.mode === "insert")
    ).toBe(false);
    expect(sender.sendText).toHaveBeenCalledWith(
      base.space_id,
      base.phone,
      expect.stringContaining("didn't get your location")
    );
  });

  it("releases back to awaiting_share when no share landed yet", async () => {
    sender.getSharedLocation.mockResolvedValue(undefined);
    claimedResolveDb();
    const out = await resolveDueLocationRequests(db.client());
    expect(out).toEqual({ resolved: 0, expired: 0 });
    expect(
      db.updates.some(
        (u) =>
          u.table === "location_requests" &&
          u.patch["status"] === "awaiting_share"
      )
    ).toBe(true);
  });

  it("delivers a caption appended while the provider probe ran", async () => {
    claimedResolveDb(base, {
      freshBurst: ["tacos near me", "open now"],
    });
    const out = await resolveDueLocationRequests(db.client());
    expect(out).toEqual({ resolved: 1, expired: 0 });
    const insert = db.queries.find(
      (q) => q.table === "batch_queue" && q.mode === "insert"
    );
    const rows = insert!.args[0] as { body: string }[];
    expect(rows.map((r) => r.body)).toContain("open now");
  });

  it("drops delivery when the request was superseded mid-resolution", async () => {
    claimedResolveDb(base, { superseded: true });
    const out = await resolveDueLocationRequests(db.client());
    expect(out).toEqual({ resolved: 0, expired: 0 });
    expect(
      db.queries.some((q) => q.table === "batch_queue" && q.mode === "insert")
    ).toBe(false);
    expect(
      db.updates.some(
        (u) =>
          u.table === "location_requests" && u.patch["status"] === "consumed"
      )
    ).toBe(false);
    expect(sender.sendText).not.toHaveBeenCalledWith(
      base.space_id,
      base.phone,
      expect.stringContaining("got it")
    );
  });
});
