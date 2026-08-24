/** Image studio mini-app renderer (V9 MA7 #8, Toolcraft-style rework).
 * Layout follows the Toolcraft editor pattern: a large canvas stage with the
 * rendered flat, and a right-hand settings rail of collapsible panels
 * (Generate, Edit, Layers, Export). Generation and edits run through the
 * existing metered creative lane (creative_jobs + GMI): "Generate" is a
 * text-to-image `imagine` job; "Edit" is an `imagine` job with the current
 * flat attached as the image input. Layered documents live in the user's
 * box; every render is metered. */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ASSETS_BUCKET,
  DELIVERY_TTL_SECONDS,
  masterKey,
} from "@/lib/assets/keys";
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
  BLEND_MODES,
  getImageDoc,
  isBlendMode,
  updateImageDoc,
  type ImageDoc,
  type ImageLayer,
  type LayerTransform,
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

/** The editor page runs the same-origin bundle: widen only by what that
 * first-party code needs — script-src 'self' to load it, connect-src 'self'
 * for its action fetches, img-src https: for signed asset previews. */
function editorShellHtml(body: string): NextResponse {
  const response = mediaShellHtml(body);
  let csp = response.headers.get("Content-Security-Policy") ?? "";
  if (!csp.includes("script-src")) csp += "; script-src 'self'";
  if (!csp.includes("connect-src")) csp += "; connect-src 'self'";
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/** What the client editor renders from: the doc plus signed preview URLs.
 * Only control-plane asset rows the user owns are signed — an assetId the
 * doc invented (C9) simply gets no URL. */
interface EditorPayload {
  doc: ImageDoc;
  flatUrl: string | null;
  assetUrls: Record<string, string>;
  notice?: string;
  exportUrl?: string;
}

async function editorPayload(
  ctx: MiniAppContext,
  doc: ImageDoc
): Promise<EditorPayload> {
  const flatUrl = await signedFlatUrl(ctx, await flatAsset(ctx, doc));
  const ids = [
    ...new Set(
      doc.layers
        .filter((layer) => layer.kind === "asset" && layer.assetId)
        .map((layer) => layer.assetId as string)
    ),
  ];
  const assetUrls: Record<string, string> = {};
  if (ids.length) {
    const { data } = await ctx.supabase
      .from("creative_assets")
      .select("id, storage_key")
      .eq("user_id", ctx.session.userId)
      .in("id", ids);
    for (const row of (data ?? []) as { id: string; storage_key: string }[]) {
      const signed = await ctx.supabase.storage
        .from(ASSETS_BUCKET)
        .createSignedUrl(row.storage_key, DELIVERY_TTL_SECONDS);
      if (signed.data?.signedUrl) assetUrls[row.id] = signed.data.signedUrl;
    }
  }
  return { doc, flatUrl, assetUrls };
}

/** The owner's editor page: a mount node carrying the initial payload and
 * the same-origin bundle. Everything visual lives in the bundle. */
function renderEditor(payload: EditorPayload): string {
  const body = `<div id="image-editor" data-payload="${esc(JSON.stringify(payload))}"></div>
<script src="/creator-os/image-editor.js" defer></script>
<noscript><p class="muted">This editor needs JavaScript — <a href="?classic=1">use the classic view</a>.</p></noscript>`;
  return renderShell({
    title: payload.doc.title,
    kicker: "Studio",
    body,
    headline: false,
  });
}

/** Tree rows in display order (top of stack first), with panel depth. */
interface LayerRow {
  layer: ImageLayer;
  depth: number;
}

function layerRows(doc: ImageDoc): LayerRow[] {
  const byId = new Map(doc.layers.map((layer) => [layer.id, layer]));
  const ancestors = (layer: ImageLayer): ImageLayer[] => {
    const chain: ImageLayer[] = [];
    let cursor = layer.parentGroupId;
    while (cursor) {
      const parent = byId.get(cursor);
      if (!parent || chain.includes(parent)) break;
      chain.push(parent);
      cursor = parent.parentGroupId;
    }
    return chain;
  };
  return doc.layers
    .map((layer) => ({ layer, chain: ancestors(layer) }))
    // A collapsed group hides its subtree in the panel only — it still
    // composites (image.goal.md §4.1).
    .filter(({ chain }) => !chain.some((parent) => parent.collapsed === true))
    .map(({ layer, chain }) => ({ layer, depth: chain.length }))
    .reverse();
}

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

function derivedLabel(layer: ImageLayer): string {
  if (layer.name) return esc(layer.name);
  if (layer.kind === "group") return "\u25a2 group";
  if (layer.kind === "text") return `T \u00b7 ${esc(layer.text ?? "")}`;
  return `\u25a3 \u00b7 ${esc(layer.assetId ?? "")}`;
}

function renderLayer(row: LayerRow, groups: ImageLayer[]): string {
  const { layer, depth } = row;
  const blend = BLEND_MODES.map(
    (mode) =>
      `<option value="${mode}"${mode === layer.blend ? " selected" : ""}>${mode}</option>`
  ).join("");
  const parentOptions = [
    `<option value=""${layer.parentGroupId === null ? " selected" : ""}>\u2014 root \u2014</option>`,
    ...groups
      .filter((group) => group.id !== layer.id)
      .map(
        (group) =>
          `<option value="${esc(group.id)}"${group.id === layer.parentGroupId ? " selected" : ""}>${derivedLabel(group)}</option>`
      ),
  ].join("");
  const groupControls =
    layer.kind === "group"
      ? `<form method="post">${hidden("action", "toggle-collapsed")}${hidden("id", layer.id)}<button class="ghost">${layer.collapsed ? "expand" : "collapse"}</button></form>`
      : "";
  return `<div class="card" style="display:flex;flex-direction:column;gap:0.4rem;margin-left:${depth * 0.9}rem">
<div style="display:flex;align-items:center;gap:0.4rem"><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${derivedLabel(layer)}</span>${layer.visible ? "" : '<span class="when">(hidden)</span>'}</div>
<div style="display:flex;flex-wrap:wrap;gap:0.3rem">
<form method="post">${hidden("action", "move")}${hidden("id", layer.id)}<button name="direction" value="up" class="ghost">\u2191</button><button name="direction" value="down" class="ghost">\u2193</button></form>
<form method="post">${hidden("action", "toggle-visible")}${hidden("id", layer.id)}<button class="ghost">${layer.visible ? "hide" : "show"}</button></form>
${groupControls}<form method="post">${hidden("action", "remove")}${hidden("id", layer.id)}<button class="ghost">remove</button></form>
</div>
<form method="post" style="display:flex;gap:0.3rem">${hidden("action", "rename-layer")}${hidden("id", layer.id)}<input type="text" name="name" value="${esc(layer.name ?? "")}" placeholder="layer name\u2026" maxlength="120" style="flex:1"><button class="ghost">name</button></form>
<form method="post" style="display:flex;gap:0.3rem">${hidden("action", "set-parent")}${hidden("id", layer.id)}<select name="parentGroupId" style="flex:1">${parentOptions}</select><button class="ghost">group</button></form>
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
  const groups = doc.layers.filter((layer) => layer.kind === "group");
  const layers = layerRows(doc)
    .map((row) => renderLayer(row, groups))
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

  const historyRow = `<div style="display:flex;gap:0.3rem">
<form method="post">${hidden("action", "undo")}<button class="ghost"${doc.history.undo.length ? "" : " disabled"}>\u21b6 undo</button></form>
<form method="post">${hidden("action", "redo")}<button class="ghost"${doc.history.redo.length ? "" : " disabled"}>\u21b7 redo</button></form>
</div>`;

  const layersPanel = panel(
    "Layers",
    `${historyRow}
${layers || '<div class="card pending">no layers yet.</div>'}
<form method="post" class="addrow">${hidden("action", "add-text")}<input type="text" name="text" placeholder="Add a text layer\u2026" maxlength="500"><button>Add text</button></form>
<form method="post" class="addrow">${hidden("action", "add-asset")}<input type="text" name="assetId" placeholder="Add an asset layer (box asset id)\u2026" maxlength="128"><button>Add asset</button></form>
<form method="post" class="addrow">${hidden("action", "add-group")}<input type="text" name="name" placeholder="Add a group\u2026" maxlength="120"><button>Add group</button></form>`
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

/** Decoded PNG cap for a submitted drawing — a 1024² sketch is well under. */
const MAX_SKETCH_BYTES = 4 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/**
 * Take the editor's drawing (a PNG data URL composed client-side from the
 * canvas plus the layer's strokes), verify it really is a bounded PNG, and
 * store it as a content-addressed creative asset the render lane can sign a
 * URL for. The browser never talks to the provider (C2/C3) — the drawing
 * becomes a normal owned asset first, exactly like an ingested render.
 */
async function storeSketchAsset(
  ctx: MiniAppContext,
  dataUrl: string
): Promise<CreativeAsset | null> {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) return null;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(dataUrl.slice(prefix.length), "base64");
  } catch {
    return null;
  }
  if (
    !buffer.byteLength ||
    buffer.byteLength > MAX_SKETCH_BYTES ||
    !buffer.subarray(0, 4).equals(PNG_MAGIC)
  ) {
    return null;
  }
  const digest = createHash("sha256").update(buffer).digest("hex");
  const existing = await ctx.supabase
    .from("creative_assets")
    .select("*")
    .eq("user_id", ctx.session.userId)
    .eq("sha256", digest)
    .maybeSingle();
  if (existing.data) return existing.data as CreativeAsset;
  const key = masterKey(ctx.session.userId, digest, "png");
  const upload = await ctx.supabase.storage
    .from(ASSETS_BUCKET)
    .upload(key, buffer, { contentType: "image/png", upsert: true });
  if (upload.error) return null;
  const inserted = await ctx.supabase
    .from("creative_assets")
    .insert({
      user_id: ctx.session.userId,
      box_asset_id: `sketch:${digest.slice(0, 16)}`,
      sha256: digest,
      ext: "png",
      kind: "png",
      bytes: buffer.byteLength,
      storage_key: key,
    })
    .select("*")
    .single();
  return (inserted.data as CreativeAsset | null) ?? null;
}

/** Run one metered GMI render for this doc: text-to-image ("generate"),
 * an edit of the current flat ("edit"), or an edit guided by the owner's
 * drawing ("draw"). On delivery the doc's flat is repointed at the new
 * asset. Returns the user-facing notice line. */
async function runStudioRender(
  ctx: MiniAppContext,
  kind: "generate" | "edit" | "draw",
  prompt: string,
  sketchAsset?: CreativeAsset
): Promise<string> {
  const userId = ctx.session.userId;
  const text = prompt.trim().slice(0, 1000);
  if (!text) return "describe what to make first.";
  const mediaInputs: MediaInput[] = [];
  if (kind === "draw") {
    const url = await signedFlatUrl(ctx, sketchAsset ?? null);
    if (!url) return "that drawing couldn't be read — try again.";
    mediaInputs.push({ kind: "image", url });
  } else if (kind === "edit") {
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
    // The render is already delivered and charged; a doc-write failure must
    // not discard it. The asset stays retrievable, so surface a notice and
    // let a later save repoint the canvas.
    try {
      await updateImageDoc(ctx.supabase, userId, ctx.session.resourceId, {
        kind: "set-flat",
        assetId: result.asset.id,
      });
    } catch {
      return `render done (asset ${result.asset.id}) but saving to the canvas failed — try again in a minute or add it as an asset layer.`;
    }
    if (kind === "draw") return "drawing rendered.";
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
    const requestUrl = new URL(ctx.request.url);
    // Owners get the client editor; card-opened (lite) sessions and guests
    // keep the server-rendered classic view, as does ?classic=1.
    if (
      ctx.session.role === "owner" &&
      ctx.session.via !== "card" &&
      requestUrl.searchParams.get("classic") !== "1"
    ) {
      return editorShellHtml(renderEditor(await editorPayload(ctx, doc)));
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
    // The client editor posts the same action grammar with format=json and
    // gets the authoritative doc back instead of a redirect.
    const wantsJson = String(form.get("format") ?? "") === "json";
    const respond = async (notice?: string): Promise<NextResponse> => {
      if (!wantsJson) {
        return redirectBack(
          ctx,
          notice ? `?notice=${encodeURIComponent(notice)}` : undefined
        );
      }
      const doc = await getImageDoc(ctx.supabase, userId, resourceId);
      const payload = await editorPayload(ctx, doc);
      if (notice) payload.notice = notice;
      return withBaseHeaders(NextResponse.json(payload));
    };
    if (action === "export") {
      if (!wantsJson) return redirectBack(ctx, "?exported=1");
      if (ctx.session.role !== "owner") return respond("export is owner-only.");
      const doc = await getImageDoc(ctx.supabase, userId, resourceId);
      const asset = await flatAsset(ctx, doc);
      const payload = await editorPayload(ctx, doc);
      if (asset) {
        const url = await exportDelivery(ctx, asset);
        if (url) payload.exportUrl = url;
      } else {
        payload.notice = "render a flat before exporting.";
      }
      return withBaseHeaders(NextResponse.json(payload));
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
        return respond(line);
      }
      if (action === "draw" && ctx.session.role === "owner") {
        const sketch = await storeSketchAsset(
          ctx,
          String(form.get("sketch") ?? "")
        );
        if (!sketch) {
          return respond("that drawing couldn't be read — try again.");
        }
        const line = await runStudioRender(
          ctx,
          "draw",
          String(form.get("prompt") ?? ""),
          sketch
        );
        return respond(line);
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
        return respond(result.line);
      }
      if (action === "prompt") {
        await runPrompt(ctx, String(form.get("text") ?? ""));
        return respond();
      }
      return await mutate(ctx, action, form, respond);
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
  form: FormData,
  respond: (notice?: string) => Promise<NextResponse>
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
    } else if (action === "add-group") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "add-group",
        name: String(form.get("name") ?? ""),
      });
    } else if (action === "rename-layer") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "rename-layer",
        id: String(form.get("id") ?? ""),
        name: String(form.get("name") ?? ""),
      });
    } else if (action === "toggle-collapsed") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "toggle-collapsed",
        id: String(form.get("id") ?? ""),
      });
    } else if (action === "set-parent") {
      const parent = String(form.get("parentGroupId") ?? "").trim();
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: "set-parent",
        id: String(form.get("id") ?? ""),
        parentGroupId: parent || null,
      });
    } else if (action === "undo" || action === "redo") {
      await updateImageDoc(ctx.supabase, userId, resourceId, {
        kind: action === "undo" ? "undo" : "redo",
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
  } else if (action === "select") {
    const id = String(form.get("id") ?? "").trim();
    await updateImageDoc(ctx.supabase, userId, resourceId, {
      kind: "select",
      id: id || null,
    });
  } else if (action === "reorder") {
    await updateImageDoc(ctx.supabase, userId, resourceId, {
      kind: "reorder",
      id: String(form.get("id") ?? ""),
      index: Number(form.get("index") ?? Number.NaN),
    });
  } else if (action === "set-transform") {
    const num = (name: string): number | undefined => {
      const raw = form.get(name);
      if (raw === null || String(raw).trim() === "") return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };
    const transform: Partial<LayerTransform> = {};
    const x = num("x");
    const y = num("y");
    const scale = num("scale");
    const rotation = num("rotation");
    if (x !== undefined) transform.x = x;
    if (y !== undefined) transform.y = y;
    if (scale !== undefined) transform.scale = scale;
    if (rotation !== undefined) transform.rotation = rotation;
    await updateImageDoc(ctx.supabase, userId, resourceId, {
      kind: "set-transform",
      id: String(form.get("id") ?? ""),
      transform,
    });
  }
  return respond();
}
