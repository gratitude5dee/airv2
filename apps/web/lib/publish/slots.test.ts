import { beforeEach, describe, expect, it } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";
import {
  capHeadroom,
  claimSlot,
  isValidTimeZone,
  zonedTimeToInstant,
  type ContentSlot,
} from "./slots";

const db = new FakeSupabase();
const supabase = db.client();

beforeEach(() => db.reset());

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
    db.tables["content_slots"] = [{ ...slot() }];
    expect(await claimSlot(supabase, slot())).toBeDefined();
    expect(db.updates[0]?.patch).toMatchObject({
      status: "publishing",
      attempt_epoch: 4,
    });

    // The loser sees a row whose epoch already moved — the CAS misses.
    db.tables["content_slots"] = [{ ...slot({ attempt_epoch: 4 }) }];
    expect(await claimSlot(supabase, slot())).toBeUndefined();
  });

  it("filters scheduled slots on status", async () => {
    db.tables["content_slots"] = [{ ...slot() }];
    await claimSlot(supabase, slot());
    db.expectQuery({
      table: "content_slots",
      filters: { id: "slot-1", status: "scheduled", attempt_epoch: 3 },
    });
    expect(
      db.filters.some((f) => f.op === "lt" && f.column === "claimed_at")
    ).toBe(false);
  });

  it("reclaims a publishing slot only past the claim TTL", async () => {
    const stale = new Date(Date.now() - 3_600_000).toISOString();
    db.tables["content_slots"] = [
      { ...slot({ status: "publishing", claimed_at: stale }) },
    ];
    const claimed = await claimSlot(
      supabase,
      slot({ status: "publishing", claimed_at: stale })
    );
    expect(claimed).toBeDefined();
    db.expectQuery({
      table: "content_slots",
      filters: { id: "slot-1", status: "publishing" },
    });
    expect(
      db.filters.some((f) => f.op === "lt" && f.column === "claimed_at")
    ).toBe(true);

    // A claim still inside its TTL does not match the CAS.
    db.reset();
    db.tables["content_slots"] = [
      {
        ...slot({
          status: "publishing",
          claimed_at: new Date().toISOString(),
        }),
      },
    ];
    expect(
      await claimSlot(supabase, slot({ status: "publishing" }))
    ).toBeUndefined();
  });
});

function seedPublishes(publishedAts: string[]) {
  db.tables["content_slots"] = publishedAts.map((published_at, index) => ({
    ...slot({
      id: `slot-pub-${index}`,
      user_id: "u",
      account_ref: "a",
      status: "published",
      published_at,
    }),
  }));
}

describe("capHeadroom", () => {
  it("allows under the cap", async () => {
    seedPublishes([new Date(Date.now() - 3_600_000).toISOString()]);
    const headroom = await capHeadroom(supabase, "u", "instagram", "a", 25);
    expect(headroom).toMatchObject({
      allowed: true,
      used: 1,
      cap: 25,
      nextWindow: null,
    });
  });

  it("defers at the cap with the next window from the oldest publish", async () => {
    const oldest = Date.now() - 23 * 3_600_000;
    seedPublishes(
      Array.from({ length: 25 }, (_, index) =>
        new Date(oldest + index * 60_000).toISOString()
      )
    );
    const headroom = await capHeadroom(supabase, "u", "instagram", "a", 25);
    expect(headroom.allowed).toBe(false);
    expect(headroom.nextWindow).toBe(
      new Date(oldest + 24 * 3_600_000).toISOString()
    );
  });
});
