import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stop } from "@/lib/box/client";
import { recordBoxStateEvent } from "@/lib/box/events";
import { claimIdleStop, releaseIdleStop } from "@/lib/orchestrator/indexIdle";
import type { SweepableBox } from "@/lib/orchestrator/sweep";
import { overdueMs, stopIdleBoxes } from "./idleStop";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

vi.mock("@/lib/box/client", () => ({ stop: vi.fn() }));
vi.mock("@/lib/box/events", () => ({ recordBoxStateEvent: vi.fn() }));
vi.mock("@/lib/orchestrator/indexIdle", () => ({
  claimIdleStop: vi.fn(),
  releaseIdleStop: vi.fn(),
}));

const NOW = new Date("2026-09-01T12:00:00.000Z");
const TOKEN = "0123456789abcdef0123456789abcdef";

function makeSupabase(boxes: SweepableBox[]): {
  supabase: ReturnType<FakeSupabase["client"]>;
  db: FakeSupabase;
} {
  const db = new FakeSupabase();
  db.tables["boxes"] = boxes.map((b) => ({
    provider_box_id: b.provider_box_id,
    user_id: b.user_id,
    state: "ready",
    stop_after: b.stop_after,
    last_active_at: b.last_active_at,
  }));
  return { supabase: db.client(), db };
}

const boxStates = (db: FakeSupabase) =>
  db.updates.map((u) => u.patch["state"]);

function box(id: string, minutesOverdue = 1): SweepableBox {
  return {
    provider_box_id: id,
    user_id: `user-${id}`,
    stop_after: new Date(NOW.getTime() - minutesOverdue * 60_000).toISOString(),
    last_active_at: new Date(NOW.getTime() - 3_600_000).toISOString(),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("stopIdleBoxes", () => {
  it("does not claim another box once the request budget is exhausted", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
    vi.mocked(claimIdleStop).mockResolvedValue({ kind: "claimed", token: TOKEN });
    vi.mocked(stop).mockImplementation(async () => {
      clock.mockReturnValue(NOW.getTime() + 150_000);
      return { id: "b1", state: "stopping" };
    });
    const boxes = [box("b1"), box("b2")];
    const { supabase } = makeSupabase(boxes);
    const report = await stopIdleBoxes(
      supabase, boxes, NOW, NOW.getTime() + 150_000
    );
    expect(report).toMatchObject({ processed: 1, stopping: 1 });
    expect(claimIdleStop).toHaveBeenCalledTimes(1);
    expect(releaseIdleStop).not.toHaveBeenCalled();
  });

  it("leaves every box untouched when listing consumed the request budget", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
    const boxes = [box("b1")];
    const { supabase } = makeSupabase(boxes);
    const report = await stopIdleBoxes(supabase, boxes, NOW, NOW.getTime());
    expect(report.processed).toBe(0);
    expect(claimIdleStop).not.toHaveBeenCalled();
  });
  it("stops a box only after its claim is granted and records the edge", async () => {
    const order: string[] = [];
    vi.mocked(claimIdleStop).mockImplementation(async () => {
      order.push("claim");
      return { kind: "claimed", token: TOKEN };
    });
    vi.mocked(stop).mockImplementation(async () => {
      order.push("stop");
      return {} as never;
    });
    const { supabase, db } = makeSupabase([box("b1", 5)]);
    const report = await stopIdleBoxes(supabase, [box("b1", 5)], NOW);
    expect(order).toEqual(["claim", "stop"]);
    expect(claimIdleStop).toHaveBeenCalledWith("b1", 5 * 60_000);
    expect(boxStates(db)).toEqual(["stopping", "stopped"]);
    expect(db.updates[1]?.patch).toEqual({ state: "stopped", stop_after: null });
    expect(db.filters).toContainEqual({
      table: "boxes",
      op: "eq",
      column: "provider_box_id",
      value: "b1",
    });
    expect(db.rows("boxes").map((r) => r["state"])).toEqual(["stopped"]);
    expect(recordBoxStateEvent).toHaveBeenCalledWith(expect.anything(), "user-b1", "stopped");
    expect(releaseIdleStop).not.toHaveBeenCalled();
    expect(report).toMatchObject({ stopped: 1, claimed: 1, indexingDeferred: 0, released: 0 });
  });

  it("leaves the row in stopping when the provider is still writing the snapshot", async () => {
    vi.mocked(claimIdleStop).mockResolvedValue({ kind: "claimed", token: TOKEN });
    vi.mocked(stop).mockResolvedValue({ state: "stopping" } as never);
    const { supabase, db } = makeSupabase([box("tk_1")]);
    const report = await stopIdleBoxes(supabase, [box("tk_1")], NOW);
    expect(boxStates(db)).toEqual(["stopping"]);
    expect(db.rows("boxes").map((r) => r["state"])).toEqual(["stopping"]);
    expect(recordBoxStateEvent).not.toHaveBeenCalled();
    expect(releaseIdleStop).not.toHaveBeenCalled();
    expect(report).toMatchObject({ stopped: 0, stopping: 1, claimed: 0 });
  });

  it("defers without touching the box or its row, and reports why", async () => {
    vi.mocked(claimIdleStop)
      .mockResolvedValueOnce({ kind: "deferred", reason: "pending" })
      .mockResolvedValueOnce({ kind: "deferred", reason: "grace" })
      .mockResolvedValueOnce({ kind: "deferred", reason: "probe_failed" })
      .mockResolvedValueOnce({ kind: "deferred", reason: "busy" })
      .mockResolvedValueOnce({ kind: "deferred", reason: "legacy_grace" });
    const boxes = ["b1", "b2", "b3", "b4", "b5"].map((id) => box(id));
    const { supabase, db } = makeSupabase(boxes);
    const report = await stopIdleBoxes(supabase, boxes, NOW);
    expect(stop).not.toHaveBeenCalled();
    expect(db.updates).toEqual([]);
    expect(report.stopped).toBe(0);
    expect(report.indexingDeferred).toBe(5);
    expect(report.deferred).toEqual({ pending: 1, grace: 1, busy: 1, claimed: 0, probe_failed: 1, legacy_grace: 1 });
    // A failed probe is the one deferral that may hide a stuck box: it is logged.
    expect(vi.mocked(console.error).mock.calls.map((call) => JSON.parse(call[0] as string).msg)).toEqual([
      "sweeper idle probe failed",
    ]);
  });

  it("releases the claim and leaves the box ready when the provider refuses the stop", async () => {
    vi.mocked(claimIdleStop).mockResolvedValue({ kind: "claimed", token: TOKEN });
    vi.mocked(stop).mockRejectedValue(new Error("snapshot failed"));
    vi.mocked(releaseIdleStop).mockResolvedValue(true);
    const { supabase, db } = makeSupabase([box("b1")]);
    const report = await stopIdleBoxes(supabase, [box("b1")], NOW);
    expect(releaseIdleStop).toHaveBeenCalledWith("b1", TOKEN);
    expect(boxStates(db)).toEqual(["stopping", "ready"]);
    expect(db.rows("boxes").map((r) => r["state"])).toEqual(["ready"]);
    expect(recordBoxStateEvent).not.toHaveBeenCalled();
    expect(report).toMatchObject({ stopped: 0, claimed: 0, released: 1, releaseFailed: 0 });
  });

  it("counts a release the box did not acknowledge so a leaked claim is visible", async () => {
    vi.mocked(claimIdleStop).mockResolvedValue({ kind: "claimed", token: TOKEN });
    vi.mocked(stop).mockRejectedValue(new Error("snapshot failed"));
    vi.mocked(releaseIdleStop).mockResolvedValue(false);
    const { supabase } = makeSupabase([box("b1")]);
    const report = await stopIdleBoxes(supabase, [box("b1")], NOW);
    expect(report).toMatchObject({ released: 0, releaseFailed: 1 });
  });

  it("does not attempt a release for legacy stops, which hold no claim", async () => {
    vi.mocked(claimIdleStop)
      .mockResolvedValueOnce({ kind: "legacy_probe" })
      .mockResolvedValueOnce({ kind: "legacy_stop" });
    vi.mocked(stop).mockRejectedValueOnce(new Error("refused")).mockResolvedValueOnce({} as never);
    const boxes = [box("old1"), box("old2")];
    const { supabase } = makeSupabase(boxes);
    const report = await stopIdleBoxes(supabase, boxes, NOW);
    expect(releaseIdleStop).not.toHaveBeenCalled();
    expect(report).toMatchObject({ stopped: 1, legacyProbe: 0, legacyStop: 1, claimed: 0 });
  });

  it("keeps going after one box fails", async () => {
    vi.mocked(claimIdleStop).mockResolvedValue({ kind: "claimed", token: TOKEN });
    vi.mocked(stop).mockRejectedValueOnce(new Error("refused")).mockResolvedValueOnce({} as never);
    vi.mocked(releaseIdleStop).mockResolvedValue(true);
    const boxes = [box("b1"), box("b2")];
    const { supabase } = makeSupabase(boxes);
    const report = await stopIdleBoxes(supabase, boxes, NOW);
    expect(report).toMatchObject({ stopped: 1, claimed: 1, released: 1 });
  });
});

describe("overdueMs", () => {
  it("measures from the armed deadline, else the last activity, never negative", () => {
    expect(overdueMs(box("b", 7), NOW)).toBe(7 * 60_000);
    expect(overdueMs({ ...box("b"), stop_after: null }, NOW)).toBe(3_600_000);
    expect(overdueMs({ ...box("b"), stop_after: null, last_active_at: null }, NOW)).toBe(0);
    expect(overdueMs({ ...box("b"), stop_after: new Date(NOW.getTime() + 60_000).toISOString() }, NOW)).toBe(0);
    expect(overdueMs({ ...box("b"), stop_after: "not a date" }, NOW)).toBe(0);
  });
});
