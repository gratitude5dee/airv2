import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AMBIGUOUS_COMMAND_LINE,
  parseExplicitGenerationCommand,
} from "./parse";
import { parseRouterPlan, type RouterPlan } from "./schema";
import {
  buildGenerationRequest,
  generateCompiledRequest,
  isAmbiguousSubmission,
  GmiRequestError,
  type CreativeTurn,
} from "./gmi";
import {
  assertSafeGeneratedMediaUrl,
  fetchSafeGeneratedMedia,
} from "./media-url";
import { maybeRunCreativeLane } from "./imessage";
import { underDailyLimit } from "./jobs";
import { creativePreflight } from "./preflight";

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
    expect(parseExplicitGenerationCommand("what's the weather?")).toBeUndefined();
    expect(parseExplicitGenerationCommand("read /etc/hosts please")).toBeUndefined();
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
    expect(parseExplicitGenerationCommand("re/imagine the app")).toBeUndefined();
    expect(parseExplicitGenerationCommand("see docs//imagine")).toBeUndefined();
    expect(parseExplicitGenerationCommand("/imagines of grandeur")).toBeUndefined();
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
      "use one command: /imagine, /animate, or /zap"
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
      parseRouterPlan(plan({ mode: "paint" as RouterPlan["mode"] }))
    ).toThrow();
    expect(() =>
      parseRouterPlan({
        ...plan(),
        params: { ...plan().params, duration: 4.5 },
      })
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
      })
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
        turn()
      ).payload.size;
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
      })
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
      turn({ text: "a fox, no audio please" })
    );
    expect(request.payload.generate_audio).toBe(false);
  });

  it("zap builds gemini payload with reference/video caps and auto duration", () => {
    const images = Array.from({ length: 6 }, (_, i) => ({
      kind: "image" as const,
      url: `https://x.test/i${i}.png`,
    }));
    const videos = Array.from({ length: 4 }, (_, i) => ({
      kind: "video" as const,
      url: `https://x.test/v${i}.mp4`,
    }));
    const request = buildGenerationRequest(
      plan({ mode: "zap", params: { ...plan().params, duration: 30 } }),
      turn({ mediaInputs: [...images, ...videos] })
    );
    expect(request.model).toBe("gemini-omni-flash-preview");
    expect(request.payload.reference_image).toHaveLength(5);
    expect(request.payload.video).toHaveLength(3);
    // With input video the provider derives duration.
    expect(request.payload.durationSeconds).toBe("auto");

    const noVideo = buildGenerationRequest(
      plan({ mode: "zap", params: { ...plan().params, duration: 30 } }),
      turn()
    );
    expect(noVideo.payload.durationSeconds).toBe(10);
  });
});

describe("generated media SSRF protection", () => {
  const hosts = ["storage.googleapis.com", "cdn.example.com"];

  it("accepts only allowlisted public https hosts", () => {
    expect(
      assertSafeGeneratedMediaUrl("https://storage.googleapis.com/a/b.png", hosts)
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
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.test/steal" },
        })
      );
    await expect(
      fetchSafeGeneratedMedia(
        "https://storage.googleapis.com/a.png",
        "image",
        hosts,
        fetcher
      )
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("downloads validated bytes with the right MIME", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(Buffer.from("png-bytes"), {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    );
    const media = await fetchSafeGeneratedMedia(
      "https://cdn.example.com/out.png",
      "image",
      hosts,
      fetcher
    );
    expect(media.mimeType).toBe("image/png");
    expect(media.bytes.toString()).toBe("png-bytes");
  });

  it("rejects a media response whose MIME doesn't match the job kind", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(Buffer.from("x"), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      })
    );
    await expect(
      fetchSafeGeneratedMedia(
        "https://cdn.example.com/out",
        "image",
        hosts,
        fetcher
      )
    ).rejects.toThrow(/MIME/);
  });
});

describe("submission ambiguity (C23)", () => {
  it("marks submit timeouts and connection drops ambiguous — never resubmit", () => {
    expect(
      isAmbiguousSubmission(
        new GmiRequestError("timed out", { stage: "submit", timedOut: true })
      )
    ).toBe(true);
    expect(
      isAmbiguousSubmission(new GmiRequestError("unreachable", { stage: "submit" }))
    ).toBe(true);
    expect(
      isAmbiguousSubmission(
        new GmiRequestError("rejected", { stage: "submit", status: 400 })
      )
    ).toBe(false);
    expect(
      isAmbiguousSubmission(
        new GmiRequestError("poll drop", { stage: "poll", timedOut: true })
      )
    ).toBe(false);
    expect(isAmbiguousSubmission(new Error("misc"))).toBe(false);
  });

  it("a submit response without request_id fails ambiguous, without retrying", async () => {
    vi.stubEnv("GMI_CLOUD_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "created" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(
        generateCompiledRequest(
          { kind: "image", model: "gpt-image-2-generate", payload: {} },
          5_000
        )
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
          outcome: { media_urls: [{ url: "https://storage.googleapis.com/a.png" }] },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
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
      "what's on my calendar today?\n[attachment:att-1]"
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
      "/imagine or /animate a fox"
    );
    expect(handled).toBe(true);
    expect(s.sendText).toHaveBeenCalledWith("sp", "+1555", AMBIGUOUS_COMMAND_LINE);
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
