/** Image editor mini-app renderer (V9 MA7 #8). Layered documents live in the
 * user's box; generation/edit ops go through the agent prompt bar (MA10) and
 * the existing creative lane, so every render is metered. */
import { NextResponse } from "next/server";
import { ASSETS_BUCKET, DELIVERY_TTL_SECONDS } from "@/lib/assets/keys";
import { mintDelivery, type CreativeAsset } from "@/lib/assets/pipeline";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { externalOrigin } from "../gates";
import { esc, html, page, withBaseHeaders } from "../html";
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

/** BASE CSP is default-src 'none'; previews need https images only. */
const MEDIA_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src https:; form-action 'self'; frame-ancestors 'self'";

const BLEND_OPTIONS = ["normal", "multiply", "screen", "overlay"] as const;

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`;
}

function renderLayer(layer: ImageLayer, index: number, count: number): string {
  const label =
    layer.kind === "text"
      ? `text — ${esc(layer.text ?? "")}`
      : `asset — ${esc(layer.assetId ?? "")}`;
  const blend = BLEND_OPTIONS.map(
    (mode) =>
      `<option value="${mode}"${mode === layer.blend ? " selected" : ""}>${mode}</option>`
  ).join("");
  return `<div class="card">
<strong>${count - index}.</strong> ${label}${layer.visible ? "" : ' <span class="when">(hidden)</span>'}
<form method="post">${hidden("action", "move")}${hidden("id", layer.id)}<button name="direction" value="up" class="ghost">↑</button><button name="direction" value="down" class="ghost">↓</button></form>
<form method="post">${hidden("action", "toggle-visible")}${hidden("id", layer.id)}<button class="ghost">${layer.visible ? "hide" : "show"}</button></form>
<form method="post">${hidden("action", "set-opacity")}${hidden("id", layer.id)}<input type="text" name="opacity" value="${layer.opacity}" maxlength="3" style="flex:0 0 52px"><button class="ghost">opacity</button></form>
<form method="post">${hidden("action", "set-blend")}${hidden("id", layer.id)}<select name="blend">${blend}</select><button class="ghost">blend</button></form>
${
  layer.kind === "text"
    ? `<form method="post">${hidden("action", "set-text")}${hidden("id", layer.id)}<input type="text" name="text" value="${esc(layer.text ?? "")}" maxlength="500"><button class="ghost">text</button></form>`
    : ""
}
<form method="post">${hidden("action", "remove")}${hidden("id", layer.id)}<button class="ghost">remove</button></form>
</div>`;
}

function renderImage(
  doc: ImageDoc,
  flatUrl: string | null,
  exportUrl: string | null,
  notice: string | null,
  isOwner: boolean
): string {
  const layers = doc.layers
    .map((layer, index) => renderLayer(layer, index, doc.layers.length))
    .reverse()
    .join("");
  return page(
    doc.title,
    `<h1>${esc(doc.title)}</h1>
${notice ? `<div class="card">${esc(notice)}</div>` : ""}
${flatUrl ? `<div class="card"><img src="${esc(flatUrl)}" alt="rendered flat" style="max-width:100%;border-radius:8px"></div>` : `<div class="card pending">no rendered flat yet — ask your agent to render one.</div>`}
${exportUrl ? `<div class="card">private link (expires in ${Math.round(DELIVERY_TTL_SECONDS / 60)} min): <a href="${esc(exportUrl)}">${esc(exportUrl.slice(0, 80))}…</a></div>` : ""}
<h1 style="margin-top:16px">Layers</h1>
${layers || `<div class="card pending">no layers yet.</div>`}
<form method="post" class="addrow">${hidden("action", "add-text")}<input type="text" name="text" placeholder="Add a text layer…" maxlength="500"><button>Add text</button></form>
<form method="post" class="addrow">${hidden("action", "add-asset")}<input type="text" name="assetId" placeholder="Add an asset layer (box asset id)…" maxlength="128"><button>Add asset</button></form>
<form method="post" class="addrow">${hidden("action", "rename")}<input type="text" name="title" placeholder="Rename document…" maxlength="120"><button>Rename</button></form>
${
  doc.flatAssetId && isOwner
    ? `<form method="post" class="addrow">${hidden("action", "export")}<button>Private link</button></form>
<form method="post" class="addrow">${hidden("action", "export-public")}<button class="ghost">Public link</button></form>`
    : ""
}
${isOwner ? promptBar("Ask your agent — e.g. remove the background on layer 2…") : ""}`
  );
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

const unavailable = () =>
  html(
    page(
      "Image",
      "<h1>Image</h1><p>Your agent's computer can't start right now — try again in a few minutes.</p>"
    )
  );

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
      if (error instanceof StartLimitError) return unavailable();
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
    return html(
      renderImage(doc, flatUrl, exportUrl, notice, ctx.session.role === "owner"),
      { "Content-Security-Policy": MEDIA_CSP }
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
      if (error instanceof StartLimitError) return unavailable();
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
