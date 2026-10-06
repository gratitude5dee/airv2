/**
 * R-CONN-01: the WZRD Connect naming glue — service-id translation for the
 * one upstream rename (tiktok_business), the deterministic per-user
 * connection alias, and the publish-slug → action-id map whose omissions
 * are deliberate (unsupported slugs must error, never silently mis-map).
 */
import { describe, expect, it } from "vitest";
import {
  toolkitForWzrdService,
  WZRD_ACTION_FOR_SLUG,
  WZRD_CONNECT_TOOLKITS,
  wzrdConnectionAlias,
  wzrdServiceFor,
} from "./slugs";

describe("service/toolkit translation", () => {
  it("maps tiktok to upstream's tiktok_business service id", () => {
    expect(wzrdServiceFor("tiktok")).toBe("tiktok_business");
    expect(toolkitForWzrdService("tiktok_business")).toBe("tiktok");
  });

  it("round-trips service ids that share their canonical slug", () => {
    for (const toolkit of WZRD_CONNECT_TOOLKITS) {
      expect(toolkitForWzrdService(wzrdServiceFor(toolkit))).toBe(toolkit);
    }
  });

  it("passes unknown slugs through unchanged", () => {
    expect(wzrdServiceFor("gmail")).toBe("gmail");
    expect(toolkitForWzrdService("gmail")).toBe("gmail");
  });
});

describe("wzrdConnectionAlias", () => {
  it("is the deterministic air-<userId> alias the proxy injects", () => {
    expect(wzrdConnectionAlias("user-1")).toBe("air-user-1");
  });
});

describe("WZRD_ACTION_FOR_SLUG", () => {
  it("maps only the publish slugs upstream actually supports", () => {
    expect(WZRD_ACTION_FOR_SLUG["INSTAGRAM_CREATE_POST"]).toBe(
      "instagram.publish_media"
    );
    expect(WZRD_ACTION_FOR_SLUG["TWITTER_CREATION_OF_A_POST"]).toBe(
      "twitter.creation_of_a_post"
    );
    expect(WZRD_ACTION_FOR_SLUG["YOUTUBE_UPLOAD_VIDEO"]).toBe(
      "youtube.upload_video_from_url"
    );
  });

  it("omits slugs with no upstream equivalent — unsupported must error", () => {
    // No facebook provider exists upstream, and tiktok has no publish action
    // — these must stay unmapped so execution reports unsupported rather
    // than calling a wrong action.
    for (const slug of [
      "FACEBOOK_CREATE_POST",
      "FACEBOOK_VIDEO_POST",
      "FACEBOOK_PHOTO_POST",
      "TIKTOK_PUBLISH_VIDEO",
      "INSTAGRAM_CREATE_MEDIA_CONTAINER",
      "INSTAGRAM_CREATE_CAROUSEL_CONTAINER",
      "INSTAGRAM_GET_POST_STATUS",
      "SHOPIFY_GET_PRODUCTS",
    ]) {
      expect(WZRD_ACTION_FOR_SLUG[slug]).toBeUndefined();
    }
  });
});
