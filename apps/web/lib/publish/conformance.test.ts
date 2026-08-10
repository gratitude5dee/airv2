/**
 * CM3 conformance suite (task 7): validate() runs against a fixture set of
 * known-bad drafts, and every real platform rejection ever observed becomes
 * a fixture here — this file is the product's institutional memory. The
 * spec-constant assertions exist so that changing a number in specs/ to a
 * wrong value fails the suite.
 */
import { describe, expect, it } from "vitest";
import type { Draft } from "./adapter";
import { classifyDefault } from "./adapter";
import { instagramAdapter } from "./adapters/instagram";
import { facebookAdapter } from "./adapters/facebook";
import { xAdapter } from "./adapters/x";
import { youtubeAdapter } from "./adapters/youtube";
import { tiktokAdapter } from "./adapters/tiktok";
import { allAdapters, adapterFor } from "./registry";
import { INSTAGRAM_SPEC } from "./specs/instagram";
import { X_SPEC } from "./specs/x";
import { YOUTUBE_SPEC } from "./specs/youtube";
import { TIKTOK_SPEC } from "./specs/tiktok";
import { retryDelaySeconds, verdictFor } from "./verdict";
import { PublishError } from "./adapter";

function draft(overrides: Partial<Draft>): Draft {
  return { caption: "hello", media: [], ...overrides };
}

const image = (width: number, height: number) => ({
  url: "https://example.test/i.png",
  kind: "image" as const,
  width,
  height,
});

const video = (durationSeconds: number) => ({
  url: "https://example.test/v.mp4",
  kind: "video" as const,
  durationSeconds,
});

describe("spec constants", () => {
  it("pins the published platform numbers", () => {
    expect(INSTAGRAM_SPEC.maxCaptionChars).toBe(2200);
    expect(INSTAGRAM_SPEC.minAspect).toBeCloseTo(0.8);
    expect(INSTAGRAM_SPEC.maxAspect).toBeCloseTo(1.91);
    expect(INSTAGRAM_SPEC.maxCarouselItems).toBe(10);
    expect(INSTAGRAM_SPEC.dailyCap).toBe(25);
    expect(X_SPEC.maxCaptionChars).toBe(280);
    expect(X_SPEC.maxImages).toBe(4);
    expect(YOUTUBE_SPEC.maxTitleChars).toBe(100);
    expect(YOUTUBE_SPEC.maxDescriptionChars).toBe(5000);
    expect(TIKTOK_SPEC.maxCaptionChars).toBe(2200);
  });
});

describe("instagram validate", () => {
  it("rejects a 3:1 image naming the allowed range", () => {
    const problems = instagramAdapter.validate(
      draft({ media: [image(3000, 1000)] })
    );
    const aspect = problems.find(
      (problem) => problem.code === "ig.image.aspect"
    );
    expect(aspect?.message).toContain("4:5");
    expect(aspect?.message).toContain("1.91:1");
  });

  it("accepts a square image", () => {
    expect(instagramAdapter.validate(draft({ media: [image(1080, 1080)] })))
      .toEqual([]);
  });

  it("rejects a caption over 2200 characters", () => {
    const problems = instagramAdapter.validate(
      draft({ caption: "x".repeat(2201), media: [image(1080, 1080)] })
    );
    expect(problems.map((problem) => problem.code)).toContain(
      "ig.caption.length"
    );
  });

  it("requires media", () => {
    expect(
      instagramAdapter.validate(draft({})).map((problem) => problem.code)
    ).toContain("ig.media.required");
  });

  it("rejects an 11-item carousel", () => {
    const problems = instagramAdapter.validate(
      draft({ media: Array.from({ length: 11 }, () => image(1080, 1080)) })
    );
    expect(problems.map((problem) => problem.code)).toContain("ig.media.count");
  });

  it("rejects a multi-item story", () => {
    const problems = instagramAdapter.validate(
      draft({
        kind: "story",
        media: [image(1080, 1920), image(1080, 1920)],
      })
    );
    expect(problems.map((problem) => problem.code)).toContain(
      "ig.story.single"
    );
  });
});

describe("facebook validate", () => {
  it("rejects an empty post", () => {
    expect(
      facebookAdapter
        .validate(draft({ caption: "" }))
        .map((problem) => problem.code)
    ).toContain("fb.empty");
  });

  it("rejects a video mixed with other media", () => {
    const problems = facebookAdapter.validate(
      draft({ media: [video(30), image(1080, 1080)] })
    );
    expect(problems.map((problem) => problem.code)).toContain(
      "fb.video.single"
    );
  });
});

describe("x validate", () => {
  it("rejects a 281-character post", () => {
    const problems = xAdapter.validate(draft({ caption: "x".repeat(281) }));
    expect(problems.map((problem) => problem.code)).toContain(
      "x.caption.length"
    );
  });

  it("rejects five images", () => {
    const problems = xAdapter.validate(
      draft({ media: Array.from({ length: 5 }, () => image(1080, 1080)) })
    );
    expect(problems.map((problem) => problem.code)).toContain(
      "x.images.count"
    );
  });

  it("rejects mixed images and video", () => {
    const problems = xAdapter.validate(
      draft({ media: [image(1080, 1080), video(30)] })
    );
    expect(problems.map((problem) => problem.code)).toContain("x.media.mixed");
  });
});

describe("youtube validate", () => {
  it("requires a title and exactly one video", () => {
    const codes = youtubeAdapter
      .validate(draft({}))
      .map((problem) => problem.code);
    expect(codes).toContain("yt.video.single");
    expect(codes).toContain("yt.title.required");
  });

  it("rejects angle brackets in the title", () => {
    const problems = youtubeAdapter.validate(
      draft({ title: "hi <b>", media: [video(60)] })
    );
    expect(problems.map((problem) => problem.code)).toContain(
      "yt.title.brackets"
    );
  });
});

describe("tiktok validate", () => {
  it("rejects a 2-second video", () => {
    const problems = tiktokAdapter.validate(draft({ media: [video(2)] }));
    expect(problems.map((problem) => problem.code)).toContain(
      "tt.video.short"
    );
  });
});

describe("classify", () => {
  it("maps 401 to reauth", () => {
    expect(classifyDefault(401, "").kind).toBe("reauth");
  });

  it("maps 429 and 5xx to retry", () => {
    expect(classifyDefault(429, "").kind).toBe("retry");
    expect(classifyDefault(503, "").kind).toBe("retry");
  });

  it("maps other 4xx to fix-content carrying the platform's reason", () => {
    const verdict = classifyDefault(400, "aspect ratio not supported");
    expect(verdict.kind).toBe("fix-content");
    if (verdict.kind === "fix-content") {
      expect(verdict.message).toContain("aspect ratio");
    }
  });

  it("maps an Instagram OAuthException to reauth regardless of status", () => {
    expect(
      instagramAdapter.classify(
        400,
        '{"error":{"type":"OAuthException","code":190}}'
      ).kind
    ).toBe("reauth");
  });

  it("maps a YouTube quotaExceeded to a long retry", () => {
    const verdict = youtubeAdapter.classify(403, "quotaExceeded");
    expect(verdict.kind).toBe("retry");
  });

  it("maps an X duplicate rejection to fix-content", () => {
    expect(xAdapter.classify(403, "duplicate content").kind).toBe(
      "fix-content"
    );
  });
});

describe("verdict helpers", () => {
  it("classifies a PublishError through the adapter", () => {
    const verdict = verdictFor(xAdapter, new PublishError(401, "expired"));
    expect(verdict.kind).toBe("reauth");
  });

  it("treats unknown errors as retry", () => {
    expect(verdictFor(xAdapter, new Error("fetch failed")).kind).toBe("retry");
  });

  it("backs off exponentially with a cap", () => {
    expect(retryDelaySeconds(0, 300)).toBe(300);
    expect(retryDelaySeconds(1, 300)).toBe(600);
    expect(retryDelaySeconds(10, 300)).toBe(6 * 60 * 60);
  });
});

describe("registry", () => {
  it("resolves the four v1 adapters", () => {
    for (const platform of ["instagram", "facebook", "x", "youtube"]) {
      expect(adapterFor(platform)?.platform).toBe(platform);
    }
  });

  it("keeps tiktok dark until the flag flips", () => {
    expect(adapterFor("tiktok")).toBeNull();
  });

  it("rejects unknown platforms", () => {
    expect(adapterFor("myspace")).toBeNull();
  });

  it("every adapter rejects an over-cap caption", () => {
    for (const adapter of allAdapters()) {
      const problems = adapter.validate(
        draft({
          caption: "x".repeat(adapter.limits.maxCaptionChars + 1),
          media: [video(60)],
          title: "t",
        })
      );
      expect(problems.length).toBeGreaterThan(0);
    }
  });
});
