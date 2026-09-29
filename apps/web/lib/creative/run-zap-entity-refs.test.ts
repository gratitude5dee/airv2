/**
 * /zap with @entity refs: a flagged image sends the whole turn to
 * minimax/h3-max/reference-to-video (the logo lands in
 * reference_image_urls, never a first frame), and the plan compiles
 * through the Groq metaprompt with the entity guide — falling back to the
 * direct plan whenever the router is unavailable so /zap can never break
 * on the metaprompt layer.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RouterPlan } from "./schema";

const router = vi.hoisted(() => ({
  routeExplicitCommand: vi.fn(
    async (
      _turn: unknown,
      _imageDescription?: unknown,
      _chat?: unknown,
      _modelGuide?: unknown
    ): Promise<RouterPlan> => {
      throw new Error("unmocked");
    }
  ),
}));
vi.mock("./router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./router")>()),
  routeExplicitCommand: (...args: [unknown, unknown?, unknown?, unknown?]) =>
    router.routeExplicitCommand(...args),
}));
const fal = vi.hoisted(() => ({
  generateZapVideo: vi.fn(async () => ({
    kind: "video" as const,
    url: "https://fal.example/out.mp4",
  })),
}));
vi.mock("./fal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./fal")>()),
  generateZapVideo: (...args: unknown[]) =>
    fal.generateZapVideo(...(args as [])),
}));
vi.mock("./jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./jobs")>()),
  underDailyLimit: vi.fn(async () => true),
  updateCreativeJob: vi.fn(async () => undefined),
  insertRenderCostEvent: vi.fn(async () => undefined),
}));
vi.mock("./media-url", () => ({
  fetchSafeGeneratedMedia: vi.fn(async () => Buffer.from("video")),
}));
vi.mock("./store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./store")>()),
  ingestGeneratedMedia: vi.fn(async () => ({ id: "asset-1" })),
  mintJobDelivery: vi.fn(async () => ({ url: "https://signed.example/d" })),
}));

import {
  buildFalZapRequest,
  FAL_ZAP_IMAGE_TO_VIDEO,
  FAL_ZAP_REFERENCE_TO_VIDEO,
} from "./fal";
import { directZapPlan, CreativeRouterUnavailableError } from "./router";
import { executeCreativeJob } from "./run";

const turn = (text: string) => ({
  mode: "zap" as const,
  cleanedText: text,
  text: `/zap ${text}`,
  mediaInputs: [
    { kind: "image" as const, url: "https://signed.example/logo.png", entityRef: true },
  ],
});

beforeEach(() => {
  router.routeExplicitCommand.mockReset();
  fal.generateZapVideo.mockClear();
});

describe("buildFalZapRequest entity refs", () => {
  it("puts entity-flagged images into reference_image_urls on h3-max", () => {
    const request = buildFalZapRequest(directZapPlan(turn("logo reveal")), turn("logo reveal"));
    expect(request.model).toBe(FAL_ZAP_REFERENCE_TO_VIDEO);
    expect(request.input["reference_image_urls"]).toEqual([
      "https://signed.example/logo.png",
    ]);
    expect(request.input["image_url"]).toBeUndefined();
  });

  it("keeps ordinary image turns on image-to-video", () => {
    const plain = { ...turn("skateboard"), mediaInputs: [{ kind: "image" as const, url: "https://staged.example/a.jpg" }] };
    const request = buildFalZapRequest(directZapPlan(plain), plain);
    expect(request.model).toBe(FAL_ZAP_IMAGE_TO_VIDEO);
    expect(request.input["reference_image_urls"]).toBeUndefined();
  });
});

describe("executeCreativeJob /zap entity refs", () => {
  it("compiles through the Groq metaprompt with the entity guide", async () => {
    router.routeExplicitCommand.mockImplementationOnce(async (t) =>
      directZapPlan({
        mode: "zap",
        cleanedText: (t as { cleanedText: string }).cleanedText,
        text: `/zap ${(t as { cleanedText: string }).cleanedText}`,
        mediaInputs: [],
      })
    );

    const result = await executeCreativeJob(
      {} as SupabaseClient,
      "job-1",
      "u-1",
      turn("the acme-logo logo in Image 1 neon intro")
    );

    expect(result.status).toBe("delivered");
    expect(router.routeExplicitCommand).toHaveBeenCalledOnce();
    const guide = router.routeExplicitCommand.mock.calls[0]?.[3] as string;
    expect(guide).toContain("Entity references");
    // guideForModel("minimax/h3-max") content heads the addendum.
    expect(guide).toContain("one camera move");
    expect(fal.generateZapVideo).toHaveBeenCalledOnce();
  });

  it("falls back to the direct plan when the router is unavailable", async () => {
    router.routeExplicitCommand.mockRejectedValueOnce(
      new CreativeRouterUnavailableError()
    );

    const result = await executeCreativeJob(
      {} as SupabaseClient,
      "job-2",
      "u-1",
      turn("the acme-logo logo in Image 1 neon intro")
    );

    expect(result.status).toBe("delivered");
    expect(fal.generateZapVideo).toHaveBeenCalledOnce();
  });

  it("skips the metaprompt entirely for turns without entity refs", async () => {
    const plain = {
      mode: "zap" as const,
      cleanedText: "skateboard at dusk",
      text: "/zap skateboard at dusk",
      mediaInputs: [{ kind: "image" as const, url: "https://staged.example/a.jpg" }],
    };
    await executeCreativeJob({} as SupabaseClient, "job-3", "u-1", plain);
    expect(router.routeExplicitCommand).not.toHaveBeenCalled();
    expect(fal.generateZapVideo).toHaveBeenCalledOnce();
  });
});
