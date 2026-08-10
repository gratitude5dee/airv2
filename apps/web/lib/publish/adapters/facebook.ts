/**
 * Facebook Page adapter (CM3 task 5) via Composio's FACEBOOK toolkit:
 * photo/video/feed posts against the connected Page.
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
import { FACEBOOK_SPEC } from "../specs/facebook";
import { firstString, unwrapToolResult } from "../result";

export const facebookAdapter: PublishAdapter = {
  platform: "facebook",
  scopes: ["pages_manage_posts", "pages_read_engagement"],
  limits: {
    maxCaptionChars: FACEBOOK_SPEC.maxCaptionChars,
    maxMediaItems: FACEBOOK_SPEC.maxMediaItems,
    dailyCap: FACEBOOK_SPEC.dailyCap,
  },

  validate(draft: Draft): Problem[] {
    const problems: Problem[] = [];
    if (draft.caption.length === 0 && draft.media.length === 0) {
      problems.push({
        code: "fb.empty",
        message: "A Facebook post needs text or media.",
      });
    }
    if (draft.caption.length > FACEBOOK_SPEC.maxCaptionChars) {
      problems.push({
        code: "fb.caption.length",
        message: `Post is ${draft.caption.length} characters; Facebook allows at most ${FACEBOOK_SPEC.maxCaptionChars}.`,
      });
    }
    if (draft.media.length > FACEBOOK_SPEC.maxMediaItems) {
      problems.push({
        code: "fb.media.count",
        message: `At most ${FACEBOOK_SPEC.maxMediaItems} media items per post.`,
      });
    }
    const videos = draft.media.filter((media) => media.kind === "video");
    if (videos.length > 0 && draft.media.length > 1) {
      problems.push({
        code: "fb.video.single",
        message: "A video post takes exactly one video, no other media.",
      });
    }
    for (const video of videos) {
      if (
        video.durationSeconds !== undefined &&
        video.durationSeconds > FACEBOOK_SPEC.maxVideoSeconds
      ) {
        problems.push({
          code: "fb.video.long",
          message: `Video must run at most ${FACEBOOK_SPEC.maxVideoSeconds / 3600} hours.`,
        });
      }
    }
    return problems;
  },

  async publish(ctx: PublishCtx, draft: Draft): Promise<Published> {
    const page_id = ctx.accountRef;
    const first = draft.media[0];
    let result: unknown;
    if (!first) {
      result = unwrapToolResult(
        await ctx.execute("FACEBOOK_CREATE_POST", {
          page_id,
          message: draft.caption,
          ...(draft.link ? { link: draft.link } : {}),
        })
      );
    } else if (first.kind === "video") {
      result = unwrapToolResult(
        await ctx.execute("FACEBOOK_CREATE_VIDEO_POST", {
          page_id,
          video_url: first.url,
          description: draft.caption,
        })
      );
    } else {
      result = unwrapToolResult(
        await ctx.execute("FACEBOOK_CREATE_PHOTO_POST", {
          page_id,
          photo_url: first.url,
          caption: draft.caption,
        })
      );
    }
    const externalId = firstString(result, [
      ["post_id"],
      ["id"],
      ["video_id"],
    ]);
    if (!externalId) {
      throw new PublishError(502, "facebook post returned no id");
    }
    return { externalId };
  },

  classify(status: number, body: string): Verdict {
    if (body.includes("OAuthException") || body.includes('"code":190')) {
      return {
        kind: "reauth",
        message: "Facebook Page connection expired — reconnect to keep posting.",
      };
    }
    return classifyDefault(status, body);
  },
};
