/**
 * The wake waiter map and its exponential health probe (R-PERF-05):
 * concurrent callers for one box id share a single resume → health →
 * refresh pass instead of racing it, and the loop's sleeps widen
 * 1 s → 2 s → 4 s → 8 s rather than polling on a fixed 5 s tick.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureBoxAwake,
  wakeProbeDelayMs,
  wakeWaiters,
} from "./boxes";
import {
  command,
  getBox,
  hostRoute,
  resume,
  waitForBox,
} from "../box/client";
import { health } from "../hermes/client";

vi.mock("../box/client", () => ({
  command: vi.fn(),
  getBox: vi.fn(),
  hostRoute: vi.fn(),
  isStartLimit: vi.fn().mockReturnValue(false),
  resume: vi.fn(),
  waitForBox: vi.fn(),
}));
vi.mock("../hermes/client", () => ({ health: vi.fn() }));
vi.mock("../brand/mirror", () => ({ mirrorBrandIfStale: vi.fn() }));
vi.mock("../box/events", () => ({
  recordBoxStateEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../compute/runtime", () => ({ boxTarget: vi.fn() }));
vi.mock("../provisioning/connectors", () => ({
  writeConnectedToolsFile: vi.fn(),
}));

function fakeSupabase(boxId: string) {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                provider_box_id: boxId,
                hosted_url: "https://box.example",
                hosted_token: "",
                api_server_key: "k",
                dashboard_url: null,
                dashboard_token: null,
                dashboard_auth: null,
              },
              error: null,
            }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  };
  return supabase as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.mocked(command).mockReset();
  vi.mocked(getBox).mockReset();
  vi.mocked(resume).mockReset();
  vi.mocked(waitForBox).mockReset();
  vi.mocked(health).mockReset();
  vi.mocked(health).mockResolvedValue(true);
  vi.mocked(command).mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" } as never);
  vi.mocked(hostRoute).mockReset();
  vi.mocked(hostRoute).mockResolvedValue({
    url: "https://box.example",
    token: "fresh",
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Drive the wake loop's probe sleeps until `ensureBoxAwake` settles. The
 * catch keeps the sentinel branch from becoming an unhandled rejection when
 * the wake under test fails; the returned promise still carries it. */
async function settle(p: Promise<unknown>) {
  let done = false;
  void p
    .catch(() => undefined)
    .finally(() => {
      done = true;
    });
  while (!done) await vi.advanceTimersByTimeAsync(5_000);
  return p;
}

describe("wakeProbeDelayMs", () => {
  it("doubles to the 8 s cap", () => {
    expect(
      [1, 2, 3, 4, 5, 6].map((attempt) => wakeProbeDelayMs(attempt))
    ).toEqual([1_000, 2_000, 4_000, 8_000, 8_000, 8_000]);
  });
});

describe("ensureBoxAwake's waiter map", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    vi.mocked(resume).mockResolvedValue(undefined as never);
    vi.mocked(waitForBox).mockResolvedValue(undefined as never);
  });

  it("shares one resume across concurrent callers for the same box", async () => {
    // Slow the gateway so both callers are in-flight inside one wake.
    let probes = 0;
    vi.mocked(health).mockImplementation(async () => ++probes > 4);
    const first = ensureBoxAwake(fakeSupabase("bx_shared"), "user-1");
    const second = ensureBoxAwake(fakeSupabase("bx_shared"), "user-1");
    await Promise.all([settle(first), settle(second)]);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toMatchObject({ boxId: "bx_shared" });
    expect(b).toMatchObject({ boxId: "bx_shared" });
    expect(resume).toHaveBeenCalledTimes(1);
    // Every waiter gets the refreshed route the shared pass produced.
    expect(a.target.hostedToken).toBe("fresh");
    expect(b.target.hostedToken).toBe("fresh");
  });

  it("clears the entry once the wake settles so a later call wakes again", async () => {
    await settle(ensureBoxAwake(fakeSupabase("bx_again"), "user-1"));
    expect(wakeWaiters.get("bx_again")).toBeUndefined();
    await settle(ensureBoxAwake(fakeSupabase("bx_again"), "user-1"));
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it("clears the entry on failure so a retry is not stuck on a dead waiter", async () => {
    vi.mocked(waitForBox).mockRejectedValueOnce(new Error("provider gone"));
    await expect(
      settle(ensureBoxAwake(fakeSupabase("bx_dead"), "user-1"))
    ).rejects.toThrow("provider gone");
    expect(wakeWaiters.get("bx_dead")).toBeUndefined();
    vi.mocked(waitForBox).mockResolvedValue(undefined as never);
    await expect(
      settle(ensureBoxAwake(fakeSupabase("bx_dead"), "user-1"))
    ).resolves.toMatchObject({ boxId: "bx_dead" });
  });
});

describe("the wake health probe", () => {
  it("sleeps 1 s, 2 s, 4 s, then 8 s between probes", async () => {
    vi.useFakeTimers();
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    vi.mocked(resume).mockResolvedValue(undefined as never);
    vi.mocked(waitForBox).mockResolvedValue(undefined as never);
    const timeouts = vi.spyOn(globalThis, "setTimeout");
    // Unhealthy through four probe iterations: iteration n sleeps
    // wakeProbeDelayMs(n) before the (n+1)th loop check.
    let probes = 0;
    vi.mocked(health).mockImplementation(async () => ++probes > 9);
    await settle(ensureBoxAwake(fakeSupabase("bx_slow"), "user-1"));
    const delays = timeouts.mock.calls
      .map((call) => call[1])
      .filter((ms): ms is number => typeof ms === "number" && ms > 0);
    expect(delays.slice(0, 4)).toEqual([1_000, 2_000, 4_000, 8_000]);
    timeouts.mockRestore();
  });
});
