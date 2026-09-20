import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureErrorMessage,
  isLiveVideo,
  waitForLiveVideo,
} from "./identity-booth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("photo booth camera readiness", () => {
  it("requires a live video track and decodable dimensions before showing live controls", () => {
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const stream = {
      getVideoTracks: () => [{ readyState: "live" }],
    } as unknown as MediaStream;
    const video = {
      srcObject: stream,
      readyState: 2,
      videoWidth: 1280,
      videoHeight: 720,
    };

    expect(isLiveVideo(video as HTMLVideoElement, stream)).toBe(true);
    video.videoWidth = 0;
    expect(isLiveVideo(video as HTMLVideoElement, stream)).toBe(false);
  });

  it("does not mark the camera live when video playback rejects", async () => {
    const stream = {
      getVideoTracks: () => [{ readyState: "live" }],
    } as unknown as MediaStream;
    const video = {
      srcObject: null,
      play: vi.fn(async () => {
        throw Object.assign(new Error("blocked"), { name: "NotAllowedError" });
      }),
    } as unknown as HTMLVideoElement;

    await expect(waitForLiveVideo(video, stream)).rejects.toMatchObject({
      name: "NotAllowedError",
    });
  });

  it("gives an actionable native fallback when playback or permission fails", () => {
    expect(captureErrorMessage({ name: "NotAllowedError" }, "photo")).toContain(
      "permission was blocked"
    );
    expect(captureErrorMessage({ name: "NotFoundError" }, "photo")).toContain(
      "native option below"
    );
  });
});
