/**
 * MA9.3 — the W&B mirror is dormant by default: with no WANDB_API_KEY it
 * must make ZERO network calls; with a key it sends receipt metadata only.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mapAgentRun } from "./receipts";
import { mirrorReceipts, weaveEnabled } from "./weave";

const fetchSpy = vi.fn(async () => new Response("{}"));
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
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("wandb.ai");
    const body = String(init.body);
    expect(body).toContain("agent_run");
    // stable receipt keys only — never transcript lines
    expect(body).not.toContain("transcript_message");
  });

  it("swallows mirror failures", async () => {
    process.env["WANDB_API_KEY"] = "test-key";
    fetchSpy.mockRejectedValueOnce(new Error("boom"));
    await expect(mirrorReceipts([mapAgentRun({ id: "r1" })])).resolves.toBe(
      undefined
    );
  });
});
