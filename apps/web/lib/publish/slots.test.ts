import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  capHeadroom,
  claimSlot,
  isValidTimeZone,
  zonedTimeToInstant,
  type ContentSlot,
} from "./slots";

describe("zonedTimeToInstant", () => {
  it("resolves a wall-clock time before a DST transition", () => {
    // PST (UTC-8): 2026-02-10 09:00 LA = 17:00Z
    expect(
      zonedTimeToInstant("2026-02-10T09:00", "America/Los_Angeles").toISOString()
    ).toBe("2026-02-10T17:00:00.000Z");
  });

  it("keeps 09:00 local on the other side of a DST boundary", () => {
    // PDT (UTC-7): 2026-06-10 09:00 LA = 16:00Z — the local hour is what holds
    expect(
      zonedTimeToInstant("2026-06-10T09:00", "America/Los_Angeles").toISOString()
    ).toBe("2026-06-10T16:00:00.000Z");
  });

  it("handles zones east of UTC", () => {
    expect(
      zonedTimeToInstant("2026-08-10T09:00", "Asia/Tokyo").toISOString()
    ).toBe("2026-08-10T00:00:00.000Z");
  });

  it("handles half-hour offsets", () => {
    expect(
      zonedTimeToInstant("2026-08-10T09:00", "Asia/Kolkata").toISOString()
    ).toBe("2026-08-10T03:30:00.000Z");
  });

  it("rejects malformed local times", () => {
    expect(() => zonedTimeToInstant("tomorrow at 9", "UTC")).toThrow();
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });
});

/** Chainable stub standing in for the supabase update path: records the
 * filters applied and returns rows only when the CAS filters would match. */
function updateStub(rowsWhenMatched: unknown[], matches: (filters: Record<string, unknown>) => boolean) {
  const filters: Record<string, unknown> = {};
  const calls: { update?: Record<string, unknown> } = {};
  const chain = {
    update(values: Record<string, unknown>) {
      calls.update = values;
      return chain;
    },
    eq(column: string, value: unknown) {
      filters[`eq:${column}`] = value;
      return chain;
    },
    lt(column: string, value: unknown) {
      filters[`lt:${column}`] = value;
      return chain;
    },
    async select() {
      return { data: matches(filters) ? rowsWhenMatched : [] };
    },
  };
  return {
    client: { from: () => chain } as unknown as SupabaseClient,
    filters,
    calls,
  };
}

const slot = (overrides: Partial<ContentSlot> = {}): ContentSlot => ({
  id: "slot-1",
  user_id: "user-1",
  platform: "instagram",
  account_ref: "acct-1",
  package_ref: "pkg-1",
  scheduled_at: "2026-08-10T09:00:00.000Z",
  timezone: "America/Los_Angeles",
  status: "scheduled",
  attempt: 0,
  attempt_epoch: 3,
  claimed_at: null,
  publish_state: {},
  external_id: null,
  permalink: null,
  last_verdict: null,
  error_message: null,
  published_at: null,
  ...overrides,
});

describe("claimSlot", () => {
  it("wins only while attempt_epoch is unchanged — one winner per race", async () => {
    const won = updateStub([slot()], (filters) => filters["eq:attempt_epoch"] === 3);
    expect(await claimSlot(won.client, slot())).toBeDefined();
    expect(won.calls.update).toMatchObject({
      status: "publishing",
      attempt_epoch: 4,
    });

    const lost = updateStub([], () => false);
    expect(await claimSlot(lost.client, slot())).toBeUndefined();
  });

  it("filters scheduled slots on status", async () => {
    const stub = updateStub([slot()], () => true);
    await claimSlot(stub.client, slot());
    expect(stub.filters["eq:status"]).toBe("scheduled");
    expect(stub.filters["lt:claimed_at"]).toBeUndefined();
  });

  it("reclaims a publishing slot only past the claim TTL", async () => {
    const stub = updateStub([slot({ status: "publishing" })], () => true);
    await claimSlot(stub.client, slot({ status: "publishing" }));
    expect(stub.filters["eq:status"]).toBe("publishing");
    expect(typeof stub.filters["lt:claimed_at"]).toBe("string");
  });
});

function selectStub(rows: Array<{ published_at: string }>) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: async () => ({ data: rows }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("capHeadroom", () => {
  it("allows under the cap", async () => {
    const client = selectStub([
      { published_at: "2026-08-10T01:00:00.000Z" },
    ]);
    const headroom = await capHeadroom(client, "u", "instagram", "a", 25);
    expect(headroom).toMatchObject({ allowed: true, used: 1, cap: 25, nextWindow: null });
  });

  it("defers at the cap with the next window from the oldest publish", async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      published_at: new Date(
        Date.UTC(2026, 7, 10, 7, 40) + index * 60_000
      ).toISOString(),
    }));
    const headroom = await capHeadroom(selectStub(rows), "u", "instagram", "a", 25);
    expect(headroom.allowed).toBe(false);
    expect(headroom.nextWindow).toBe("2026-08-11T07:40:00.000Z");
  });
});
