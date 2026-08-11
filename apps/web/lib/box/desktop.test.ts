import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { desktopStreamUrl, DesktopUnavailableError } from "./desktop";
import { requestDesktop } from "./client";
import { ensureBoxAwake } from "../orchestrator/boxes";

vi.mock("./client", () => ({ requestDesktop: vi.fn() }));
vi.mock("../orchestrator/boxes", () => ({ ensureBoxAwake: vi.fn() }));

const supabase = {} as SupabaseClient;

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
