/** Image studio mini-app renderer (V9 MA7 #8, Toolcraft-style rework).
 * Layout follows the Toolcraft editor pattern: a large canvas stage with the
 * rendered flat, and a right-hand settings rail of collapsible panels
 * (Generate, Edit, Layers, Export). Generation and edits run through the
 * existing metered creative lane (creative_jobs + GMI): "Generate" is a
 * text-to-image `imagine` job; "Edit" is an `imagine` job with the current
 * flat attached as the image input. Layered documents live in the user's
 * box; every render is metered. */
import { NextResponse } from "next/server";
import { ASSETS_BUCKET, DELIVERY_TTL_SECONDS } from "@/lib/assets/keys";
import { mintDelivery, type CreativeAsset } from "@/lib/assets/pipeline";
import { createCreativeJob } from "@/lib/creative/jobs";
import { executeCreativeJob } from "@/lib/creative/run";
import type { CreativeCommandTurn } from "@/lib/creative/router";
import type { MediaInput } from "@/lib/creative/gmi";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { externalOrigin } from "../gates";
import { esc, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import {
  getImageDoc,
  isBlendMode,
  updateImageDoc,
  type ImageDoc,
  type ImageLayer,
} from "../creativeDocs";
import { promptBar, runPrompt } from "../promptBar";
import { publicExporter } from "../publicExport";
import type { MiniAppContext, MiniAppModule } from "./types";

/** The shell's theme CSP, with img-src widened for https flat previews. */
function mediaShellHtml(body: string): NextResponse {
  const response = shellHtml(body);
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  response.headers.set(
    "Content-Security-Policy",
    csp.replace("img-src 'self'", "img-src 'self' https:")
  );
  return response;
}

const BLEND_OPTIONS = ["normal", "multiply", "screen", "overlay"] as const;

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`;
}

/** One collapsible settings-rail section (Toolcraft panel style). */
function panel(title: string, body: string, open = false): string {
  return `<details${open ? " open" : ""} style="border-top:1px solid rgba(255,255,255,0.08);padding:0.55rem 0">
<summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.75">${esc(title)}<span aria-hidden="true">\u2303</span></summary>
<div style="display:flex;flex-direction:column;gap:0.55rem;margin-top:0.6rem">${body}</div>
</details>`;
}

/** Labelled slider row, Toolcraft-style: name left, value right. */
function slider(
  form: { action: string; id: string },
  name: string,
  label: string,
  value: number,
  min: number,
  max: number
): string {
  return `<form method="post" style="display:flex;flex-direction:column;gap:0.2rem">${hidden("action", form.action)}${hidden("id", form.id)}
<label class="when" style="display:flex;justify-content:space-between">${esc(label)}<span>${value}</span></label>
<div style="display:flex;gap:0.4rem;align-items:center"><input type="range" name="${esc(name)}" value="${value}" min="${min}" max="${max}" style="flex:1"><button class="ghost" style="flex:none">set</button></div>
</form>`;
}

function renderLayer(layer: ImageLayer, index: number, count: number): string {
  const label =
    layer.kind === "text"
      ? `T \u00b7 ${esc(layer.text ?? "")}`
      : `\u25a3 \u00b7 ${esc(layer.assetId ?? "")}`;
  const blend = BLEND_OPTIONS.map(
    (mode) =>
      `<option value="${mode}"${mode === layer.blend ? " selected" : ""}>${mode}</option>`
  ).join("");
  return `<div class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<div style="display:flex;align-items:center;gap:0.4rem"><strong>${count - index}.</strong><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>${layer.visible ? "" : '<span class="when">(hidden)</span>'}</div>
<div style="display:flex;flex-wrap:wrap;gap:0.3rem">
<form method="post">${hidden("action", "move")}${hidden("id", layer.id)}<button name="direction" value="up" class="ghost">\u2191</button><button name="direction" value="down" class="ghost">\u2193</button></form>
<form method="post">${hidden("action", "toggle-visible")}${hidden("id", layer.id)}<button class="ghost">${layer.visible ? "hide" : "show"}</button></form>
<form method="post">${hidden("action", "remove")}${hidden("id", layer.id)}<button class="ghost">remove</button></form>
</div>
${slider({ action: "set-opacity", id: layer.id }, "opacity", "Opacity", layer.opacity, 0, 100)}
<form method="post" style="display:flex;gap:0.3rem">${hidden("action", "set-blend")}${hidden("id", layer.id)}<select name="blend" style="flex:1">${blend}</select><button class="ghost">blend</button></form>
${
  layer.kind === "text"
    ? `<form method="post" style="display:flex;gap:0.3rem">${hidden("action", "set-text")}${hidden("id", layer.id)}<input type="text" name="text" value="${esc(layer.text ?? "")}" maxlength="500" style="flex:1"><button class="ghost">text</button></form>`
    : ""
}
</div>`;
}

function renderImage(
  doc: ImageDoc,
  flatUrl: string | null,
  exportUrl: string | null,
  notice: string | null,
  isOwner: boolean,
  lite: boolean
): string {
  const layers = doc.layers
    .map((layer, index) => renderLayer(layer, index, doc.layers.length))
    .reverse()
    .join("");

  const stage = flatUrl
    ? `<img src="${esc(flatUrl)}" alt="canvas" style="max-width:100%;max-height:70vh;border-radius:var(--radius-well);display:block;margin:0 auto">`
    : `<div class="card pending" style="text-align:center;padding:2.5rem 1rem">No image yet \u2014 describe one below and tap Generate.</div>`;

  const generatePanel = isOwner
    ? panel(
        "Generate",
        `<form method="post" style="display:flex;flex-direction:column;gap:0.5rem">${hidden("action", "generate")}
<textarea name="prompt" rows="3" maxlength="1000" placeholder="Describe the image to create\u2026" required style="resize:vertical"></textarea>
<button>Generate</button></form>
<p class="when">Runs a metered render \u2014 it can take up to a minute.</p>`,
        !doc.flatAssetId
      )
    : "";

  const editPanel =
    isOwner && doc.flatAssetId
      ? panel(
          "Edit",
          `<form method="post" style="display:flex;flex-direction:column;gap:0.5rem">${hidden("action", "edit")}
<textarea name="prompt" rows="3" maxlength="1000" placeholder="Describe the change \u2014 e.g. remove the background\u2026" required style="resize:vertical"></textarea>
<button>Apply edit</button></form>
<p class="when">Edits the current canvas image with a metered render.</p>`,
          true
        )
      : "";

  const layersPanel = panel(
    "Layers",
    `${layers || '<div class="card pending">no layers yet.</div>'}
<form method="post" class="addrow">${hidden("action", "add-text")}<input type="text" name="text" placeholder="Add a text layer\u2026" maxlength="500"><button>Add text</button></form>
<form method="post" class="addrow">${hidden("action", "add-asset")}<input type="text" name="assetId" placeholder="Add an asset layer (box asset id)\u2026" maxlength="128"><button>Add asset</button></form>`
  );

  const exportPanel =
    doc.flatAssetId && isOwner
      ? panel(
          "Export",
          `<form method="post">${hidden("action", "export")}<button style="width:100%">\u2913 Export PNG (private link)</button></form>
<form method="post">${hidden("action", "export-public")}<button class="ghost" style="width:100%">Public link</button></form>
${exportUrl ? `<div class="card">private link (expires in ${Math.round(DELIVERY_TTL_SECONDS / 60)} min): <a href="${esc(exportUrl)}">${esc(exportUrl.slice(0, 80))}\u2026</a></div>` : ""}`,
          exportUrl !== null
        )
      : "";

  const documentPanel = panel(
    "Document",
    `<form method="post" class="addrow">${hidden("action", "rename")}<input type="text" name="title" placeholder="Rename document\u2026" maxlength="120"><button>Rename</button></form>`
  );

  const body = `<section class="panel">
${notice ? `<div class="card">${esc(notice)}</div>` : ""}
<div style="display:flex;flex-direction:column;gap:0.9rem">
<div style="background:rgba(0,0,0,0.35);border-radius:var(--radius-well);padding:0.6rem">${stage}</div>
<div>${generatePanel}${editPanel}${layersPanel}${exportPanel}${documentPanel}</div>
</div>
${isOwner ? promptBar("Ask your agent \u2014 e.g. remove the background on layer 2\u2026") : ""}</section>`;
  return renderShell({ title: doc.title, kicker: "Studio", body, lite });
}

async function flatAsset(
  ctx: MiniAppContext,
  doc: ImageDoc
): Promise<CreativeAsset | null> {
  if (!doc.flatAssetId) return null;
  const { data } = await ctx.supabase
    .from("creative_assets")
    .select("*")
    .eq("id", doc.flatAssetId)
    .eq("user_id", ctx.session.userId)
    .maybeSingle();
  return (data as CreativeAsset | null) ?? null;
}

async function signedFlatUrl(
  ctx: MiniAppContext,
  asset: CreativeAsset | null
): Promise<string | null> {
  if (!asset) return null;
  const signed = await ctx.supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(asset.storage_key, DELIVERY_TTL_SECONDS);
  return signed.data?.signedUrl ?? null;
}

/**
 * Private-link export: reuse an unexpired delivery for this doc's purpose
 * (re-signing the same copy) so reloads of ?exported=1 don't mint duplicate
 * storage copies; mint only when none exists.
 */
async function exportDelivery(
  ctx: MiniAppContext,
  asset: CreativeAsset
): Promise<string | null> {
  const purpose = `miniapp-image:${ctx.session.resourceId}`;
  const { data } = await ctx.supabase
    .from("asset_deliveries")
    .select("storage_key, expires_at")
    .eq("user_id", ctx.session.userId)
    .eq("asset_id", asset.id)
    .eq("purpose", purpose)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const storageKey = data?.storage_key as string | undefined;
  const expiresAt = data?.expires_at as string | undefined;
  if (storageKey && expiresAt) {
    // Sign only for the copy's remaining life — the sweeper deletes the
    // object at expires_at, so a longer signature would outlive the bytes.
    const remaining = Math.floor(
      (new Date(expiresAt).getTime() - Date.now()) / 1000
    );
    if (remaining >= 60) {
      const signed = await ctx.supabase.storage
        .from(ASSETS_BUCKET)
        .createSignedUrl(storageKey, remaining);
      if (signed.data?.signedUrl) return signed.data.signedUrl;
    }
  }
  const minted = await mintDelivery(ctx.supabase, asset, purpose);
  return minted.url;
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
      title: "Image",
      kicker: "Studio",
      body: "<section class=\"panel\"><p>Your agent's computer can't start right now — try again in a few minutes.</p></section>",
      lite,
    })
  );

/** Run one metered GMI render for this doc: text-to-image ("generate") or
 * an edit of the current flat ("edit"). On delivery the doc's flat is
 * repointed at the new asset. Returns the user-facing notice line. */
async function runStudioRender(
  ctx: MiniAppContext,
  kind: "generate" | "edit",
  prompt: string
): Promise<string> {
  const userId = ctx.session.userId;
  const text = prompt.trim().slice(0, 1000);
  if (!text) return "describe what to make first.";
  const mediaInputs: MediaInput[] = [];
  if (kind === "edit") {
    const doc = await getImageDoc(ctx.supabase, userId, ctx.session.resourceId);
    const asset = await flatAsset(ctx, doc);
    const url = await signedFlatUrl(ctx, asset);
    if (!url) return "render an image before editing it.";
    mediaInputs.push({ kind: "image", url });
  }
  const job = await createCreativeJob(ctx.supabase, userId, "web", "imagine");
  const turn: CreativeCommandTurn = {
    mode: "imagine",
    cleanedText: text,
    text,
    mediaInputs,
  };
  const result = await executeCreativeJob(ctx.supabase, job.id, userId, turn);
  if (result.status === "delivered" && result.asset) {
    await updateImageDoc(ctx.supabase, userId, ctx.session.resourceId, {
      kind: "set-flat",
      assetId: result.asset.id,
    });
    return kind === "edit" ? "edit applied." : "image ready.";
  }
  return result.line;
}

export const image: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    let doc: ImageDoc;
    try {
      doc = await getImageDoc(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId
      );
    } catch (error) {
      if (error instanceof StartLimitError)
        return unavailable(ctx.session.via === "card");
      throw error;
    }
    const asset = await flatAsset(ctx, doc);
    const flatUrl = await signedFlatUrl(ctx, asset);
    const url = new URL(ctx.request.url);
    const wantExport = url.searchParams.get("exported") === "1";
    let exportUrl: string | null = null;
    let notice: string | null = url.searchParams.get("notice");
    if (wantExport && asset && ctx.session.role === "owner") {
      exportUrl = await exportDelivery(ctx, asset);
    }
    if (notice && notice.length > 200) notice = null;
    return mediaShellHtml(
      renderImage(
        doc,
        flatUrl,
        exportUrl,
        notice,
        ctx.session.role === "owner",
        ctx.session.via === "card"
      )
    );
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const action = String(form.get("action") ?? "");
    const userId = ctx.session.userId;
    const resourceId = ctx.session.resourceId;
    if (action === "export") {
      return redirectBack(ctx, "?exported=1");
    }
    try {
      if (
        (action === "generate" || action === "edit") &&
        ctx.session.role === "owner"
      ) {
        const line = await runStudioRender(
          ctx,
          action,
          String(form.get("prompt") ?? "")
        );
        return redirectBack(ctx, `?notice=${encodeURIComponent(line)}`);
      }
      if (action === "export-public") {
        const doc = await getImageDoc(ctx.supabase, userId, resourceId);
        const result = doc.flatAssetId
          ? await publicExporter.publishAsset(
              ctx.supabase,
              userId,
              doc.flatAssetId
            )
          : { line: "render a flat before exporting." };
        return redirectBack(ctx, `?notice=${encodeURIComponent(result.line)}`);
      }
      if (action === "prompt") {
        await runPrompt(ctx, String(form.get("text") ?? ""));
        return redirectBack(ctx);
      }
      return await mutate(ctx, action, form);
    } catch (error) {
      if (error instanceof StartLimitError)
        return unavailable(ctx.session.via === "card");
      throw error;
    }
  },
};

async function mutate(
  ctx: MiniAppContext,
  action: string,
  form: FormData
): Promise<NextResponse> {
  const userId = ctx.session.userId;
  const resourceId = ctx.session.resourceId;
  if (action === "rename") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "rename",
        title: String(form.get("title") ?? ""),
      });
    } else if (action === "add-text") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "add-text",
        text: String(form.get("text") ?? ""),
      });
    } else if (action === "add-asset") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "add-asset",
        assetId: String(form.get("assetId") ?? ""),
      });
    } else if (action === "set-text") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "set-text",
        id: String(form.get("id") ?? ""),
        text: String(form.get("text") ?? ""),
      });
    } else if (action === "set-opacity") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "set-opacity",
        id: String(form.get("id") ?? ""),
        opacity: Number(form.get("opacity") ?? Number.NaN),
      });
    } else if (action === "set-blend") {
      const blend = String(form.get("blend") ?? "");
      if (isBlendMode(blend)) {
        await updateImageDoc(ctx.supabase, userId, resourceId, {
          kind: "set-blend",
          id: String(form.get("id") ?? ""),
          blend,
        });
      }
    } else if (action === "toggle-visible") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "toggle-visible",
        id: String(form.get("id") ?? ""),
      });
    } else if (action === "move") {
      const direction = String(form.get("direction") ?? "");
      if (direction === "up" || direction === "down") {
        // The layer list renders top-of-stack first (reversed array), so the
        // visual "up" is a move toward the end of the stored array.
        await updateImageDoc(ctx.supabase, userId, resourceId, {
          kind: "move",
          id: String(form.get("id") ?? ""),
          direction: direction === "up" ? "down" : "up",
        });
      }
    } else if (action === "remove") {
    await updateImageDoc(ctx.supabase, userId, resourceId, {
      kind: "remove",
      id: String(form.get("id") ?? ""),
    });
  }
  return redirectBack(ctx);
}
