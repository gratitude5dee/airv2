import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  desktopStreamUrl,
  desktopStreamUrlIfUp,
  DesktopUnavailableError,
} from "./desktop";
import { getBox, requestDesktop } from "./client";
import { ensureBoxAwake, prewarmBox } from "../orchestrator/boxes";

vi.mock("./client", () => ({ requestDesktop: vi.fn(), getBox: vi.fn() }));
vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(),
  prewarmBox: vi.fn(async () => undefined),
}));

const supabase = {} as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
});

function supabaseWithBox(boxId: string | null): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () =>
      Promise.resolve({
        data: boxId ? { provider_box_id: boxId } : null,
        error: null,
      }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("desktopStreamUrl", () => {
  beforeEach(() => {
    vi.mocked(ensureBoxAwake).mockResolvedValue({
      boxId: "bx_1",
      target: { hostedUrl: "https://x", hostedToken: "t", apiServerKey: "k" },
    } as Awaited<ReturnType<typeof ensureBoxAwake>>);
  });

  it("wakes the user's existing box and returns the stream URL", async () => {
    vi.mocked(requestDesktop).mockResolvedValue(
      "https://d.on.ascii.dev/stream.html?token=abc"
    );
    await expect(desktopStreamUrl(supabase, "user-1")).resolves.toBe(
      "https://d.on.ascii.dev/stream.html?token=abc"
    );
    expect(ensureBoxAwake).toHaveBeenCalledWith(supabase, "user-1");
    expect(requestDesktop).toHaveBeenCalledWith("bx_1", undefined);
  });

  it("passes the vnc option through to the desktop request", async () => {
    vi.mocked(requestDesktop).mockResolvedValue(
      "https://d.on.ascii.dev/vnc.html?_token=abc"
    );
    await expect(
      desktopStreamUrl(supabase, "user-1", { vnc: true })
    ).resolves.toBe("https://d.on.ascii.dev/vnc.html?_token=abc");
    expect(requestDesktop).toHaveBeenCalledWith("bx_1", { vnc: true });
  });

  it("throws DesktopUnavailableError when the stream isn't up", async () => {
    vi.mocked(requestDesktop).mockResolvedValue(undefined);
    await expect(desktopStreamUrl(supabase, "user-1")).rejects.toBeInstanceOf(
      DesktopUnavailableError
    );
  });
});

describe("desktopStreamUrlIfUp", () => {
  it("returns the stream URL without waking when the machine is up", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "idle" } as Awaited<
      ReturnType<typeof getBox>
    >);
    vi.mocked(requestDesktop).mockResolvedValue(
      "https://d.on.ascii.dev/stream.html?token=abc"
    );
    await expect(
      desktopStreamUrlIfUp(supabaseWithBox("bx_1"), "user-1")
    ).resolves.toEqual({
      status: "up",
      url: "https://d.on.ascii.dev/stream.html?token=abc",
    });
    expect(prewarmBox).not.toHaveBeenCalled();
  });

  it("kicks a resume and reports waking when the machine is down", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "archived" } as Awaited<
      ReturnType<typeof getBox>
    >);
    await expect(
      desktopStreamUrlIfUp(supabaseWithBox("bx_1"), "user-1")
    ).resolves.toEqual({ status: "waking" });
    expect(prewarmBox).toHaveBeenCalled();
    expect(requestDesktop).not.toHaveBeenCalled();
  });

  it("reports waking when the machine is up but the stream isn't ready", async () => {
    vi.mocked(getBox).mockResolvedValue({ state: "ready" } as Awaited<
      ReturnType<typeof getBox>
    >);
    vi.mocked(requestDesktop).mockResolvedValue(undefined);
    await expect(
      desktopStreamUrlIfUp(supabaseWithBox("bx_1"), "user-1")
    ).resolves.toEqual({ status: "waking" });
  });
});
