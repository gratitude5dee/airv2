/**
 * YouTube adapter (CM3 task 5) via Composio's YOUTUBE toolkit.
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
import { YOUTUBE_SPEC } from "../specs/youtube";
import { firstString, unwrapToolResult } from "../result";

export const youtubeAdapter: PublishAdapter = {
  platform: "youtube",
  scopes: ["https://www.googleapis.com/auth/youtube.upload"],
  limits: {
    maxCaptionChars: YOUTUBE_SPEC.maxDescriptionChars,
    maxMediaItems: 1,
    dailyCap: YOUTUBE_SPEC.dailyCap,
  },

  validate(draft: Draft): Problem[] {
    const problems: Problem[] = [];
    const videos = draft.media.filter((media) => media.kind === "video");
    if (videos.length !== 1 || draft.media.length !== 1) {
      problems.push({
        code: "yt.video.single",
        message: "A YouTube upload takes exactly one video.",
      });
    }
    if (!draft.title || draft.title.length === 0) {
      problems.push({
        code: "yt.title.required",
        message: "YouTube uploads need a title.",
      });
    }
    if (draft.title && draft.title.length > YOUTUBE_SPEC.maxTitleChars) {
      problems.push({
        code: "yt.title.length",
        message: `Title is ${draft.title.length} characters; YouTube allows at most ${YOUTUBE_SPEC.maxTitleChars}.`,
      });
    }
    if (draft.title && /[<>]/.test(draft.title)) {
      problems.push({
        code: "yt.title.brackets",
        message: "YouTube titles cannot contain angle brackets.",
      });
    }
    if (draft.caption.length > YOUTUBE_SPEC.maxDescriptionChars) {
      problems.push({
        code: "yt.description.length",
        message: `Description is ${draft.caption.length} characters; YouTube allows at most ${YOUTUBE_SPEC.maxDescriptionChars}.`,
      });
    }
    if (/[<>]/.test(draft.caption)) {
      problems.push({
        code: "yt.description.brackets",
        message: "YouTube descriptions cannot contain angle brackets.",
      });
    }
    const video = videos[0];
    if (
      video &&
      video.durationSeconds !== undefined &&
      video.durationSeconds > YOUTUBE_SPEC.maxVideoSeconds
    ) {
      problems.push({
        code: "yt.video.long",
        message: `Video must run at most ${YOUTUBE_SPEC.maxVideoSeconds / 60} minutes for unverified accounts.`,
      });
    }
    return problems;
  },

  async publish(ctx: PublishCtx, draft: Draft): Promise<Published> {
    const first = draft.media[0];
    if (!first) {
      throw new PublishError(400, "upload has no video");
    }
    const result = unwrapToolResult(
      await ctx.execute("YOUTUBE_UPLOAD_VIDEO", {
        video_url: first.url,
        title: draft.title,
        description: draft.caption,
      })
    );
    const externalId = firstString(result, [
      ["id"],
      ["video_id"],
      ["data", "id"],
    ]);
    if (!externalId) {
      throw new PublishError(502, "upload returned no video id");
    }
    return {
      externalId,
      permalink: `https://www.youtube.com/watch?v=${externalId}`,
    };
  },

  classify(status: number, body: string): Verdict {
    if (body.includes("quotaExceeded")) {
      // Daily quota resets at midnight PT; back off long.
      return { kind: "retry", after: 6 * 60 * 60 };
    }
    if (body.includes("invalid_grant")) {
      return {
        kind: "reauth",
        message: "YouTube connection expired — reconnect to keep uploading.",
      };
    }
    return classifyDefault(status, body);
  },
};
