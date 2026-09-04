import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AMBIGUOUS_COMMAND_LINE,
  parseExplicitGenerationCommand,
} from "./parse";
import { parseRouterPlan, type RouterPlan } from "./schema";
import {
  buildGenerationRequest,
  buildHeygenAvatarRequest,
  generateCompiledRequest,
  isAmbiguousSubmission,
  GmiCapacityError,
  GmiRequestError,
  type CreativeTurn,
} from "./gmi";
import {
  AUDIO_NEEDS_VISUAL_LINE,
  buildFalZapRequest,
  FalEnqueuedError,
  FalRequestError,
  FalSubmitUnknownError,
  generateZapVideo,
  isFalUnknownOutcome,
  zapReferenceProblem,
  type FalQueueReader,
} from "./fal";
import {
  assertSafeGeneratedMediaUrl,
  fetchSafeGeneratedMedia,
} from "./media-url";
import {
  aspectRatioFromText,
  compilerForMode,
  directZapPlan,
  durationFromText,
  ROUTER_MODEL,
} from "./router";
import { maybeRunCreativeLane } from "./imessage";
import { underDailyLimit } from "./jobs";
import { creativePreflight, REQUIRED_GMI_MODELS } from "./preflight";

const plan = (overrides: Partial<RouterPlan> = {}): RouterPlan => ({
  mode: "imagine",
  needs_input: false,
  chat_reply: "on it",
  delivery_line: "made this",
  expanded_prompt: "a fox in the fog",
  params: {
    aspect_ratio: "auto",
    duration: null,
    quality: "auto",
    generate_audio: true,
    use_input_image_as: "none",
  },
  ...overrides,
});

const turn = (overrides: Partial<CreativeTurn> = {}): CreativeTurn => ({
  text: "a fox in the fog",
  mediaInputs: [],
  ...overrides,
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseExplicitGenerationCommand", () => {
  it("returns undefined for ordinary prose (falls through to Hermes)", () => {
    expect(
      parseExplicitGenerationCommand("what's the weather?"),
    ).toBeUndefined();
    expect(
      parseExplicitGenerationCommand("read /etc/hosts please"),
    ).toBeUndefined();
  });

  it("recognizes standalone tokens case-insensitively anywhere in prose", () => {
    expect(parseExplicitGenerationCommand("/imagine a fox")).toEqual({
      cleanedText: "a fox",
      mode: "imagine",
    });
    expect(parseExplicitGenerationCommand("please /ANIMATE this")).toEqual({
      cleanedText: "please this",
      mode: "animate",
    });
    expect(parseExplicitGenerationCommand("a quick clip /zap")).toEqual({
      cleanedText: "a quick clip",
      mode: "zap",
    });
  });

  it("does not match embedded or path-like tokens", () => {
    expect(
      parseExplicitGenerationCommand("re/imagine the app"),
    ).toBeUndefined();
    expect(parseExplicitGenerationCommand("see docs//imagine")).toBeUndefined();
    expect(
      parseExplicitGenerationCommand("/imagines of grandeur"),
    ).toBeUndefined();
  });

  it("allows repeats of one command but rejects mixed modes", () => {
    expect(parseExplicitGenerationCommand("/zap /zap go")).toEqual({
      cleanedText: "go",
      mode: "zap",
    });
    expect(parseExplicitGenerationCommand("/imagine or /zap a fox")).toEqual({
      ambiguous: true,
    });
    expect(AMBIGUOUS_COMMAND_LINE).toBe(
      "use one command: /imagine, /animate, or /zap",
    );
  });
});

describe("parseRouterPlan", () => {
  it("accepts a valid strict plan", () => {
    expect(parseRouterPlan(plan())).toEqual(plan());
  });

  it("rejects unknown keys, bad enums, and non-integer durations", () => {
    expect(() => parseRouterPlan({ ...plan(), extra: 1 })).toThrow();
    expect(() =>
      parseRouterPlan(plan({ mode: "paint" as RouterPlan["mode"] })),
    ).toThrow();
    expect(() =>
      parseRouterPlan({
        ...plan(),
        params: { ...plan().params, duration: 4.5 },
      }),
    ).toThrow();
    expect(() => parseRouterPlan(null)).toThrow();
  });
});

describe("buildGenerationRequest", () => {
  it("imagine without image uses gpt-image-2-generate with png output", () => {
    expect(buildGenerationRequest(plan(), turn())).toEqual({
      kind: "image",
      model: "gpt-image-2-generate",
      payload: {
        prompt: "a fox in the fog",
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
        n: 1,
      },
    });
  });

  it("imagine with an input image switches to gpt-image-2-edit", () => {
    const request = buildGenerationRequest(
      plan({ params: { ...plan().params, aspect_ratio: "9:16" } }),
      turn({
        mediaInputs: [{ kind: "image", url: "https://x.test/in.png" }],
      }),
    );
    expect(request.model).toBe("gpt-image-2-edit");
    expect(request.payload).toEqual({
      prompt: "a fox in the fog",
      image: "https://x.test/in.png",
      size: "1024x1536",
      quality: "medium",
      n: 1,
    });
  });

  it("maps aspect ratios to pinned image sizes", () => {
    const sizeFor = (aspect_ratio: RouterPlan["params"]["aspect_ratio"]) =>
      buildGenerationRequest(
        plan({ params: { ...plan().params, aspect_ratio } }),
        turn(),
      ).payload["size"];
    expect(sizeFor("3:4")).toBe("1024x1536");
    expect(sizeFor("16:9")).toBe("1536x1024");
    expect(sizeFor("21:9")).toBe("1536x1024");
    expect(sizeFor("1:1")).toBe("1024x1024");
  });

  it("animate clamps duration, defaults audio on, and takes first_frame", () => {
    const request = buildGenerationRequest(
      plan({
        mode: "animate",
        params: { ...plan().params, duration: 99, aspect_ratio: "auto" },
      }),
      turn({
        mediaInputs: [{ kind: "image", url: "https://x.test/frame.png" }],
      }),
    );
    expect(request).toEqual({
      kind: "video",
      model: "seedance-2-0-fast-260128",
      payload: {
        prompt: "a fox in the fog",
        duration: 15,
        resolution: "720p",
        ratio: "16:9",
        generate_audio: true,
        watermark: false,
        first_frame: "https://x.test/frame.png",
      },
    });
  });

  it("animate honors an explicit user request for silence", () => {
    const request = buildGenerationRequest(
      plan({ mode: "animate" }),
      turn({ text: "a fox, no audio please" }),
    );
    expect(request.payload["generate_audio"]).toBe(false);
  });

  it("refuses to build a GMI payload for zap (that lane renders on fal)", () => {
    expect(() => buildGenerationRequest(plan({ mode: "zap" }), turn())).toThrow(
      /Cannot generate media/,
    );
  });
});

describe("buildFalZapRequest", () => {
  it("submits text-to-video with a clamped short duration and 768P", () => {
    const request = buildFalZapRequest(
      plan({
        mode: "zap",
        params: { ...plan().params, aspect_ratio: "9:16", duration: 30 },
      }),
      turn(),
    );
    expect(request).toEqual({
      kind: "video",
      model: "minimax/h3-max-turbo/text-to-video",
      input: {
        prompt: "a fox in the fog",
        duration: 10,
        resolution: "768P",
        prompt_expansion_mode: "balanced",
        enable_safety_checker: true,
        aspect_ratio: "9:16",
      },
    });
  });

  it("gives the first two images the first/last frame jobs", () => {
    const request = buildFalZapRequest(
      plan({ mode: "zap" }),
      turn({
        mediaInputs: [
          { kind: "image", url: "https://x.test/a.png" },
          { kind: "image", url: "https://x.test/b.png" },
          { kind: "image", url: "https://x.test/c.png" },
        ],
      }),
    );
    expect(request.model).toBe("minimax/h3-max-turbo/image-to-video");
    expect(request.input["image_url"]).toBe("https://x.test/a.png");
    expect(request.input["end_image_url"]).toBe("https://x.test/b.png");
    // The endpoint derives the ratio from the first frame.
    expect(request.input["aspect_ratio"]).toBeUndefined();
    expect(request.input["duration"]).toBe(5);
  });

  it("moves a video reference to H3 Max reference-to-video with labelled lists", () => {
    const request = buildFalZapRequest(
      plan({ mode: "zap", expanded_prompt: "make it rain" }),
      turn({
        mediaInputs: [
          {
            kind: "image",
            url: "https://x.test/a.jpg",
            mimeType: "image/jpeg",
          },
          {
            kind: "video",
            url: "https://x.test/v.mov",
            mimeType: "video/quicktime",
          },
        ],
      }),
    );
    expect(request).toEqual({
      kind: "video",
      model: "minimax/h3-max/reference-to-video",
      input: {
        prompt:
          "make it rain Use Video 1 as the motion reference, Image 1 as the subject reference.",
        duration: 5,
        resolution: "768P",
        prompt_expansion_mode: "balanced",
        enable_safety_checker: true,
        aspect_ratio: "adaptive",
        reference_image_urls: ["https://x.test/a.jpg"],
        reference_video_urls: ["https://x.test/v.mov"],
      },
    });
  });

  it("sends audio with a visual as a reference-to-video soundtrack", () => {
    const request = buildFalZapRequest(
      plan({
        mode: "zap",
        expanded_prompt: "dance to this",
        params: { ...plan().params, aspect_ratio: "9:16" },
      }),
      turn({
        mediaInputs: [
          {
            kind: "audio",
            url: "https://x.test/memo.m4a",
            mimeType: "audio/mp4",
          },
          { kind: "image", url: "https://x.test/a.jpg" },
        ],
      }),
    );
    expect(request.model).toBe("minimax/h3-max/reference-to-video");
    expect(request.input["aspect_ratio"]).toBe("9:16");
    expect(request.input["reference_audio_urls"]).toEqual([
      "https://x.test/memo.m4a",
    ]);
    expect(request.input["reference_image_urls"]).toEqual([
      "https://x.test/a.jpg",
    ]);
    expect(request.input["reference_video_urls"]).toBeUndefined();
    expect(request.input["image_url"]).toBeUndefined();
    expect(request.input["prompt"]).toBe(
      "dance to this Use Image 1 as the subject reference, Audio 1 as the soundtrack.",
    );
  });

  it("leaves a prompt alone when it already addresses a reference, and caps the lists", () => {
    const clips = (n: number, ext: string) =>
      Array.from({ length: n }, (_, i) => ({
        kind: ext === "mp4" ? ("video" as const) : ("audio" as const),
        url: `https://x.test/${i}.${ext}`,
      }));
    const request = buildFalZapRequest(
      plan({ mode: "zap", expanded_prompt: "Video 1 pans, Audio 1 plays" }),
      turn({ mediaInputs: [...clips(4, "mp4"), ...clips(4, "mp3")] }),
    );
    expect(request.input["prompt"]).toBe("Video 1 pans, Audio 1 plays");
    expect(request.input["reference_video_urls"]).toHaveLength(3);
    expect(request.input["reference_audio_urls"]).toHaveLength(3);
  });

  it("drops a clip's soundtrack with the clip, and seats attached audio first", () => {
    const clip = (i: number) => `https://x.test/${i}.mov`;
    const withSoundtracks = Array.from({ length: 4 }, (_, i) => [
      { kind: "video" as const, url: clip(i) },
      {
        kind: "audio" as const,
        url: `https://x.test/${i}.m4a`,
        soundtrackOf: clip(i),
      },
    ]).flat();

    let request = buildFalZapRequest(
      plan({ mode: "zap", expanded_prompt: "cut these together" }),
      turn({ mediaInputs: withSoundtracks }),
    );
    expect(request.input["reference_video_urls"]).toEqual([
      clip(0),
      clip(1),
      clip(2),
    ]);
    expect(request.input["reference_audio_urls"]).toEqual([
      "https://x.test/0.m4a",
      "https://x.test/1.m4a",
      "https://x.test/2.m4a",
    ]);

    request = buildFalZapRequest(
      plan({ mode: "zap", expanded_prompt: "score it with my memo" }),
      turn({
        mediaInputs: [
          ...withSoundtracks.slice(0, 6),
          { kind: "audio", url: "https://x.test/memo.m4a" },
        ],
      }),
    );
    expect(request.input["reference_audio_urls"]).toEqual([
      "https://x.test/memo.m4a",
      "https://x.test/0.m4a",
      "https://x.test/1.m4a",
    ]);
    expect(request.input["prompt"]).toBe(
      "score it with my memo Use Video 1 and Video 2 and Video 3 as the motion reference, Audio 1 and Audio 2 and Audio 3 as the soundtrack.",
    );
  });

  it("refuses audio without a picture or clip before anything is submitted", () => {
    expect(
      zapReferenceProblem(
        turn({ mediaInputs: [{ kind: "audio", url: "https://x.test/a.m4a" }] }),
      ),
    ).toBe(AUDIO_NEEDS_VISUAL_LINE);
    expect(
      zapReferenceProblem(
        turn({
          mediaInputs: [
            { kind: "audio", url: "https://x.test/a.m4a" },
            { kind: "video", url: "https://x.test/v.mp4" },
          ],
        }),
      ),
    ).toBeUndefined();
    expect(zapReferenceProblem(turn())).toBeUndefined();
  });

  it("accepts fal.media artifact URLs and still rejects other hosts", () => {
    expect(
      assertSafeGeneratedMediaUrl("https://v3b.fal.media/files/out.mp4"),
    ).toBe("https://v3b.fal.media/files/out.mp4");
    expect(() =>
      assertSafeGeneratedMediaUrl("https://evil.test/out.mp4"),
    ).toThrow();
  });
});

describe("prompt compiler routing", () => {
  it("compiles routed lanes on the Groq router", () => {
    expect(compilerForMode().model).toBe(ROUTER_MODEL);
  });
});

describe("directZapPlan", () => {
  const zapTurn = (
    cleanedText: string,
    mediaInputs: CreativeTurn["mediaInputs"] = [],
  ) => ({
    mode: "zap" as const,
    cleanedText,
    text: `/zap ${cleanedText}`,
    mediaInputs,
  });

  it("ships the user's words as the prompt without a model call", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = directZapPlan(
      zapTurn("spiderverse style animation of the Ferry Building"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      mode: "zap",
      needs_input: false,
      chat_reply: "creating your video",
      delivery_line: "here is your video",
      expanded_prompt: "spiderverse style animation of the Ferry Building",
      params: {
        aspect_ratio: "auto",
        duration: null,
        generate_audio: true,
        quality: "auto",
        use_input_image_as: "none",
      },
    });
  });

  it("reads orientation and duration out of the text", () => {
    const result = directZapPlan(
      zapTurn("vertical clip of rain on neon glass, 8 seconds"),
    );
    expect(result.params.aspect_ratio).toBe("9:16");
    expect(result.params.duration).toBe(8);
    expect(result.expanded_prompt).toBe(
      "vertical clip of rain on neon glass, 8 seconds",
    );

    expect(aspectRatioFromText("make it 16:9")).toBe("16:9");
    expect(aspectRatioFromText("square loop")).toBe("1:1");
    expect(aspectRatioFromText("for reels")).toBe("9:16");
    expect(aspectRatioFromText("a fox")).toBe("auto");
    expect(durationFromText("10s push-in")).toBe(10);
    expect(durationFromText("a fox")).toBeNull();
  });

  it("lets an explicit ratio beat a descriptive word, and clamps long durations", () => {
    expect(aspectRatioFromText("16:9 portrait of a lighthouse")).toBe("16:9");
    expect(aspectRatioFromText("9:16 landscape of dunes")).toBe("9:16");
    expect(aspectRatioFromText("square 4:3 frame")).toBe("4:3");
    expect(durationFromText("a 120 second odyssey")).toBe(120);
    expect(durationFromText("15s push-in")).toBe(15);
    expect(durationFromText("1920s silent film")).toBeNull();
    expect(durationFromText("early 2000s style")).toBeNull();
    expect(durationFromText("80s synthwave")).toBeNull();
    const request = buildFalZapRequest(
      directZapPlan(zapTurn("a 120 second odyssey")),
      turn(),
    );
    expect(request.input["duration"]).toBe(10);
  });

  it("uses the attached image as the first frame and the zap ack lines", () => {
    const result = directZapPlan(
      zapTurn("make it Ghibli", [
        { kind: "image", url: "https://signed.example/frame.jpg" },
      ]),
    );
    expect(result.chat_reply).toBe("zapping your image");
    expect(result.params.use_input_image_as).toBe("first_frame");
    expect(
      buildFalZapRequest(result, {
        text: "",
        mediaInputs: [
          { kind: "image", url: "https://signed.example/frame.jpg" },
        ],
      }).model,
    ).toBe("minimax/h3-max-turbo/image-to-video");
  });

  it("falls back to a generic brief when the command has no words", () => {
    expect(directZapPlan(zapTurn("   ")).expanded_prompt).toBe(
      "Create a short kinetic video from the user's creative idea, with one clear motion and a strong visual hook.",
    );
  });
});

describe("buildHeygenAvatarRequest", () => {
  it("builds a photo-character video_inputs payload with defaults", () => {
    expect(
      buildHeygenAvatarRequest({
        avatarImageUrl: "https://signed.example/face.png",
        script: "Hello from my twin.",
      }),
    ).toEqual({
      kind: "video",
      model: "heygen-avatar-v4",
      payload: {
        video_inputs: [
          {
            character: {
              type: "photo",
              image_url: "https://signed.example/face.png",
            },
            voice: { type: "text", input_text: "Hello from my twin." },
          },
        ],
        dimension: { width: 1280, height: 720 },
      },
    });
  });

  it("uses a trained avatar ID (with voice and duration) when provided", () => {
    const request = buildHeygenAvatarRequest({
      avatarId: "look_abc123",
      script: "Hi",
      voiceId: "voice_1",
      dimension: { width: 720, height: 1280 },
      durationSeconds: 8,
    });
    expect(request.model).toBe("heygen-avatar-v4");
    expect(request.payload).toEqual({
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: "look_abc123" },
          voice: { type: "text", input_text: "Hi", voice_id: "voice_1" },
        },
      ],
      dimension: { width: 720, height: 1280 },
      duration: 8,
    });
  });

  it("heygen-avatar-v4 is a preflight-required model", () => {
    expect(REQUIRED_GMI_MODELS).toContain("heygen-avatar-v4");
  });
});

describe("generated media SSRF protection", () => {
  const hosts = ["storage.googleapis.com", "cdn.example.com"];

  it("accepts only allowlisted public https hosts", () => {
    expect(
      assertSafeGeneratedMediaUrl(
        "https://storage.googleapis.com/a/b.png",
        hosts,
      ),
    ).toBe("https://storage.googleapis.com/a/b.png");
  });

  it("rejects http, credentials, ports, IPs, and internal hosts", () => {
    const bad = [
      "http://storage.googleapis.com/a.png",
      "https://user:pw@storage.googleapis.com/a.png",
      "https://storage.googleapis.com:8443/a.png",
      "https://127.0.0.1/a.png",
      "https://[::1]/a.png",
      "https://localhost/a.png",
      "https://box.internal/a.png",
      "https://foo.local/a.png",
      "https://evil.test/a.png",
      "not a url",
    ];
    for (const url of bad) {
      expect(() => assertSafeGeneratedMediaUrl(url, hosts)).toThrow();
    }
  });

  it("re-validates every redirect hop before following it", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.test/steal" },
      }),
    );
    await expect(
      fetchSafeGeneratedMedia(
        "https://storage.googleapis.com/a.png",
        "image",
        hosts,
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("downloads validated bytes with the right MIME", async () => {
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
    ]);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(pngBytes, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const media = await fetchSafeGeneratedMedia(
      "https://cdn.example.com/out.png",
      "image",
      hosts,
      fetcher,
    );
    expect(media.mimeType).toBe("image/png");
    expect(media.bytes.equals(pngBytes)).toBe(true);
  });

  it("rejects bytes whose magic numbers don't match the declared MIME", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(Buffer.from("not really a png"), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    await expect(
      fetchSafeGeneratedMedia(
        "https://cdn.example.com/out.png",
        "image",
        hosts,
        fetcher,
      ),
    ).rejects.toThrow(/match their MIME/);
  });

  it("rejects a media response whose MIME doesn't match the job kind", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(Buffer.from("x"), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      }),
    );
    await expect(
      fetchSafeGeneratedMedia(
        "https://cdn.example.com/out",
        "image",
        hosts,
        fetcher,
      ),
    ).rejects.toThrow(/MIME/);
  });
});

describe("submission ambiguity (C23)", () => {
  it("marks submit timeouts and connection drops ambiguous — never resubmit", () => {
    expect(
      isAmbiguousSubmission(
        new GmiRequestError("timed out", { stage: "submit", timedOut: true }),
      ),
    ).toBe(true);
    expect(
      isAmbiguousSubmission(
        new GmiRequestError("unreachable", { stage: "submit" }),
      ),
    ).toBe(true);
    expect(
      isAmbiguousSubmission(
        new GmiRequestError("rejected", { stage: "submit", status: 400 }),
      ),
    ).toBe(false);
    expect(
      isAmbiguousSubmission(
        new GmiRequestError("poll drop", { stage: "poll", timedOut: true }),
      ),
    ).toBe(false);
    expect(isAmbiguousSubmission(new Error("misc"))).toBe(false);
  });

  it("a submit response without request_id fails ambiguous, without retrying", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "created" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(
        generateCompiledRequest(
          { kind: "image", model: "gpt-image-2-generate", payload: {} },
          5_000,
        ),
      ).rejects.toSatisfy(isAmbiguousSubmission);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("concurrency semaphore", () => {
  it("holds submissions beyond CREATIVE_MAX_CONCURRENCY until a slot frees", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", "test-key");
    vi.stubEnv("CREATIVE_MAX_CONCURRENCY", "1");
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await gate;
      inFlight -= 1;
      return new Response(
        JSON.stringify({
          status: "success",
          request_id: "r1",
          outcome: {
            media_urls: [{ url: "https://storage.googleapis.com/a.png" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const request = {
        kind: "image" as const,
        model: "gpt-image-2-generate",
        payload: {},
      };
      const first = generateCompiledRequest(request, 10_000);
      const second = generateCompiledRequest(request, 10_000);
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Only one submission reached the queue while the slot is held.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      release?.();
      await Promise.all([first, second]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(maxInFlight).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("fal /zap queue discipline", () => {
  const FAL_VIDEO_URL = "https://v3b.fal.media/files/out.mp4";
  const okSubmit = () =>
    vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ request_id: "req-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  const queueOf = (
    overrides: Partial<FalQueueReader> = {},
  ): FalQueueReader => ({
    status: vi.fn().mockResolvedValue({ status: "COMPLETED" }),
    result: vi
      .fn()
      .mockResolvedValue({ data: { video: { url: FAL_VIDEO_URL } } }),
    ...overrides,
  });

  it("submits once, polls by ID, and emits lifecycle in order", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const submit = okSubmit();
    const stages: string[] = [];
    const media = await generateZapVideo(
      plan({ mode: "zap" }),
      turn(),
      10_000,
      {
        submit,
        queue: queueOf(),
        onLifecycle: (event) => {
          stages.push(event.stage);
        },
      },
    );
    expect(media).toEqual({ kind: "video", url: FAL_VIDEO_URL });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(stages).toEqual(["submitting", "submitted", "artifact_ready"]);
  });

  it("a submit with no response is ambiguous — never resubmitted", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const submit = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 10_000, {
        submit,
        queue: queueOf(),
      }),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof FalSubmitUnknownError && isFalUnknownOutcome(error),
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("a definitive submit rejection is an ordinary retryable failure", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const submit = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("bad input", { status: 400 }));
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 10_000, {
        submit,
        queue: queueOf(),
      }),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof FalRequestError && !isFalUnknownOutcome(error),
    );
  });

  it("recovers a finished render when polling drops but the result reads back", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const media = await generateZapVideo(
      plan({ mode: "zap" }),
      turn(),
      10_000,
      {
        submit: okSubmit(),
        queue: queueOf({
          status: vi.fn().mockRejectedValue(new Error("connection reset")),
        }),
      },
    );
    expect(media).toEqual({ kind: "video", url: FAL_VIDEO_URL });
  });

  it("an enqueued render whose outcome can't be determined is terminal-unknown", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 10_000, {
        submit: okSubmit(),
        queue: queueOf({
          status: vi.fn().mockRejectedValue(new Error("connection reset")),
          result: vi.fn().mockRejectedValue(new Error("still down")),
        }),
      }),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof FalEnqueuedError &&
        error.requestId === "req-1" &&
        isFalUnknownOutcome(error),
    );
  });

  it("a 4xx result is the provider's verdict, not an unknown outcome", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const rejection = Object.assign(new Error("content policy"), {
      status: 422,
    });
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 10_000, {
        submit: okSubmit(),
        queue: queueOf({ result: vi.fn().mockRejectedValue(rejection) }),
      }),
    ).rejects.toSatisfy((error) => error instanceof FalRequestError);
  });

  it("a render that outlives the budget stays terminal-unknown by its ID", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 500, {
        submit: okSubmit(),
        queue: queueOf({
          status: vi.fn().mockResolvedValue({ status: "IN_QUEUE" }),
        }),
      }),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof FalEnqueuedError && error.requestId === "req-1",
    );
  });

  it("a transient 4xx on result (429) keeps the enqueued render terminal-unknown", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const rejection = Object.assign(new Error("rate limited"), { status: 429 });
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 10_000, {
        submit: okSubmit(),
        queue: queueOf({
          status: vi.fn().mockRejectedValue(new Error("read failed")),
          result: vi.fn().mockRejectedValue(rejection),
        }),
      }),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof FalEnqueuedError && isFalUnknownOutcome(error),
    );
  });

  it("an expired budget never submits a paid render, even with a free permit", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const submit = okSubmit();
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 0, {
        submit,
        queue: queueOf(),
      }),
    ).rejects.toThrow(GmiCapacityError);
    expect(submit).not.toHaveBeenCalled();
  });

  it("a budget consumed by lifecycle persistence never submits a paid render", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const submit = okSubmit();
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 50, {
        submit,
        queue: queueOf(),
        onLifecycle: async () => {
          await new Promise((resolve) => setTimeout(resolve, 120));
        },
      }),
    ).rejects.toThrow(GmiCapacityError);
    expect(submit).not.toHaveBeenCalled();
  });

  it("a queue read that ignores its abort signal is still cut off at the deadline", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const hangForever = () => new Promise<never>(() => undefined);
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 300, {
        submit: okSubmit(),
        queue: { status: hangForever, result: hangForever },
      }),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof FalEnqueuedError && error.requestId === "req-1",
    );
  });

  it("a stalled queue read is cut off at the deadline and stays terminal-unknown", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    const hangUntilAborted = (
      _endpoint: string,
      options: { requestId: string; abortSignal?: AbortSignal },
    ) =>
      new Promise<never>((_resolve, reject) => {
        options.abortSignal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      });
    await expect(
      generateZapVideo(plan({ mode: "zap" }), turn(), 300, {
        submit: okSubmit(),
        queue: { status: hangUntilAborted, result: hangUntilAborted },
      }),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof FalEnqueuedError && error.requestId === "req-1",
    );
  });

  it("shares the creative concurrency permit with GMI renders", async () => {
    vi.stubEnv("FAL_KEY", "test-key");
    vi.stubEnv("CREATIVE_MAX_CONCURRENCY", "1");
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submit = vi.fn<typeof fetch>().mockImplementation(async () => {
      await gate;
      return new Response(JSON.stringify({ request_id: "req-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const queue = queueOf();
    const first = generateZapVideo(plan({ mode: "zap" }), turn(), 10_000, {
      submit,
      queue,
    });
    const second = generateZapVideo(plan({ mode: "zap" }), turn(), 10_000, {
      submit,
      queue,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Only one submission is in flight while the slot is held.
    expect(submit).toHaveBeenCalledTimes(1);
    release?.();
    await Promise.all([first, second]);
    expect(submit).toHaveBeenCalledTimes(2);
  });
});

describe("iMessage lane fallthrough", () => {
  const sender = () =>
    ({
      sendText: vi.fn().mockResolvedValue(undefined),
      getAttachment: vi.fn(),
    }) as unknown as Parameters<typeof maybeRunCreativeLane>[1];
  const supabaseNever = () =>
    ({
      from: () => {
        throw new Error("no database access expected");
      },
      storage: {
        from: () => {
          throw new Error("no storage access expected");
        },
      },
    }) as unknown as Parameters<typeof maybeRunCreativeLane>[0];

  it("ordinary prose falls through to Hermes with zero creative work", async () => {
    const s = sender();
    const handled = await maybeRunCreativeLane(
      supabaseNever(),
      s,
      { spaceId: "sp", userId: "u1", phone: "+1555" },
      "what's on my calendar today?\n[attachment:att-1]",
    );
    expect(handled).toBe(false);
    expect(s.sendText).not.toHaveBeenCalled();
    expect(s.getAttachment).not.toHaveBeenCalled();
  });

  it("mixed commands get the deterministic line with no provider work", async () => {
    const s = sender();
    const handled = await maybeRunCreativeLane(
      supabaseNever(),
      s,
      { spaceId: "sp", userId: "u1", phone: "+1555" },
      "/imagine or /animate a fox",
    );
    expect(handled).toBe(true);
    expect(s.sendText).toHaveBeenCalledWith(
      "sp",
      "+1555",
      AMBIGUOUS_COMMAND_LINE,
    );
    expect(s.getAttachment).not.toHaveBeenCalled();
  });
});

describe("underDailyLimit", () => {
  const supabaseCounting = (count: number) =>
    ({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              in: () => Promise.resolve({ count, error: null }),
            }),
          }),
        }),
      }),
    }) as unknown as Parameters<typeof underDailyLimit>[0];

  it("allows generation under the cap and blocks at it", async () => {
    vi.stubEnv("CREATIVE_DAILY_LIMIT", "20");
    expect(await underDailyLimit(supabaseCounting(19), "u1")).toBe(true);
    expect(await underDailyLimit(supabaseCounting(20), "u1")).toBe(false);
    expect(await underDailyLimit(supabaseCounting(35), "u1")).toBe(false);
  });
});

describe("creativePreflight", () => {
  it("skips gracefully when provider keys are absent", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("GMI_CLOUD_API_KEY", "");
    const result = await creativePreflight();
    expect(result.status).toBe("skipped");
  });
});
