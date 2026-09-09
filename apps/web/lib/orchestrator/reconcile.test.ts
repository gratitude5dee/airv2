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

  it("marks a parked or dead box stopped", async () => {
    for (const state of ["stopped", "archived", "error"]) {
      vi.mocked(getBox).mockResolvedValue({ state } as never);
      expect(await reconcileVerdict("tk_1")).toBe("stopped");
    }
  });

  it("leaves a stop the provider is still finishing alone", async () => {
    for (const state of ["stopping", "archiving"]) {
      vi.mocked(getBox).mockResolvedValue({ state } as never);
      expect(await reconcileVerdict("tk_1")).toBe("pending");
    }
  });

  it("leaves a boot the provider is still finishing alone", async () => {
    // A stale `starting` row whose VM is still coming up must not be written
    // `stopped`: that would hide a soon-to-be-running box from the sweeper.
    for (const state of ["cloning", "starting", "provisioned"]) {
      vi.mocked(getBox).mockResolvedValue({ state } as never);
      expect(await reconcileVerdict("bx_1")).toBe("pending");
    }
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
