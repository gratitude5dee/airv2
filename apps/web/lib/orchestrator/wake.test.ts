/**
 * ensureBoxAwake's resume path: the post-resume box-side cleanups it issues
 * (agent-browser daemon, the idle stop's claim) run only on a genuine
 * stopped→ready transition, never on a no-op wake of an awake box.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGENT_BROWSER_RESET_CMD,
  ensureBoxAwake,
  HERMES_RESTART_GRACE_MS,
  VOID_STOP_CLAIM_CMD,
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

const RESTART_CMD = "sudo systemctl restart hermes-gateway hermes-dashboard hermes-host";
const restartCalls = () =>
  vi.mocked(command).mock.calls.filter(([, cmd]) => cmd === RESTART_CMD);

/** Drive the wake loop's 5s polls until `ensureBoxAwake` settles. */
async function settle(p: Promise<unknown>) {
  let done = false;
  void p.finally(() => {
    done = true;
  });
  while (!done) await vi.advanceTimersByTimeAsync(5_000);
  return p;
}

describe("ensureBoxAwake while the gateway is still booting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    vi.mocked(resume).mockResolvedValue(undefined as never);
    vi.mocked(waitForBox).mockResolvedValue(undefined as never);
  });

  it("does not restart hermes just because the first refreshed probe failed", async () => {
    // Unhealthy for ~30s after the VM is ready (gateway loading plugins),
    // then listening — the normal ascii.dev cold-boot shape.
    const healthyAt = Date.now() + 30_000;
    vi.mocked(health).mockImplementation(async () => Date.now() >= healthyAt);
    await settle(ensureBoxAwake(fakeSupabase("bx_cold"), "user-1"));
    expect(restartCalls()).toHaveLength(0);
    expect(hostRoute).toHaveBeenCalled();
  });

  it("restarts the units once the boot grace has elapsed and stays unhealthy", async () => {
    const restartAt = Date.now() + HERMES_RESTART_GRACE_MS;
    let restartedAt: number | null = null;
    vi.mocked(command).mockImplementation(async (_id, cmd) => {
      if (cmd === RESTART_CMD) restartedAt = Date.now();
      return { exitCode: 0, stdout: "", stderr: "" } as never;
    });
    // Only a restart brings the gateway back.
    vi.mocked(health).mockImplementation(async () => restartedAt !== null);
    await settle(ensureBoxAwake(fakeSupabase("bx_dead"), "user-1"));
    expect(restartCalls()).toHaveLength(1);
    expect(restartedAt).not.toBeNull();
    expect(restartedAt!).toBeGreaterThanOrEqual(restartAt);
  });
});

describe("ensureBoxAwake after a provider resume", () => {
  it("voids the idle stop's claim on the box once it is back", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    vi.mocked(resume).mockResolvedValue(undefined as never);
    vi.mocked(waitForBox).mockResolvedValue(undefined as never);
    await ensureBoxAwake(fakeSupabase("tk_abc"), "user-1");
    expect(resume).toHaveBeenCalledWith("tk_abc");
    expect(command).toHaveBeenCalledWith("tk_abc", VOID_STOP_CLAIM_CMD, 30);
  });

  it("retries the box-side housekeeping when the command agent is not up yet", async () => {
    vi.useFakeTimers();
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    vi.mocked(resume).mockResolvedValue(undefined as never);
    vi.mocked(waitForBox).mockResolvedValue(undefined as never);
    let boxCalls = 0;
    vi.mocked(command).mockImplementation(async () => {
      boxCalls += 1;
      // ascii reports the VM ready before its agent accepts commands.
      if (boxCalls === 1) throw new Error("agent not ready");
      return { exitCode: 0, stdout: "", stderr: "" } as never;
    });
    await settle(ensureBoxAwake(fakeSupabase("bx_abc"), "user-1"));
    await vi.advanceTimersByTimeAsync(10_000);
    const boxSide = vi
      .mocked(command)
      .mock.calls.map(([, cmd]) => cmd)
      .filter((cmd) => cmd === AGENT_BROWSER_RESET_CMD || cmd === VOID_STOP_CLAIM_CMD);
    expect(boxSide).toEqual([
      AGENT_BROWSER_RESET_CMD,
      AGENT_BROWSER_RESET_CMD,
      VOID_STOP_CLAIM_CMD,
    ]);
  });

  it("tolerates a box whose ovctl predates the subcommand", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    vi.mocked(resume).mockResolvedValue(undefined as never);
    vi.mocked(waitForBox).mockResolvedValue(undefined as never);
    vi.mocked(command).mockRejectedValue(new Error("exit 2"));
    await expect(
      ensureBoxAwake(fakeSupabase("bx_old"), "user-1")
    ).resolves.toMatchObject({ boxId: "bx_old" });
  });

  it("issues nothing box-side when the box was already awake", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "ready" } as never);
    await ensureBoxAwake(fakeSupabase("tk_abc"), "user-1");
    expect(resume).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });
});
