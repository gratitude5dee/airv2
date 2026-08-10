/**
 * X (Twitter) adapter (CM3 task 5) via Composio's TWITTER toolkit.
 * Text-only for now: the hosted toolkit's post creation takes pre-uploaded
 * media ids and no upload tool, so validate() rejects drafts with media
 * rather than silently dropping attachments.
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
    maxMediaItems: 0,
    dailyCap: X_SPEC.dailyCap,
  },

  validate(draft: Draft): Problem[] {
    const problems: Problem[] = [];
    if (draft.caption.length === 0) {
      problems.push({
        code: "x.empty",
        message: "A post needs text.",
      });
    }
    if (draft.media.length > 0) {
      problems.push({
        code: "x.media.unsupported",
        message:
          "X posts are text-only for now — media attachments aren't supported yet.",
      });
    }
    if (draft.caption.length > X_SPEC.maxCaptionChars) {
      problems.push({
        code: "x.caption.length",
        message: `Post is ${draft.caption.length} characters; X allows at most ${X_SPEC.maxCaptionChars}.`,
      });
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
