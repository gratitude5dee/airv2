import { describe, expect, it, vi } from "vitest";
import { BoxApiError, getBox } from "@/lib/box/client";
import { reconcileVerdict } from "./reconcile";

vi.mock("@/lib/box/client", async () => {
  const types = await import("@/lib/box/types");
  return { BoxApiError: types.BoxApiError, getBox: vi.fn() };
});

describe("reconcileVerdict", () => {
  it("re-arms a box the provider reports live", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "ready" } as never);
    expect(await reconcileVerdict("bx_1")).toBe("ready");
    vi.mocked(getBox).mockResolvedValue({ state: "idle" } as never);
    expect(await reconcileVerdict("bx_1")).toBe("ready");
  });

  it("marks a parked box stopped", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    expect(await reconcileVerdict("tk_1")).toBe("stopped");
  });

  it("leaves a stop the provider is still finishing alone", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "stopping" } as never);
    expect(await reconcileVerdict("tk_1")).toBe("stopping");
  });

  it("treats a provider 404 as the box being gone", async () => {
    vi.mocked(getBox).mockRejectedValue(new BoxApiError(404, "not found"));
    expect(await reconcileVerdict("bx_1")).toBe("stopped");
  });

  it("propagates any other lookup failure instead of calling the box stopped", async () => {
    vi.mocked(getBox).mockRejectedValue(new BoxApiError(502, "upstream down"));
    await expect(reconcileVerdict("tk_1")).rejects.toMatchObject({ status: 502 });
    vi.mocked(getBox).mockRejectedValue(new Error("ECONNRESET"));
    await expect(reconcileVerdict("bx_1")).rejects.toThrow("ECONNRESET");
  });
});
