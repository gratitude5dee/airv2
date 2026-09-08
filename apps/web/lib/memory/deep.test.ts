import { beforeEach, describe, expect, it, vi } from "vitest";
import { command } from "@/lib/box/client";
import { deepMemoryClear, deepMemoryReindex, deepMemoryStatus, isDeepMemoryClearScope } from "./deep";

vi.mock("@/lib/box/client", () => ({ command: vi.fn() }));

describe("durable indexing status", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([0, 3])("preserves a reported pending count of %s", async (pending) => {
    vi.mocked(command).mockResolvedValue({ exitCode: 0, stdout: JSON.stringify({ healthy: true, pending }), stderr: "" });
    expect(await deepMemoryStatus("box")).toMatchObject({ healthy: true, pending });
  });

  it.each([undefined, -1, 0.5, "0"])("does not mistake invalid or missing progress for an empty queue: %s", async (pending) => {
    vi.mocked(command).mockResolvedValue({ exitCode: 0, stdout: JSON.stringify({ healthy: true, pending }), stderr: "" });
    expect((await deepMemoryStatus("box")).pending).toBeNull();
  });

  it("reports unknown progress when the command fails", async () => {
    vi.mocked(command).mockRejectedValue(new Error("unavailable"));
    expect(await deepMemoryStatus("box")).toMatchObject({ healthy: false, pending: null });
  });

  it("enqueues reindex with a bounded command budget after configuration succeeds", async () => {
    vi.mocked(command).mockResolvedValue({ exitCode: 0, stdout: "{}", stderr: "" });
    expect(await deepMemoryReindex("box")).toBe(true);
    expect(command).toHaveBeenNthCalledWith(1, "box", "ovctl ensure", 180);
    expect(command).toHaveBeenNthCalledWith(2, "box", "ovctl reindex", 60);
  });

  it("does not enqueue when configuration fails", async () => {
    vi.mocked(command).mockResolvedValue({ exitCode: 1, stdout: "{}", stderr: "" });
    expect(await deepMemoryReindex("box")).toBe(false);
    expect(command).toHaveBeenCalledTimes(1);
  });
});

describe("owner clear", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it.each(["resources", "memories", "all"] as const)("configures, then runs ovctl clear with a quoted %s scope and a bounded budget", async (scope) => {
    vi.mocked(command).mockResolvedValue({ exitCode: 0, stdout: JSON.stringify({ ok: true, scope }), stderr: "" });
    expect(await deepMemoryClear("box", scope)).toBe(true);
    expect(command).toHaveBeenNthCalledWith(1, "box", "ovctl ensure", 180);
    expect(command).toHaveBeenNthCalledWith(2, "box", `ovctl clear --scope '${scope}'`, 600);
  });

  it("does not clear when configuration fails", async () => {
    vi.mocked(command).mockResolvedValue({ exitCode: 1, stdout: "{}", stderr: "" });
    expect(await deepMemoryClear("box", "all")).toBe(false);
    expect(command).toHaveBeenCalledTimes(1);
  });

  it("reports a non-zero exit as failure with a metadata-only log line", async () => {
    vi.mocked(command)
      .mockResolvedValueOnce({ exitCode: 0, stdout: "{}", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 1, stdout: JSON.stringify({ ok: false, scope: "all", failed: ["viking://user"] }), stderr: "" });
    expect(await deepMemoryClear("box", "all")).toBe(false);
    const line = JSON.parse(String(vi.mocked(console.log).mock.calls[0]?.[0]));
    expect(line).toEqual({ msg: "deep memory clear", box_id: "box", scope: "all", ok: false });
  });

  it("reports a box command error as failure", async () => {
    vi.mocked(command).mockRejectedValue(new Error("unavailable"));
    expect(await deepMemoryClear("box", "memories")).toBe(false);
  });

  it.each(["everything", "", 1, null, "all; rm -rf /"])("rejects scope %j", (scope) => {
    expect(isDeepMemoryClearScope(scope)).toBe(false);
  });
});
