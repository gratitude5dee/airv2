/**
 * Bulk stop contract: bearer auth against ADMIN_API_KEY, channel validation
 * (default dev), only ready/idle boxes on the channel are targeted, and each
 * is handed to stopIdleBoxes with a zero overdue window — the claim path
 * decides, and nothing is force-stopped (C6).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { stopIdleBoxes, type IdleStopReport } from "@/lib/orchestrator/idleStop";

const db = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  error: null as { message: string } | null,
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("@/lib/orchestrator/idleStop", () => ({ stopIdleBoxes: vi.fn() }));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    expect(table).toBe("boxes");
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "order", "range"]) {
      chain[method] = vi.fn(self);
    }
    chain["eq"] = vi.fn((column: string, value: unknown) => {
      db.filters.push([column, value]);
      return chain;
    });
    chain["in"] = vi.fn((column: string, value: unknown) => {
      db.filters.push([column, value]);
      return chain;
    });
    chain["then"] = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: db.error ? null : db.rows,
        error: db.error,
      }).then(resolve);
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

import { POST } from "./route";

const base = "https://air.test/api/admin/boxes/stop-idle";
const authed = (body?: string) =>
  new NextRequest(base, {
    method: "POST",
    headers: { authorization: "Bearer admin-key" },
    ...(body !== undefined ? { body } : {}),
  });

const EMPTY_REPORT: IdleStopReport = {
  stopped: 0,
  stopping: 0,
  indexingDeferred: 0,
  deferred: { pending: 0, grace: 0, busy: 0, claimed: 0, probe_failed: 0, legacy_grace: 0 },
  claimed: 0,
  legacyProbe: 0,
  legacyStop: 0,
  released: 0,
  releaseFailed: 0,
};

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.rows = [];
  db.error = null;
  db.filters = [];
  vi.resetAllMocks();
  vi.mocked(stopIdleBoxes).mockResolvedValue(EMPTY_REPORT);
});

describe("POST /api/admin/boxes/stop-idle", () => {
  it("401s without the admin key", async () => {
    const response = await POST(new NextRequest(base, { method: "POST" }));
    expect(response.status).toBe(401);
    expect(stopIdleBoxes).not.toHaveBeenCalled();
  });

  it("rejects an unknown channel and malformed json", async () => {
    expect((await POST(authed('{"channel":"staging"}'))).status).toBe(400);
    expect((await POST(authed("{nope"))).status).toBe(400);
    expect(stopIdleBoxes).not.toHaveBeenCalled();
  });

  it("targets running dev boxes by default with a zero overdue window", async () => {
    db.rows = [
      { provider_box_id: "bx_a", user_id: "u1", last_active_at: "2026-09-01T00:00:00Z" },
      { provider_box_id: "bx_b", user_id: "u2", last_active_at: null },
    ];
    vi.mocked(stopIdleBoxes).mockResolvedValue({ ...EMPTY_REPORT, stopped: 2, claimed: 2 });
    const before = Date.now();
    const response = await POST(authed());
    expect(response.status).toBe(200);
    expect(db.filters).toEqual([
      ["channel", "dev"],
      ["state", ["ready", "idle"]],
    ]);
    const [, boxes, now] = vi.mocked(stopIdleBoxes).mock.calls[0]!;
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(boxes).toEqual([
      { provider_box_id: "bx_a", user_id: "u1", stop_after: now.toISOString(), last_active_at: "2026-09-01T00:00:00Z" },
      { provider_box_id: "bx_b", user_id: "u2", stop_after: now.toISOString(), last_active_at: null },
    ]);
    expect(await response.json()).toMatchObject({
      channel: "dev",
      targeted: 2,
      stopped: 2,
      claimed: 2,
      indexingDeferred: 0,
    });
  });

  it("honors an explicit prod channel and passes the report through", async () => {
    db.rows = [{ provider_box_id: "bx_p", user_id: "u9", last_active_at: null }];
    vi.mocked(stopIdleBoxes).mockResolvedValue({
      ...EMPTY_REPORT,
      indexingDeferred: 1,
      deferred: { ...EMPTY_REPORT.deferred, busy: 1 },
    });
    const body = await (await POST(authed('{"channel":"prod"}'))).json();
    expect(db.filters[0]).toEqual(["channel", "prod"]);
    expect(body).toMatchObject({
      channel: "prod",
      targeted: 1,
      stopped: 0,
      indexingDeferred: 1,
      deferred: { busy: 1 },
    });
  });

  it("500s without stopping anything when the box read fails", async () => {
    db.error = { message: "boom" };
    expect((await POST(authed())).status).toBe(500);
    expect(stopIdleBoxes).not.toHaveBeenCalled();
  });
});
