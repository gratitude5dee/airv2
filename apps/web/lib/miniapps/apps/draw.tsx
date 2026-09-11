/**
 * /draw mini-app renderer (mayor-coast parity port). The studio is a
 * dual-canvas sketch pad: the owner draws over a blank or an imported
 * background, posts the flattened PNG plus a prompt, and the draw lane
 * renders it through the metered creative pipeline — same session-bound
 * token contract as every first-party app, one draw_sessions row per card.
 *
 * Actions (all format=json over the same POST path):
 *   status   — events + revision list for the ~2s client poll
 *   upload   — a canvas PNG data URL → creative asset
 *   generate — admit + run a draw job (blocks on the render, like the image
 *              app's studio actions)
 *   animate  — zap-lane video off a delivered revision's output
 *   save     — attachment-send a revision's image back to the iMessage chat
 *   cancel   — free the in-flight slot (provider keeps running; the job is
 *              marked failed — no provider cancel exists on GMI)
 */
import { NextResponse } from "next/server";
import { ASSETS_BUCKET } from "@/lib/assets/keys";
import { mintDelivery, type CreativeAsset } from "@/lib/assets/pipeline";
import { getCreativeJob } from "@/lib/creative/jobs";
import { createSpectrumSender } from "@/lib/spectrum/sender";
import { esc, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import { theme } from "../themes";
import {
  admitDrawGeneration,
  animateDrawJob,
  cancelActiveDrawJob,
  DEFAULT_DRAW_MODE,
  DrawError,
  drawStatus,
  getDrawSession,
  isDrawMode,
  runDrawJob,
  storeDrawUpload,
  type DrawSession,
} from "../draw";
import type { MiniAppContext, MiniAppModule } from "./types";

/** The studio needs script + connect + media beyond the media-shell CSP. */
function studioShellHtml(body: string): NextResponse {
  const response = shellHtml(body, theme("pixel"));
  let csp = response.headers.get("Content-Security-Policy") ?? "";
  csp = csp.replace("img-src 'self'", "img-src 'self' https:");
  if (!csp.includes("img-src 'self' https:")) {
    // Theme CSP may omit img-src entirely on some themes.
    csp += "; img-src 'self' https:";
  }
  if (!csp.includes("media-src")) csp += "; media-src 'self' https:";
  if (!csp.includes("script-src")) csp += "; script-src 'self'";
  if (!csp.includes("connect-src")) csp += "; connect-src 'self'";
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

const SESSION_ENDED_BODY = `<section class="panel"><p>This draw session has ended. Send <b>/draw</b> in iMessage for a fresh card.</p></section>`;

function renderEnded(lite: boolean): NextResponse {
  return shellHtml(
    renderShell({
      title: "Draw",
      kicker: "Studio",
      body: SESSION_ENDED_BODY,
      theme: theme("pixel"),
      lite,
    }),
    theme("pixel")
  );
}

async function studioPayload(
  ctx: MiniAppContext,
  session: DrawSession,
  after: number
): Promise<Record<string, unknown>> {
  const status = await drawStatus(ctx.supabase, session, after);
  return {
    sessionId: session.id,
    expiresAt: session.expires_at,
    ...status,
  };
}

function renderStudio(
  ctx: MiniAppContext,
  payload: Record<string, unknown>
): NextResponse {
  // width:100% — as a shrink-to-fit flex child of main.app the div's width
  // would be indefinite, so the client's min(100%,…) widths could overflow
  // the column and clip the canvas on narrow screens.
  const body = `<div id="draw-studio" style="width:100%;flex:1;display:flex;flex-direction:column" data-payload="${esc(
    JSON.stringify(payload)
  )}"></div>
<script src="/creator-os/draw-studio.js" defer></script>
<noscript><section class="panel"><p class="muted">Draw needs JavaScript — open the card on your phone.</p></section></noscript>`;
  return studioShellHtml(
    renderShell({
      title: "Create",
      kicker: "Draw",
      body,
      // Flat dark surface — the navy studio is styled to it (shader backdrop
      // would fight the canvas work and the Messages webview's GPU budget).
      theme: theme("pixel"),
      lite: ctx.session.via === "card",
    })
  );
}

const json = (payload: Record<string, unknown>, status = 200): NextResponse =>
  withBaseHeaders(NextResponse.json(payload, { status }));

const errLine = (error: unknown): { code: string; line: string } => {
  if (error instanceof DrawError) {
    switch (error.code) {
      case "SESSION_EXPIRED":
        return {
          code: error.code,
          line: "this draw session has ended — send /draw for a fresh card",
        };
      case "JOB_ALREADY_ACTIVE":
        return {
          code: error.code,
          line: "Another image is still generating.",
        };
      case "PARENT_UNAVAILABLE":
      case "PARENT_EXPIRED":
        return {
          code: error.code,
          line: "that result is no longer available — try a fresh sketch",
        };
      case "JOB_NOT_READY":
        return { code: error.code, line: "that image isn't ready yet" };
    }
  }
  return { code: "DRAW_ERROR", line: "that didn't work — try again?" };
};

export const draw: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    const session = await getDrawSession(
      ctx.supabase,
      ctx.session.userId,
      ctx.session.resourceId
    );
    if (!session || session.status !== "active") {
      return renderEnded(ctx.session.via === "card");
    }
    return renderStudio(ctx, await studioPayload(ctx, session, -1));
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const action = String(form.get("action") ?? "");
    const session = await getDrawSession(
      ctx.supabase,
      ctx.session.userId,
      ctx.session.resourceId
    );
    if (!session) return json({ error: "SESSION_GONE" }, 404);
    if (session.status !== "active" && action !== "status") {
      const { code, line } = errLine(
        new DrawError("SESSION_EXPIRED", "expired")
      );
      return json({ error: code, line }, 410);
    }

    try {
      switch (action) {
        case "status": {
          const after = Number(form.get("after") ?? -1);
          return json(
            await studioPayload(ctx, session, Number.isFinite(after) ? after : -1)
          );
        }
        case "upload": {
          const asset = await storeDrawUpload(
            ctx.supabase,
            ctx.session.userId,
            String(form.get("image") ?? "")
          );
          if (!asset) return json({ error: "BAD_IMAGE", line: "that image couldn't be read" }, 400);
          return json({ assetId: asset.id });
        }
        case "generate": {
          const prompt = String(form.get("prompt") ?? "")
            .trim()
            .slice(0, 2000);
          const modeRaw = String(form.get("mode") ?? "");
          const mode = isDrawMode(modeRaw) ? modeRaw : DEFAULT_DRAW_MODE;
          const inputAssetId =
            String(form.get("inputAssetId") ?? "").trim() || undefined;
          const parentJobId =
            String(form.get("parentJobId") ?? "").trim() || undefined;
          const resetContext = String(form.get("resetContext") ?? "") === "1";
          if (!prompt && !inputAssetId && !parentJobId) {
            return json(
              { error: "EMPTY", line: "sketch something or describe it first" },
              400
            );
          }
          const job = await admitDrawGeneration(ctx.supabase, session, {
            prompt,
            mode,
            channel: "web",
            ...(inputAssetId ? { inputAssetId } : {}),
            ...(parentJobId ? { parentJobId } : {}),
            ...(resetContext ? { resetContext } : {}),
          });
          const result = await runDrawJob(
            ctx.supabase,
            session,
            job,
            prompt
          );
          return json({
            jobId: job.id,
            status: result.status,
            line: result.status === "delivered" ? result.deliveryLine : result.line,
            assetId: result.asset?.id,
            deliveryUrl: result.deliveryUrl,
            ...(await studioPayload(ctx, session, -1)),
          });
        }
        case "animate": {
          const jobId = String(form.get("jobId") ?? "").trim();
          const motionPrompt =
            String(form.get("motionPrompt") ?? "").trim().slice(0, 2000) ||
            undefined;
          const { job, result } = await animateDrawJob(
            ctx.supabase,
            session,
            jobId,
            motionPrompt
          );
          return json({
            jobId: job.id,
            status: result.status,
            line: result.status === "delivered" ? result.deliveryLine : result.line,
            assetId: result.asset?.id,
            deliveryUrl: result.deliveryUrl,
          });
        }
        case "save": {
          const jobId = String(form.get("jobId") ?? "").trim();
          const job = await getCreativeJob(
            ctx.supabase,
            ctx.session.userId,
            jobId
          );
          if (
            !job ||
            job.draw_session_id !== session.id ||
            job.status !== "delivered" ||
            !job.output_asset_id
          ) {
            return json(
              { error: "JOB_NOT_READY", line: "that image isn't ready to send" },
              400
            );
          }
          const { data: asset } = await ctx.supabase
            .from("creative_assets")
            .select("storage_key, sha256, ext")
            .eq("id", job.output_asset_id)
            .eq("user_id", ctx.session.userId)
            .maybeSingle();
          const download = asset
            ? await ctx.supabase.storage
                .from(ASSETS_BUCKET)
                .download(asset.storage_key as string)
            : null;
          if (!asset || !download || download.error || !download.data) {
            return json(
              { error: "ASSET_GONE", line: "the image expired — generate again" },
              410
            );
          }
          const bytes = Buffer.from(await download.data.arrayBuffer());
          const ext = String(asset.ext);
          const name = `draw-${String(asset.sha256).slice(0, 8)}.${ext}`;
          const mimeType =
            ext === "png"
              ? "image/png"
              : ext === "webp"
                ? "image/webp"
                : ext === "mp4"
                  ? "video/mp4"
                  : ext === "mov"
                    ? "video/quicktime"
                    : "image/jpeg";
          let sent = false;
          try {
            const sender = await createSpectrumSender();
            try {
              await sender.sendAttachment(
                session.space_id,
                session.phone,
                bytes,
                { name, mimeType }
              );
              sent = true;
            } finally {
              await sender.close().catch(() => undefined);
            }
          } catch {
            sent = false;
          }
          if (sent) return json({ sent: true, line: "sent to iMessage" });
          // Fallback: hand the client a short-TTL signed URL instead.
          const { data: full } = await ctx.supabase
            .from("creative_assets")
            .select("*")
            .eq("id", job.output_asset_id)
            .eq("user_id", ctx.session.userId)
            .maybeSingle();
          if (full) {
            const delivery = await mintDelivery(
              ctx.supabase,
              full as CreativeAsset,
              `miniapp-draw:${session.id}`
            ).catch(() => undefined);
            if (delivery) {
              return json({ sent: false, downloadUrl: delivery.url });
            }
          }
          return json(
            { error: "SEND_FAILED", line: "couldn't send it — try again" },
            502
          );
        }
        case "cancel": {
          await cancelActiveDrawJob(ctx.supabase, session);
          return json({ cancelled: true });
        }
        default:
          return json({ error: "UNKNOWN_ACTION" }, 400);
      }
    } catch (error) {
      if (error instanceof DrawError) {
        const { code, line } = errLine(error);
        const status = code === "SESSION_EXPIRED" ? 410 : 409;
        return json({ error: code, line }, status);
      }
      throw error;
    }
  },
};
