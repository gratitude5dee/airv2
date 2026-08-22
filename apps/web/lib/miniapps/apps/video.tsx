/** Video editor mini-app renderer (V9 MA7 #7). Timeline documents live in
 * the user's box; renders run box-side as metered video_render jobs through
 * the existing creative job flow. */
import { NextResponse } from "next/server";
import { refreshVideoRender, startVideoRender } from "@/lib/creative/videoRender";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { externalOrigin } from "../gates";
import { esc, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import {
  getVideoDoc,
  setVideoRenderJob,
  updateVideoDoc,
  type VideoClip,
  type VideoDoc,
} from "../creativeDocs";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

/** The shell's theme CSP, widened for the https video preview only. */
function mediaShellHtml(body: string): NextResponse {
  const response = shellHtml(body);
  response.headers.set(
    "Content-Security-Policy",
    `${response.headers.get("Content-Security-Policy")}; media-src https:`
  );
  return response;
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`;
}

function renderClip(clip: VideoClip, index: number): string {
  return `<div class="card">
<strong>${index + 1}.</strong> ${esc(clip.assetId)}${clip.caption ? ` — “${esc(clip.caption)}”` : ""}
<span class="when">${clip.trimStart}s → ${clip.trimEnd > 0 ? `${clip.trimEnd}s` : "end"}</span>
<form method="post">${hidden("action", "move")}${hidden("id", clip.id)}<button name="direction" value="up" class="ghost">←</button><button name="direction" value="down" class="ghost">→</button></form>
<form method="post">${hidden("action", "set-trim")}${hidden("id", clip.id)}<input type="text" name="trimStart" value="${clip.trimStart}" maxlength="8" style="flex:0 0 60px"><input type="text" name="trimEnd" value="${clip.trimEnd}" maxlength="8" style="flex:0 0 60px"><button class="ghost">trim</button></form>
<form method="post">${hidden("action", "set-caption")}${hidden("id", clip.id)}<input type="text" name="caption" value="${esc(clip.caption)}" maxlength="200" placeholder="Caption…"><button class="ghost">caption</button></form>
<form method="post">${hidden("action", "remove")}${hidden("id", clip.id)}<button class="ghost">remove</button></form>
</div>`;
}

function renderVideo(
  doc: VideoDoc,
  renderLine: string | null,
  renderUrl: string | null,
  notice: string | null,
  isOwner: boolean,
  lite: boolean
): string {
  const clips = doc.clips
    .map((clip, index) => renderClip(clip, index))
    .join("");
  const body = `<section class="panel">
${notice ? `<div class="card">${esc(notice)}</div>` : ""}
${renderUrl ? `<div class="card"><video controls src="${esc(renderUrl)}" style="max-width:100%;border-radius:var(--radius-well)"></video></div>` : ""}
${renderLine && !renderUrl ? `<div class="card pending">${esc(renderLine)}</div>` : ""}
<h2>Storyboard</h2>
${clips || `<div class="card pending">no clips yet — add box asset ids below or ask your agent.</div>`}
<form method="post" class="addrow">${hidden("action", "add-clip")}<input type="text" name="assetId" placeholder="Add a clip (box asset id)…" maxlength="128"><button>Add clip</button></form>
<form method="post" class="addrow">${hidden("action", "set-audio")}<input type="text" name="assetId" value="${esc(doc.audioAssetId ?? "")}" placeholder="Audio track (box asset id, blank to clear)…" maxlength="128"><button class="ghost">Audio</button></form>
<form method="post" class="addrow">${hidden("action", "rename")}<input type="text" name="title" placeholder="Rename document…" maxlength="120"><button>Rename</button></form>
${isOwner ? `<form method="post" class="addrow">${hidden("action", "render")}<button>Render</button></form>` : ""}
${isOwner ? promptBar("Ask your agent — e.g. tighten cut 2, add captions…") : ""}</section>`;
  return renderShell({ title: doc.title, kicker: "Studio", body, lite });
}

function redirectBack(ctx: MiniAppContext, query?: string): NextResponse {
  return withBaseHeaders(
    NextResponse.redirect(
      new URL(`${ctx.basePath}${query ?? ""}`, externalOrigin(ctx.request)),
      303
    )
  );
}

const unavailable = (lite: boolean) =>
  shellHtml(
    renderShell({
      title: "Video",
      kicker: "Studio",
      body: "<section class=\"panel\"><p>Your agent's computer can't start right now — try again in a few minutes.</p></section>",
      lite,
    })
  );

export const video: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    let doc: VideoDoc;
    let renderLine: string | null = null;
    let renderUrl: string | null = null;
    try {
      doc = await getVideoDoc(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId
      );
      if (doc.lastRenderJobId) {
        const view = await refreshVideoRender(
          ctx.supabase,
          ctx.session.userId,
          doc.lastRenderJobId
        );
        renderLine = view.line;
        renderUrl = view.url;
      }
    } catch (error) {
      if (error instanceof StartLimitError)
        return unavailable(ctx.session.via === "card");
      throw error;
    }
    const url = new URL(ctx.request.url);
    let notice = url.searchParams.get("notice");
    if (notice && notice.length > 200) notice = null;
    return mediaShellHtml(
      renderVideo(
        doc,
        renderLine,
        renderUrl,
        notice,
        ctx.session.role === "owner",
        ctx.session.via === "card"
      )
    );
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const action = String(form.get("action") ?? "");
    try {
      return await runAction(ctx, action, form);
    } catch (error) {
      if (error instanceof StartLimitError)
        return unavailable(ctx.session.via === "card");
      throw error;
    }
  },
};

async function runAction(
  ctx: MiniAppContext,
  action: string,
  form: FormData
): Promise<NextResponse> {
  const userId = ctx.session.userId;
  const resourceId = ctx.session.resourceId;
  if (action === "render") {
    const doc = await getVideoDoc(ctx.supabase, userId, resourceId);
    const started = await startVideoRender(ctx.supabase, userId, doc);
    if (started.jobId) {
      await setVideoRenderJob(ctx.supabase, userId, resourceId, started.jobId);
    }
    return redirectBack(ctx, `?notice=${encodeURIComponent(started.line)}`);
  }
  if (action === "prompt") {
    await runPrompt(ctx, String(form.get("text") ?? ""));
    return redirectBack(ctx);
  }
  if (action === "rename") {
    await updateVideoDoc(ctx.supabase, userId, resourceId, {
      kind: "rename",
      title: String(form.get("title") ?? ""),
    });
  } else if (action === "add-clip") {
      await updateVideoDoc(ctx.supabase, userId, resourceId, {
        kind: "add-clip",
        assetId: String(form.get("assetId") ?? ""),
      });
    } else if (action === "set-audio") {
      await updateVideoDoc(ctx.supabase, userId, resourceId, {
        kind: "set-audio",
        assetId: String(form.get("assetId") ?? ""),
      });
    } else if (action === "set-trim") {
      await updateVideoDoc(ctx.supabase, userId, resourceId, {
        kind: "set-trim",
        id: String(form.get("id") ?? ""),
        trimStart: Number(form.get("trimStart") ?? Number.NaN),
        trimEnd: Number(form.get("trimEnd") ?? Number.NaN),
      });
    } else if (action === "set-caption") {
      await updateVideoDoc(ctx.supabase, userId, resourceId, {
        kind: "set-caption",
        id: String(form.get("id") ?? ""),
        caption: String(form.get("caption") ?? ""),
      });
    } else if (action === "move") {
      const direction = String(form.get("direction") ?? "");
      if (direction === "up" || direction === "down") {
        await updateVideoDoc(ctx.supabase, userId, resourceId, {
          kind: "move",
          id: String(form.get("id") ?? ""),
          direction,
        });
      }
    } else if (action === "remove") {
      await updateVideoDoc(ctx.supabase, userId, resourceId, {
        kind: "remove",
        id: String(form.get("id") ?? ""),
      });
    }
    return redirectBack(ctx);
}
