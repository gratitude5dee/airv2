/**
 * /freeze mini-app: freeze a photo's scene, then move the camera around
 * the stopped instant. The studio is a three-stage surface — pick a source
 * still (camera capture, upload, or a sketch through the Flare lanes),
 * author a camera path (draggable keyframes or a preset), and collect the
 * rendered clip — same session-bound token contract and metered creative
 * pipeline as /draw.
 *
 * Actions (all format=json over the same POST path):
 *   status — events + job rows for the ~2s client poll
 *   source — set the source still; `kind=sketch` runs a Flare sketch job
 *            (canvas file or PNG data URL optional), otherwise a raw file
 *            upload or data URL (iPhone HEIC converted to PNG server-side)
 *   render — admit a camera-move job on the fal multi-angle lane, then
 *            run it via after() so the response returns the job id
 *            immediately (the client shows cancel and polls)
 *   save   — attachment-send a render's video back to the iMessage chat
 *   cancel — free the in-flight slot (provider keeps running; the job is
 *            marked failed — fal has no cancel on this endpoint)
 */
import { NextResponse, after } from "next/server";
import { ASSETS_BUCKET } from "@/lib/assets/keys";
import { mintDelivery, type CreativeAsset } from "@/lib/assets/pipeline";
import { createSpectrumSender } from "@/lib/spectrum/sender";
import { esc, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import { theme } from "../themes";
import { DEFAULT_DRAW_MODE, isDrawMode } from "../draw";
import {
  cancelActiveFreezeJob,
  freezeStatus,
  FreezeError,
  getFreezeSession,
  type FreezeSession,
  MAX_FREEZE_UPLOAD_BYTES,
  admitFreezeRender,
  admitFreezeSketch,
  executeFreezeRender,
  executeFreezeSketch,
  resolveFreezeRender,
  setFreezeSource,
  storeFreezeUpload,
} from "../freeze";
import { PRESETS, validateTrajectory } from "../freezeRecipe";
import type { MiniAppContext, MiniAppModule } from "./types";

/** The studio needs script + connect + media beyond the media-shell CSP. */
function studioShellHtml(body: string): NextResponse {
  const response = shellHtml(body, theme("pixel"));
  let csp = response.headers.get("Content-Security-Policy") ?? "";
  csp = csp.replace("img-src 'self'", "img-src 'self' https:");
  if (!csp.includes("img-src 'self' https:")) {
    csp += "; img-src 'self' https:";
  }
  if (!csp.includes("media-src")) csp += "; media-src 'self' https:";
  if (!csp.includes("script-src")) csp += "; script-src 'self'";
  if (!csp.includes("connect-src")) csp += "; connect-src 'self'";
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

const SESSION_ENDED_BODY = `<section class="panel"><p>This freeze session has ended. Send <b>/freeze</b> in iMessage for a fresh card.</p></section>`;

function renderEnded(lite: boolean): NextResponse {
  return shellHtml(
    renderShell({
      title: "Freeze",
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
  session: FreezeSession,
  after: number
): Promise<Record<string, unknown>> {
  const status = await freezeStatus(ctx.supabase, session, after);
  return {
    sessionId: session.id,
    expiresAt: session.expires_at,
    // The card surface forbids WebGL — the client renders the 2D editor
    // directly instead of attempting a Three.js init that must fail.
    lite: ctx.session.via === "card",
    // The client renders the preset chip rail and previews each path from
    // this; preset ids are stable across deploys.
    presets: PRESETS.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      duration: preset.duration,
      returnsToStart: preset.returnsToStart,
      trajectory: preset.trajectory,
    })),
    ...status,
  };
}

function renderStudio(
  ctx: MiniAppContext,
  payload: Record<string, unknown>
): NextResponse {
  // width:100% — the shrink-to-fit flex child would leave the client's
  // min(100%,…) widths indefinite and clip the stage on narrow screens.
  const body = `<div id="freeze-studio" style="width:100%;flex:1;display:flex;flex-direction:column" data-payload="${esc(
    JSON.stringify(payload)
  )}"></div>
<script src="/creator-os/freeze-studio.js" defer></script>
<noscript><section class="panel"><p class="muted">Freeze needs JavaScript — open the card on your phone.</p></section></noscript>`;
  return studioShellHtml(
    renderShell({
      title: "Create",
      kicker: "Freeze",
      body,
      theme: theme("pixel"),
      lite: ctx.session.via === "card",
    })
  );
}

const json = (payload: Record<string, unknown>, status = 200): NextResponse =>
  withBaseHeaders(NextResponse.json(payload, { status }));

/** base64 inflates by 4/3 — a data URL past this can't hold a legal upload. */
const MAX_DATA_URL_CHARS = Math.ceil(MAX_FREEZE_UPLOAD_BYTES * (4 / 3)) + 256;
const TOO_LARGE = () =>
  json({ error: "TOO_LARGE", line: "that image is too large" }, 400);

const errLine = (error: unknown): { code: string; line: string } => {
  if (error instanceof FreezeError) {
    switch (error.code) {
      case "SESSION_EXPIRED":
        return {
          code: error.code,
          line: "this freeze session has ended — send /freeze for a fresh card",
        };
      case "JOB_ALREADY_ACTIVE":
        return { code: error.code, line: "Another render is still running." };
      case "NO_SOURCE":
        return { code: error.code, line: "pick a photo first" };
      case "SOURCE_UNAVAILABLE":
        return {
          code: error.code,
          line: "that photo isn't available anymore — pick it again",
        };
      case "BAD_PATH":
        return {
          code: error.code,
          line: "that camera path doesn't work — adjust it",
        };
    }
  }
  return { code: "FREEZE_ERROR", line: "that didn't work — try again?" };
};

export const freeze: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    const session = await getFreezeSession(
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
    const session = await getFreezeSession(
      ctx.supabase,
      ctx.session.userId,
      ctx.session.resourceId
    );
    if (!session) return json({ error: "SESSION_GONE" }, 404);
    if (session.status !== "active" && action !== "status") {
      const { code, line } = errLine(
        new FreezeError("SESSION_EXPIRED", "expired")
      );
      return json({ error: code, line }, 410);
    }

    try {
      switch (action) {
        case "status": {
          // Status stays answerable on an ended session so a polling client
          // can stand down — but it returns a stub that mints no signed
          // URLs rather than re-signing media on an expired session.
          if (session.status !== "active") {
            const { code, line } = errLine(
              new FreezeError("SESSION_EXPIRED", "expired")
            );
            return json({
              sessionId: session.id,
              expiresAt: session.expires_at,
              events: [],
              latest: -1,
              activeJob: null,
              latestJobId: null,
              sourceAssetId: null,
              sourceUrl: null,
              sketches: [],
              renders: [],
              error: code,
              line,
            });
          }
          const after = Number(form.get("after") ?? -1);
          return json(
            await studioPayload(ctx, session, Number.isFinite(after) ? after : -1)
          );
        }
        case "source": {
          // kind=sketch: run a Flare-mode generation; the flattened canvas
          // (a File, or a PNG data URL) becomes the edit source, prompt-only
          // sketches run without one. The delivered image becomes the
          // session's source still.
          if (String(form.get("kind") ?? "") === "sketch") {
            const prompt = String(form.get("prompt") ?? "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 2000);
            if (!prompt) {
              return json(
                { error: "EMPTY", line: "describe the scene first" },
                400
              );
            }
            const modeRaw = String(form.get("mode") ?? "");
            const mode = isDrawMode(modeRaw) ? modeRaw : DEFAULT_DRAW_MODE;

            let sketchAssetId: string | undefined;
            const canvasFile = form.get("canvas");
            let canvasBytes: Buffer | undefined;
            if (canvasFile instanceof File && canvasFile.size > 0) {
              // Cap before buffering — the File is fully materialized by
              // arrayBuffer, so the 12 MB guard must run on declared size.
              if (canvasFile.size > MAX_FREEZE_UPLOAD_BYTES) {
                return TOO_LARGE();
              }
              canvasBytes = Buffer.from(await canvasFile.arrayBuffer());
            } else {
              const dataUrl = String(form.get("image") ?? "");
              if (dataUrl.length > MAX_DATA_URL_CHARS) return TOO_LARGE();
              const comma = dataUrl.indexOf(",");
              if (
                dataUrl.startsWith("data:image/png") &&
                comma > -1 &&
                dataUrl.slice(5, comma).endsWith(";base64")
              ) {
                canvasBytes = Buffer.from(dataUrl.slice(comma + 1), "base64");
              }
            }
            if (canvasBytes?.length) {
              const asset = await storeFreezeUpload(
                ctx.supabase,
                ctx.session.userId,
                canvasBytes,
                "image/png"
              );
              if (!asset) {
                return json(
                  { error: "BAD_IMAGE", line: "that sketch couldn't be read" },
                  400
                );
              }
              sketchAssetId = asset.id;
            }

            const job = await admitFreezeSketch(ctx.supabase, session, {
              prompt,
              mode,
              sketchAssetId,
              channel: "web",
            });
            // Admission returns immediately; the generation runs after the
            // response so the client sees the job (and can cancel it) while
            // it's still running.
            const supabase = ctx.supabase;
            after(() =>
              executeFreezeSketch(supabase, session, job, {
                prompt,
                mode,
                sketchAssetId,
              }).catch((error: unknown) =>
                console.error(
                  JSON.stringify({
                    msg: "freeze sketch run failed",
                    session_id: session.id,
                    error:
                      error instanceof Error ? error.message : String(error),
                  })
                )
              )
            );
            return json({
              jobId: job.id,
              admitted: true,
              ...(await studioPayload(ctx, session, -1)),
            });
          }

          // Capture / upload lanes: the client posts a File (raw HEIC bytes
          // survive multipart) or a data-url fallback; HEIC is converted to
          // PNG in storeFreezeUpload.
          let bytes: Buffer | undefined;
          let mimeType = "";
          const file = form.get("file");
          if (file instanceof File && file.size > 0) {
            if (file.size > MAX_FREEZE_UPLOAD_BYTES) {
              return json(
                { error: "TOO_LARGE", line: "that photo is too large" },
                400
              );
            }
            bytes = Buffer.from(await file.arrayBuffer());
            mimeType = file.type || "application/octet-stream";
          } else {
            const dataUrl = String(form.get("image") ?? "");
            if (dataUrl.length > MAX_DATA_URL_CHARS) return TOO_LARGE();
            const comma = dataUrl.indexOf(",");
            if (dataUrl.startsWith("data:") && comma > -1) {
              mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
              if (dataUrl.slice(5, comma).endsWith(";base64")) {
                bytes = Buffer.from(dataUrl.slice(comma + 1), "base64");
              }
            }
          }
          if (!bytes?.length) {
            return json(
              { error: "BAD_IMAGE", line: "that photo didn't come through" },
              400
            );
          }
          const asset = await storeFreezeUpload(
            ctx.supabase,
            ctx.session.userId,
            bytes,
            mimeType
          );
          if (!asset) {
            return json(
              { error: "BAD_IMAGE", line: "that photo format isn't usable" },
              400
            );
          }
          await setFreezeSource(ctx.supabase, session, asset.id);
          return json({ sourceAssetId: asset.id });
        }
        case "render": {
          const presetId = String(form.get("preset") ?? "").trim() || undefined;
          let trajectory;
          if (!presetId) {
            try {
              trajectory = validateTrajectory(
                JSON.parse(String(form.get("trajectory") ?? ""))
              );
            } catch {
              trajectory = undefined;
            }
            if (!trajectory) {
              return json(
                { error: "BAD_PATH", line: "that camera path doesn't work" },
                400
              );
            }
          }
          const duration = Number(form.get("duration") ?? NaN);
          const seed = Number(form.get("seed") ?? NaN);
          const resolved = resolveFreezeRender({
            presetId,
            trajectory,
            duration: Number.isFinite(duration) ? duration : undefined,
            resolution:
              String(form.get("resolution") ?? "").trim() || undefined,
            seed: Number.isFinite(seed) ? seed : undefined,
          });
          const job = await admitFreezeRender(ctx.supabase, session, {
            channel: "web",
          });
          const supabase = ctx.supabase;
          after(() =>
            executeFreezeRender(supabase, session, job, resolved).catch(
              (error: unknown) =>
                console.error(
                  JSON.stringify({
                    msg: "freeze render run failed",
                    session_id: session.id,
                    error:
                      error instanceof Error ? error.message : String(error),
                  })
                )
            )
          );
          return json({
            jobId: job.id,
            admitted: true,
            ...(await studioPayload(ctx, session, -1)),
          });
        }
        case "save": {
          const jobId = String(form.get("job") ?? "").trim();
          if (!jobId) {
            return json({ error: "NO_JOB", line: "nothing to send" }, 400);
          }
          const { data: job } = await ctx.supabase
            .from("creative_jobs")
            .select("id, status, freeze_session_id, output_asset_id")
            .eq("id", jobId)
            .eq("user_id", ctx.session.userId)
            .maybeSingle();
          if (
            !job ||
            job.freeze_session_id !== session.id ||
            job.status !== "delivered" ||
            !job.output_asset_id
          ) {
            return json(
              { error: "JOB_NOT_READY", line: "that video isn't ready to send" },
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
              { error: "ASSET_GONE", line: "the video expired — render again" },
              410
            );
          }
          const bytes = Buffer.from(await download.data.arrayBuffer());
          const name = `freeze-${String(asset.sha256).slice(0, 8)}.mp4`;
          let sent = false;
          try {
            const sender = await createSpectrumSender();
            try {
              await sender.sendAttachment(
                session.space_id,
                session.phone,
                bytes,
                { name, mimeType: "video/mp4" }
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
              `miniapp-freeze:${session.id}`
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
          await cancelActiveFreezeJob(ctx.supabase, session);
          return json({ cancelled: true });
        }
        default:
          return json({ error: "UNKNOWN_ACTION" }, 400);
      }
    } catch (error) {
      if (error instanceof FreezeError) {
        const { code, line } = errLine(error);
        const status = code === "SESSION_EXPIRED" ? 410 : 409;
        return json({ error: code, line }, status);
      }
      throw error;
    }
  },
};
