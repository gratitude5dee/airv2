/**
 * fal lip-sync request shape and the shared queue path: the endpoint id is
 * env-driven, the input carries exactly the documented fields, audio is
 * normalised to WAV first, and the submit/poll/result discipline is the
 * /zap driver's (injected seams, no network).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTwinLipsyncRequest,
  falTwinLipsyncModel,
  generateTwinLipsync,
} from "./lipsync";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildTwinLipsyncRequest", () => {
  it("targets the configured endpoint with the documented input fields", () => {
    expect(falTwinLipsyncModel()).toBe("minimax/h3-max/lip-sync/image-to-video");
    const request = buildTwinLipsyncRequest({
      imageUrl: "https://signed.example/profile.png",
      audioUrl: "https://signed.example/speech.mp3",
    });
    expect(request).toEqual({
      kind: "video",
      model: "minimax/h3-max/lip-sync/image-to-video",
      input: {
        resolution: "768P",
        enable_transcription: true,
        enable_safety_checker: true,
        image_url: "https://signed.example/profile.png",
        audio_url: "https://signed.example/speech.mp3",
      },
    });
  });

  it("follows FAL_TWIN_LIPSYNC_MODEL when the provider renames the endpoint", () => {
    vi.stubEnv("FAL_TWIN_LIPSYNC_MODEL", "minimax/h3-max-v2/lip-sync/image-to-video");
    expect(buildTwinLipsyncRequest({ imageUrl: "i", audioUrl: "a", resolution: "1080P" })).toMatchObject({
      model: "minimax/h3-max-v2/lip-sync/image-to-video",
      input: { resolution: "1080P" },
    });
  });
});

describe("generateTwinLipsync", () => {
  it("normalises the audio to WAV, submits once, polls, and returns the video", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const submits: Array<{ url: string; body: Record<string, unknown> }> = [];
    const submit = (async (input: string | URL | Request, init?: RequestInit) => {
      submits.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ request_id: "req-1" }), { status: 200 });
    }) as typeof fetch;
    const statuses = ["IN_PROGRESS", "COMPLETED"];
    const queue = {
      status: vi.fn(async () => ({ status: statuses.shift() ?? "COMPLETED" })),
      result: vi.fn(async () => ({
        data: { video: { url: "https://fal.media/files/twin.mp4" } },
      })),
    };
    const transcode = vi.fn(async () => ({
      audio: { url: "https://fal.media/files/speech.wav" },
    }));
    const stages: string[] = [];
    const media = await generateTwinLipsync(
      {
        imageUrl: "https://signed.example/profile.png",
        audioUrl: "https://signed.example/speech.mp3",
      },
      30_000,
      {
        submit,
        queue,
        transcode,
        onLifecycle: (event) => {
          stages.push(event.stage);
        },
      }
    );
    expect(media).toEqual({ kind: "video", url: "https://fal.media/files/twin.mp4" });
    expect(transcode).toHaveBeenCalledWith(
      "https://signed.example/speech.mp3",
      expect.any(AbortSignal)
    );
    expect(submits).toHaveLength(1);
    expect(submits[0]?.url).toBe(
      "https://queue.fal.run/minimax/h3-max/lip-sync/image-to-video"
    );
    expect(submits[0]?.body).toMatchObject({
      image_url: "https://signed.example/profile.png",
      audio_url: "https://fal.media/files/speech.wav",
      enable_safety_checker: true,
    });
    expect(stages).toEqual(["submitting", "submitted", "polling", "artifact_ready"]);
  });

  it("fails the turn before any submit when the audio cannot be normalised", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const submit = vi.fn() as unknown as typeof fetch;
    await expect(
      generateTwinLipsync(
        { imageUrl: "i", audioUrl: "https://signed.example/speech.m4a" },
        5_000,
        {
          submit,
          queue: { status: vi.fn(), result: vi.fn() },
          transcode: vi.fn(async () => {
            throw new Error("audio_load_error");
          }),
        }
      )
    ).rejects.toThrow(/transcode/);
    expect(submit).not.toHaveBeenCalled();
  });
});
