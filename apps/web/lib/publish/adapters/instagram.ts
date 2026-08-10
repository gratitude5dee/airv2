/**
 * Instagram adapter (CM3 task 5): create-container → poll status →
 * media_publish, via Composio's INSTAGRAM toolkit. Video processing runs
 * minutes, so the container id is checkpointed into ctx.state — a worker
 * that dies mid-poll resumes the SAME container on the next claim and never
 * creates a second one (CM3 task 4).
 */
import {
  aspectRatio,
  classifyDefault,
  type Draft,
  type Metric,
  type Problem,
  type PublishAdapter,
  type PublishCtx,
  type Published,
  PublishError,
  type Verdict,
} from "../adapter";
import { INSTAGRAM_SPEC } from "../specs/instagram";
import { firstString, unwrapToolResult } from "../result";

const CONTAINER_STATE_KEY = "ig_container_id";
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24;

export const instagramAdapter: PublishAdapter = {
  platform: "instagram",
  scopes: ["instagram_business_basic", "instagram_business_content_publish"],
  limits: {
    maxCaptionChars: INSTAGRAM_SPEC.maxCaptionChars,
    maxMediaItems: INSTAGRAM_SPEC.maxCarouselItems,
    dailyCap: INSTAGRAM_SPEC.dailyCap,
  },

  validate(draft: Draft): Problem[] {
    const problems: Problem[] = [];
    if (draft.media.length === 0) {
      problems.push({
        code: "ig.media.required",
        message: "Instagram posts need at least one image or video.",
      });
    }
    if (draft.media.length > INSTAGRAM_SPEC.maxCarouselItems) {
      problems.push({
        code: "ig.media.count",
        message: `A carousel holds at most ${INSTAGRAM_SPEC.maxCarouselItems} items.`,
      });
    }
    if (draft.kind === "story" && draft.media.length > 1) {
      problems.push({
        code: "ig.story.single",
        message: "Stories take one item and do not carousel.",
      });
    }
    if (draft.caption.length > INSTAGRAM_SPEC.maxCaptionChars) {
      problems.push({
        code: "ig.caption.length",
        message: `Caption is ${draft.caption.length} characters; Instagram allows at most ${INSTAGRAM_SPEC.maxCaptionChars}.`,
      });
    }
    for (const media of draft.media) {
      if (media.kind === "image") {
        const ratio = aspectRatio(media);
        if (
          ratio !== null &&
          (ratio < INSTAGRAM_SPEC.minAspect || ratio > INSTAGRAM_SPEC.maxAspect)
        ) {
          problems.push({
            code: "ig.image.aspect",
            message: `Image aspect ratio must be between 4:5 and 1.91:1 (got ${ratio.toFixed(2)}:1).`,
          });
        }
      }
      if (media.kind === "video" && media.durationSeconds !== undefined) {
        if (media.durationSeconds < INSTAGRAM_SPEC.minVideoSeconds) {
          problems.push({
            code: "ig.video.short",
            message: `Video must run at least ${INSTAGRAM_SPEC.minVideoSeconds}s.`,
          });
        }
        if (media.durationSeconds > INSTAGRAM_SPEC.maxVideoSeconds) {
          problems.push({
            code: "ig.video.long",
            message: `Video must run at most ${INSTAGRAM_SPEC.maxVideoSeconds / 60} minutes.`,
          });
        }
      }
    }
    return problems;
  },

  async publish(ctx: PublishCtx, draft: Draft): Promise<Published> {
    let containerId = ctx.state[CONTAINER_STATE_KEY] ?? null;
    if (!containerId) {
      containerId = await createContainer(ctx, draft);
      ctx.state[CONTAINER_STATE_KEY] = containerId;
      await ctx.saveState();
    }
    await waitForContainer(ctx, containerId);
    const published = unwrapToolResult(
      await ctx.execute("INSTAGRAM_CREATE_POST", {
        creation_id: containerId,
      })
    );
    const externalId = firstString(published, [["id"], ["media_id"]]);
    if (!externalId) {
      throw new PublishError(502, "publish returned no media id");
    }
    delete ctx.state[CONTAINER_STATE_KEY];
    await ctx.saveState();
    const permalink = firstString(published, [["permalink"]]);
    return { externalId, ...(permalink ? { permalink } : {}) };
  },

  classify(status: number, body: string): Verdict {
    // OAuthException subcode 190: token expired/revoked → reconnect card.
    if (body.includes("OAuthException") || body.includes('"code":190')) {
      return {
        kind: "reauth",
        message: "Instagram connection expired — reconnect to keep posting.",
      };
    }
    // Code 9 / 4: application-level throttling → invisible backoff.
    if (body.includes("Application request limit reached")) {
      return { kind: "retry", after: 30 * 60 };
    }
    return classifyDefault(status, body);
  },

  async metrics(ctx: PublishCtx, externalId: string): Promise<Metric[]> {
    const data = unwrapToolResult(
      await ctx.execute("INSTAGRAM_GET_POST_INSIGHTS", {
        media_id: externalId,
      })
    );
    const reach = firstString(data, [["reach"], ["data", "reach"]]);
    return reach ? [{ name: "reach", value: Number(reach) }] : [];
  },
};

async function createContainer(
  ctx: PublishCtx,
  draft: Draft
): Promise<string> {
  if (draft.media.length > 1) {
    const children: string[] = [];
    for (const media of draft.media) {
      children.push(await createItemContainer(ctx, media.url, media.kind, true));
    }
    const carousel = unwrapToolResult(
      await ctx.execute("INSTAGRAM_CREATE_CAROUSEL_CONTAINER", {
        children,
        caption: draft.caption,
      })
    );
    const id = firstString(carousel, [["id"], ["container_id"]]);
    if (!id) throw new PublishError(502, "carousel container returned no id");
    return id;
  }
  const media = draft.media[0];
  if (!media) {
    throw new PublishError(400, "post has no media");
  }
  return await createItemContainer(
    ctx,
    media.url,
    media.kind,
    false,
    draft.caption,
    draft.kind
  );
}

async function createItemContainer(
  ctx: PublishCtx,
  url: string,
  kind: "image" | "video",
  isCarouselItem: boolean,
  caption?: string,
  draftKind?: Draft["kind"]
): Promise<string> {
  const args: Record<string, unknown> = {
    ...(kind === "image" ? { image_url: url } : { video_url: url }),
    ...(kind === "video" ? { media_type: "REELS" } : {}),
    ...(draftKind === "story" ? { media_type: "STORIES" } : {}),
    ...(isCarouselItem ? { is_carousel_item: true } : {}),
    ...(caption !== undefined ? { caption } : {}),
  };
  const container = unwrapToolResult(
    await ctx.execute("INSTAGRAM_CREATE_MEDIA_CONTAINER", args)
  );
  const id = firstString(container, [["id"], ["container_id"]]);
  if (!id) throw new PublishError(502, "media container returned no id");
  return id;
}

async function waitForContainer(
  ctx: PublishCtx,
  containerId: string
): Promise<void> {
  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    const status = unwrapToolResult(
      await ctx.execute("INSTAGRAM_GET_POST_STATUS", {
        container_id: containerId,
      })
    );
    const code = firstString(status, [["status_code"], ["status"]]);
    if (code === "FINISHED" || code === "PUBLISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      // Terminal: drop the checkpoint so a retry creates a fresh container
      // instead of re-polling a dead one forever.
      delete ctx.state[CONTAINER_STATE_KEY];
      await ctx.saveState();
      throw new PublishError(400, `container processing failed: ${code}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  // Still processing at the worker deadline: leave the container id in
  // state and signal a retry — the next claim resumes the same container.
  throw new PublishError(503, "container still processing");
}
