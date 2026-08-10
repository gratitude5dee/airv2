/**
 * TikTok adapter (CM3 task 5) — written but DARK behind the PUBLISH_TIKTOK
 * flag until the V4 Content Posting API review clears. TikTok has no native
 * scheduling: every scheduled TikTok is our cron firing an immediate publish
 * at slot time — a reliability requirement on the CM4 worker.
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
import { TIKTOK_SPEC } from "../specs/tiktok";
import { firstString, unwrapToolResult } from "../result";

const PUBLISH_STATE_KEY = "tt_publish_id";
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24;

export const tiktokAdapter: PublishAdapter = {
  platform: "tiktok",
  scopes: ["video.publish"],
  limits: {
    maxCaptionChars: TIKTOK_SPEC.maxCaptionChars,
    maxMediaItems: 1,
    dailyCap: TIKTOK_SPEC.dailyCap,
  },

  validate(draft: Draft): Problem[] {
    const problems: Problem[] = [];
    const videos = draft.media.filter((media) => media.kind === "video");
    if (videos.length !== 1 || draft.media.length !== 1) {
      problems.push({
        code: "tt.video.single",
        message: "A TikTok post takes exactly one video.",
      });
    }
    if (draft.caption.length > TIKTOK_SPEC.maxCaptionChars) {
      problems.push({
        code: "tt.caption.length",
        message: `Caption is ${draft.caption.length} characters; TikTok allows at most ${TIKTOK_SPEC.maxCaptionChars}.`,
      });
    }
    const video = videos[0];
    if (video && video.durationSeconds !== undefined) {
      if (video.durationSeconds < TIKTOK_SPEC.minVideoSeconds) {
        problems.push({
          code: "tt.video.short",
          message: `Video must run at least ${TIKTOK_SPEC.minVideoSeconds}s.`,
        });
      }
      if (video.durationSeconds > TIKTOK_SPEC.maxVideoSeconds) {
        problems.push({
          code: "tt.video.long",
          message: `Video must run at most ${TIKTOK_SPEC.maxVideoSeconds / 60} minutes.`,
        });
      }
    }
    return problems;
  },

  async publish(ctx: PublishCtx, draft: Draft): Promise<Published> {
    const first = draft.media[0];
    if (!first) {
      throw new PublishError(400, "post has no video");
    }
    let publishId = ctx.state[PUBLISH_STATE_KEY] ?? null;
    if (!publishId) {
      const started = unwrapToolResult(
        await ctx.execute("TIKTOK_PUBLISH_VIDEO", {
          video_url: first.url,
          title: draft.caption,
        })
      );
      publishId = firstString(started, [
        ["publish_id"],
        ["data", "publish_id"],
      ]);
      if (!publishId) {
        throw new PublishError(502, "publish returned no publish_id");
      }
      ctx.state[PUBLISH_STATE_KEY] = publishId;
      await ctx.saveState();
    }
    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      const status = unwrapToolResult(
        await ctx.execute("TIKTOK_FETCH_PUBLISH_STATUS", {
          publish_id: publishId,
        })
      );
      const code = firstString(status, [
        ["status"],
        ["data", "status"],
      ]);
      if (code === "PUBLISH_COMPLETE" || code === "SUCCESS") {
        delete ctx.state[PUBLISH_STATE_KEY];
        await ctx.saveState();
        const externalId =
          firstString(status, [
            ["publicaly_available_post_id"],
            ["data", "publicaly_available_post_id"],
          ]) ?? publishId;
        return { externalId };
      }
      if (code === "FAILED") {
        delete ctx.state[PUBLISH_STATE_KEY];
        await ctx.saveState();
        const reason =
          firstString(status, [["fail_reason"], ["data", "fail_reason"]]) ??
          "publish failed";
        throw new PublishError(400, reason);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    // Still processing at the deadline: the publish id stays in state, the
    // next claim resumes polling the same publish.
    throw new PublishError(503, "publish still processing");
  },

  classify(status: number, body: string): Verdict {
    if (body.includes("access_token_invalid") || body.includes("scope")) {
      return {
        kind: "reauth",
        message: "TikTok connection expired — reconnect to keep posting.",
      };
    }
    if (body.includes("spam_risk")) {
      return {
        kind: "retry",
        after: 60 * 60,
      };
    }
    return classifyDefault(status, body);
  },
};
