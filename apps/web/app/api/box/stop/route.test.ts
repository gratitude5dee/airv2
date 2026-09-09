/**
 * User-initiated stop must persist what the provider actually reports: a
 * `stopping` result (snapshot taken, a session still up) keeps the row in
 * `stopping` for the sweeper's reconcile instead of recording a stop that
 * has not finished.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  box: null as Record<string, unknown> | null,
  updates: [] as { table: string; values: Record<string, unknown> }[],
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    let rows: unknown[] = [];
    chain["select"] = vi.fn(() => {
      rows = table === "boxes" && db.box ? [db.box] : [];
      return chain;
    });
    chain["update"] = vi.fn((values: Record<string, unknown>) => {
      db.updates.push({ table, values });
      return chain;
    });
    for (const method of ["eq", "is", "gt", "limit"]) {
      chain[method] = vi.fn(self);
    }
    chain["maybeSingle"] = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    chain["then"] = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve);
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

vi.mock("@/lib/auth/surface", () => ({
  requestSession: vi.fn(async () => ({ userId: "u1", surface: "web" })),
}));

const provider = vi.hoisted(() => ({ stop: vi.fn() }));
vi.mock("@/lib/box/client", () => ({ stop: provider.stop }));

const events = vi.hoisted(() => ({ recordBoxStateEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/box/events", () => events);

import { POST } from "./route";

const post = () =>
  new NextRequest("https://air.test/api/box/stop", { method: "POST" });

const boxUpdates = () => db.updates.filter((u) => u.table === "boxes").map((u) => u.values);

beforeEach(() => {
  db.box = { provider_box_id: "tk_abc", state: "ready" };
  db.updates = [];
  provider.stop.mockReset();
  events.recordBoxStateEvent.mockClear();
});

describe("POST /api/box/stop", () => {
  it("records stopped once the provider reports a terminal stop", async () => {
    provider.stop.mockResolvedValue({ id: "tk_abc", state: "stopped" });
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "stopped" });
    expect(boxUpdates()).toEqual([
      { state: "stopping", last_active_at: expect.any(String) },
      { state: "stopped", stop_after: null },
    ]);
    expect(events.recordBoxStateEvent).toHaveBeenCalledWith(expect.anything(), "u1", "stopped");
  });

  it("keeps the row stopping when the provider is still finishing the stop", async () => {
    // Tenki: snapshot ready but a (duplicate) session could not be confirmed
    // closed. The VM is still up, so nothing may claim it is stopped.
    provider.stop.mockResolvedValue({ id: "tk_abc", state: "stopping" });
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "stopping" });
    expect(boxUpdates()).toEqual([{ state: "stopping", last_active_at: expect.any(String) }]);
    expect(events.recordBoxStateEvent).not.toHaveBeenCalled();
  });

  it("keeps the row stopping while the provider is still archiving", async () => {
    // ascii.dev: stop() returns as soon as the archive begins; the VM is
    // not down until getBox() reports archived/stopped.
    provider.stop.mockResolvedValue({ id: "bx_abc", state: "archiving" });
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "stopping" });
    expect(boxUpdates()).toEqual([{ state: "stopping", last_active_at: expect.any(String) }]);
    expect(events.recordBoxStateEvent).not.toHaveBeenCalled();
  });

  it("puts the row back to ready when the provider refuses the stop", async () => {
    provider.stop.mockRejectedValue(new Error("snapshot failed"));
    const res = await POST(post());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "stop_refused" });
    expect(boxUpdates()).toEqual([
      { state: "stopping", last_active_at: expect.any(String) },
      { state: "ready" },
    ]);
    expect(events.recordBoxStateEvent).not.toHaveBeenCalled();
  });

  it("is a no-op for a row already stopping or stopped", async () => {
    db.box = { provider_box_id: "tk_abc", state: "stopping" };
    const res = await POST(post());
    expect(await res.json()).toEqual({ state: "stopping" });
    expect(provider.stop).not.toHaveBeenCalled();
    expect(boxUpdates()).toEqual([]);
  });
});
