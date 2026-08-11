import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { desktopStreamUrl, DesktopUnavailableError } from "./desktop";
import { getBox } from "./client";
import { ensureBoxAwake } from "../orchestrator/boxes";

vi.mock("./client", () => ({ getBox: vi.fn() }));
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
    vi.mocked(getBox).mockResolvedValue({
      id: "bx_1",
      state: "ready",
      desktopAvailable: true,
      desktopUrl: "https://d.on.ascii.dev/stream.html?token=abc",
    });
    await expect(desktopStreamUrl(supabase, "user-1")).resolves.toBe(
      "https://d.on.ascii.dev/stream.html?token=abc"
    );
    expect(ensureBoxAwake).toHaveBeenCalledWith(supabase, "user-1");
    expect(getBox).toHaveBeenCalledWith("bx_1");
  });

  it("throws DesktopUnavailableError when the stream isn't up", async () => {
    vi.mocked(getBox).mockResolvedValue({
      id: "bx_1",
      state: "ready",
      desktopAvailable: false,
    });
    await expect(desktopStreamUrl(supabase, "user-1")).rejects.toBeInstanceOf(
      DesktopUnavailableError
    );
  });

  it("throws when desktopUrl is missing even if flagged available", async () => {
    vi.mocked(getBox).mockResolvedValue({
      id: "bx_1",
      state: "ready",
      desktopAvailable: true,
    });
    await expect(desktopStreamUrl(supabase, "user-1")).rejects.toBeInstanceOf(
      DesktopUnavailableError
    );
  });
});
