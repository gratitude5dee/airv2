/**
 * ensureBoxAwake's resume path: the post-resume box-side cleanups it issues
 * (agent-browser daemon, the idle stop's claim) run only on a genuine
 * stopped→ready transition, never on a no-op wake of an awake box.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureBoxAwake } from "./boxes";
import { command, getBox, resume, waitForBox } from "../box/client";
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
});

describe("ensureBoxAwake after a provider resume", () => {
  it("voids the idle stop's claim on the box once it is back", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "stopped" } as never);
    vi.mocked(resume).mockResolvedValue(undefined as never);
    vi.mocked(waitForBox).mockResolvedValue(undefined as never);
    await ensureBoxAwake(fakeSupabase("tk_abc"), "user-1");
    expect(resume).toHaveBeenCalledWith("tk_abc");
    expect(command).toHaveBeenCalledWith("tk_abc", "ovctl resumed", 30);
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
