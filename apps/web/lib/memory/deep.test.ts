import { beforeEach, describe, expect, it, vi } from "vitest";
import { command } from "@/lib/box/client";
import { deepMemoryReindex, deepMemoryStatus } from "./deep";

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
