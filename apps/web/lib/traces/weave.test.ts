/**
 * MA9.3 — the W&B mirror is dormant by default: with no WANDB_API_KEY it
 * must make ZERO network calls; with a key it sends receipt metadata only.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mapAgentRun } from "./receipts";
import { mirrorReceipts, weaveEnabled } from "./weave";

const fetchSpy = vi.fn(async () =>
  Response.json({
    data: {
      viewer: { entity: "test-entity" },
      project: { name: "air-traces" },
      upsertModel: { model: { name: "air-traces" } },
      upsertBucket: { bucket: { name: "export-x" } },
    },
  })
);
vi.stubGlobal("fetch", fetchSpy);

afterEach(() => {
  fetchSpy.mockClear();
  delete process.env["WANDB_API_KEY"];
});

describe("weave mirror", () => {
  it("is disabled and makes zero egress without WANDB_API_KEY", async () => {
    delete process.env["WANDB_API_KEY"];
    expect(weaveEnabled()).toBe(false);
    await mirrorReceipts([mapAgentRun({ id: "r1" })]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("mirrors receipt metadata only when a key is set", async () => {
    process.env["WANDB_API_KEY"] = "test-key";
    expect(weaveEnabled()).toBe(true);
    await mirrorReceipts([
      mapAgentRun({
        id: "r1",
        outcome: "ok",
        started_at: "2026-08-01T00:00:00Z",
      }),
    ]);
    // viewer → project lookup (exists, so no upsertModel) → upsertBucket → file_stream
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    const bodies = fetchSpy.mock.calls.map((call) =>
      String((call as unknown as [string, RequestInit])[1].body)
    );
    expect(bodies.some((b) => b.includes("upsertModel"))).toBe(false);
    const [url, init] = fetchSpy.mock.calls[3] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("wandb.ai");
    expect(url).toContain("/files/test-entity/");
    expect(url).toContain("/file_stream");
    const body = String(init.body);
    expect(body).toContain("agent_run");
    // stable receipt keys only — never transcript lines
    expect(body).not.toContain("transcript_message");
  });

  it("creates the project when missing and bails if the run cannot be created", async () => {
    process.env["WANDB_API_KEY"] = "test-key";
    fetchSpy.mockImplementation(async (...args: unknown[]) => {
      const body = String((args[1] as RequestInit).body);
      if (body.includes("viewer"))
        return Response.json({ data: { viewer: { entity: "e" } } });
      if (body.includes("upsertBucket"))
        return Response.json({
          errors: [{ message: "driver: bad connection" }],
          data: { upsertBucket: null },
        });
      return Response.json({ data: { project: null, upsertModel: {} } });
    });
    await mirrorReceipts([mapAgentRun({ id: "r1" })]);
    const bodies = fetchSpy.mock.calls.map((call) =>
      String((call as unknown as [string, RequestInit])[1].body)
    );
    // project missing → upsertModel runs; upsertBucket fails twice → no file_stream
    expect(bodies.some((b) => b.includes("upsertModel"))).toBe(true);
    expect(bodies.filter((b) => b.includes("upsertBucket")).length).toBe(2);
    expect(
      fetchSpy.mock.calls.some((call) =>
        String((call as unknown as [string])[0]).includes("file_stream")
      )
    ).toBe(false);
    fetchSpy.mockImplementation(async () =>
      Response.json({
        data: {
          viewer: { entity: "test-entity" },
          project: { name: "air-traces" },
          upsertModel: { model: { name: "air-traces" } },
          upsertBucket: { bucket: { name: "export-x" } },
        },
      })
    );
  });

  it("swallows mirror failures", async () => {
    process.env["WANDB_API_KEY"] = "test-key";
    fetchSpy.mockRejectedValueOnce(new Error("boom"));
    await expect(mirrorReceipts([mapAgentRun({ id: "r1" })])).resolves.toBe(
      undefined
    );
  });
});
