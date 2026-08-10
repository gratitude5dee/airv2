/**
 * X (Twitter) adapter (CM3 task 5) via Composio's TWITTER toolkit.
 * Note: media upload through the hosted toolkit is text/link-first; media
 * attachment requires pre-uploaded media ids, which the toolkit exposes via
 * the post's media payload when available.
 */
import {
  classifyDefault,
  type Draft,
  type Problem,
  type PublishAdapter,
  type PublishCtx,
  type Published,
  PublishError,
  type Verdict,
} from "../adapter";
import { X_SPEC } from "../specs/x";
import { firstString, unwrapToolResult } from "../result";

export const xAdapter: PublishAdapter = {
  platform: "x",
  scopes: ["tweet.read", "tweet.write", "users.read"],
  limits: {
    maxCaptionChars: X_SPEC.maxCaptionChars,
    maxMediaItems: X_SPEC.maxImages,
    dailyCap: X_SPEC.dailyCap,
  },

  validate(draft: Draft): Problem[] {
    const problems: Problem[] = [];
    if (draft.caption.length === 0 && draft.media.length === 0) {
      problems.push({
        code: "x.empty",
        message: "A post needs text or media.",
      });
    }
    if (draft.caption.length > X_SPEC.maxCaptionChars) {
      problems.push({
        code: "x.caption.length",
        message: `Post is ${draft.caption.length} characters; X allows at most ${X_SPEC.maxCaptionChars}.`,
      });
    }
    const images = draft.media.filter((media) => media.kind === "image");
    const videos = draft.media.filter((media) => media.kind === "video");
    if (images.length > X_SPEC.maxImages) {
      problems.push({
        code: "x.images.count",
        message: `At most ${X_SPEC.maxImages} images per post.`,
      });
    }
    if (videos.length > X_SPEC.maxVideos) {
      problems.push({
        code: "x.videos.count",
        message: "At most one video per post.",
      });
    }
    if (videos.length > 0 && images.length > 0) {
      problems.push({
        code: "x.media.mixed",
        message: "A post takes images or one video, not both.",
      });
    }
    for (const video of videos) {
      if (
        video.durationSeconds !== undefined &&
        video.durationSeconds > X_SPEC.maxVideoSeconds
      ) {
        problems.push({
          code: "x.video.long",
          message: `Video must run at most ${X_SPEC.maxVideoSeconds}s.`,
        });
      }
    }
    return problems;
  },

  async publish(ctx: PublishCtx, draft: Draft): Promise<Published> {
    const result = unwrapToolResult(
      await ctx.execute("TWITTER_CREATION_OF_A_POST", {
        text: draft.caption,
      })
    );
    const externalId = firstString(result, [
      ["data", "id"],
      ["id"],
    ]);
    if (!externalId) {
      throw new PublishError(502, "post returned no id");
    }
    return {
      externalId,
      permalink: `https://x.com/i/status/${externalId}`,
    };
  },

  classify(status: number, body: string): Verdict {
    if (body.includes("duplicate")) {
      return {
        kind: "fix-content",
        message: "X rejected this as a duplicate of a recent post.",
      };
    }
    return classifyDefault(status, body);
  },
};
