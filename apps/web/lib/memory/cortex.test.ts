import { describe, expect, it, vi, beforeEach } from "vitest";
import { command } from "@/lib/box/client";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { cortexOverview, logCortexCalls } from "./cortex";

vi.mock("@/lib/box/client", () => ({ command: vi.fn() }));

function probeResult(doc: unknown) {
  return { exitCode: 0, stdout: JSON.stringify(doc), stderr: "" };
}

beforeEach(() => {
  vi.mocked(command).mockReset();
});

describe("cortexOverview call telemetry", () => {
  it("surfaces per-call telemetry from a reachable office", async () => {
    vi.mocked(command).mockResolvedValue(
      probeResult({
        configured: true,
        reachable: true,
        office_name: "Office",
        graph_url: null,
        totals: { raw: 3, embedded: 2, entities: 1 },
        sources: [],
        recent: [],
        calls: [
          { call: "cortex_manifest", ms: 120, ok: true },
          { call: "cortex_ask", ms: 340, ok: true },
        ],
      })
    );
    const overview = await cortexOverview("box");
    expect(overview.calls).toEqual([
      { call: "cortex_manifest", ms: 120, ok: true },
      { call: "cortex_ask", ms: 340, ok: true },
    ]);
  });

  it("keeps failed-call telemetry when the office is unreachable", async () => {
    vi.mocked(command).mockResolvedValue(
      probeResult({
        configured: true,
        reachable: false,
        calls: [{ call: "cortex_manifest", ms: 20000, ok: false }],
      })
    );
    const overview = await cortexOverview("box");
    expect(overview.configured).toBe(true);
    expect(overview.reachable).toBe(false);
    expect(overview.calls).toEqual([
      { call: "cortex_manifest", ms: 20000, ok: false },
    ]);
  });

  it("drops telemetry entries with unknown call names", async () => {
    vi.mocked(command).mockResolvedValue(
      probeResult({
        configured: true,
        reachable: false,
        calls: [{ call: "cortex_exfiltrate", ms: 1, ok: true }],
      })
    );
    const overview = await cortexOverview("box");
    expect(overview.calls).toEqual([]);
  });
});

describe("logCortexCalls", () => {
  it("inserts one content-free row per call", async () => {
    const db = new FakeSupabase();
    await logCortexCalls(db.client(), "user-1", [
      { call: "cortex_manifest", ms: 100, ok: true },
      { call: "cortex_ask", ms: 200, ok: false },
    ]);
    const rows = db.inserts.filter((entry) => entry.table === "cortex_calls");
    expect(rows.map((entry) => entry.row)).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        call: "cortex_manifest",
        ms: 100,
        ok: true,
      }),
      expect.objectContaining({
        user_id: "user-1",
        call: "cortex_ask",
        ms: 200,
        ok: false,
      }),
    ]);
  });

  it("skips the insert entirely when there were no calls", async () => {
    const db = new FakeSupabase();
    await logCortexCalls(db.client(), "user-1", []);
    expect(db.queries).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
  });

  it("never throws on an insert error", async () => {
    const db = new FakeSupabase();
    db.opErrors["cortex_calls:insert"] = { message: "boom" };
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      logCortexCalls(db.client(), "user-1", [
        { call: "cortex_ask", ms: 1, ok: true },
      ])
    ).resolves.toBeUndefined();
    errors.mockRestore();
  });
});
