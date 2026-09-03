/**
 * fal's reference-to-video rejects audio as the sole reference. The executor
 * has to refuse that turn itself — before the queue submit — so the user
 * gets a line instead of a provider error and no render is booked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIO_NEEDS_VISUAL_LINE, generateZapVideo } from "./fal";
import { underDailyLimit, updateCreativeJob } from "./jobs";
import { executeCreativeJob } from "./run";

vi.mock("./fal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./fal")>()),
  generateZapVideo: vi.fn(),
}));
vi.mock("./jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./jobs")>()),
  underDailyLimit: vi.fn(),
  updateCreativeJob: vi.fn().mockResolvedValue(undefined),
}));

describe("executeCreativeJob /zap references", () => {
  beforeEach(() => {
    vi.mocked(generateZapVideo).mockReset();
    vi.mocked(updateCreativeJob).mockClear();
    vi.mocked(underDailyLimit).mockResolvedValue(true);
  });

  it("refuses a voice memo with nothing to look at, without calling fal", async () => {
    const result = await executeCreativeJob({} as SupabaseClient, "job-1", "u1", {
      mode: "zap",
      cleanedText: "vibe",
      text: "/zap vibe",
      mediaInputs: [{ kind: "audio", url: "https://storage.test/memo.m4a" }],
    });

    expect(result).toEqual({ status: "refused", line: AUDIO_NEEDS_VISUAL_LINE });
    expect(generateZapVideo).not.toHaveBeenCalled();
    expect(updateCreativeJob).toHaveBeenLastCalledWith({}, "job-1", {
      status: "refused",
      error: AUDIO_NEEDS_VISUAL_LINE,
    });
  });
});
