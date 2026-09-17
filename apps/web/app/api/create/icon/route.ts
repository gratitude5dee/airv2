/**
 * V12 §9.2 `POST /api/create/icon` — the owner (store session) or the
 * owner's Box (gateway bearer) sets an app icon one of three ways:
 *   multipart  field `icon` (png/jpeg/webp) + `app` | `appname` | `slug`
 *   JSON       { appname, path }        a file inside the Box workspace
 *   JSON       { appname, generate: true, theme? }   one metered render
 * Every source runs the same guard → resize → R2 → `icon_key` pipeline.
 * The third generation is refused with 429 `upload_instead`; a Box-driven
 * generation also sends the preview back to the owner's thread.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import { ownedApp, PublishError } from "@/lib/miniapps/publish";
import { MediaGuardError } from "@/lib/storage/guard";
import { r2Configured } from "@/lib/storage/r2";
import { recordOpsEvent, uploadRateLimited } from "@/lib/security/limits";
import { BoxApiError } from "@/lib/box/client";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { createSpectrumSender } from "@/lib/spectrum/sender";
import { resolveOwnedSlug } from "@/lib/create/finalize";
import {
  countIconGenerations,
  generateIcon,
  generationAllowed,
  ICON_TYPES,
  IconError,
  readBoxIcon,
  sendIconPreview,
  storeIcon,
} from "@/lib/create/icon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const THEMES = new Set(["atmosphere", "pixel"]);

interface IconBody {
  app?: unknown;
  appname?: unknown;
  slug?: unknown;
  path?: unknown;
  generate?: unknown;
  theme?: unknown;
}

function appField(body: IconBody | null, form: FormData | null): string {
  const fromForm = form?.get("app") ?? form?.get("appname") ?? form?.get("slug");
  if (typeof fromForm === "string") return fromForm;
  for (const key of ["slug", "app", "appname"] as const) {
    const value = body?.[key];
    if (typeof value === "string") return value;
  }
  return "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const sessionUser = storeSessionUserId(request);
  const userId = sessionUser ?? (await boxUserId(supabase, request));
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "media storage unavailable" }, { status: 503 });
  }
  const multipart = (request.headers.get("content-type") ?? "").toLowerCase().includes("multipart/form-data");
  const form = multipart ? await request.formData().catch(() => null) : null;
  const body = multipart ? null : ((await request.json().catch(() => null)) as IconBody | null);
  if (multipart ? !form : !body) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const file = form?.get("icon");
  const generate = body?.generate === true;
  const path = typeof body?.path === "string" ? body.path : null;
  if (multipart && !(file instanceof File)) {
    return NextResponse.json({ error: "icon file required" }, { status: 400 });
  }
  if (!multipart && !generate && !path) {
    return NextResponse.json({ error: "path or generate required" }, { status: 400 });
  }
  if (body?.theme !== undefined && !(typeof body.theme === "string" && THEMES.has(body.theme))) {
    return NextResponse.json({ error: "invalid theme" }, { status: 400 });
  }
  const appRef = appField(body, form);
  if (!appRef) {
    return NextResponse.json({ error: "app required" }, { status: 400 });
  }
  if (await uploadRateLimited(supabase, userId)) {
    return NextResponse.json({ error: "too many uploads" }, { status: 429 });
  }
  try {
    const slug = await resolveOwnedSlug(supabase, userId, appRef);
    const app = await ownedApp(supabase, userId, slug);
    const appname = app.appname ?? slug;

    if (file instanceof File) {
      const type = file.type.toLowerCase();
      if (!ICON_TYPES.has(type)) {
        return NextResponse.json({ error: "icon must be png, jpeg, or webp" }, { status: 400 });
      }
      const stored = await storeIcon(supabase, app, Buffer.from(await file.arrayBuffer()), type);
      return NextResponse.json({ ...stored, generated: false });
    }
    if (path) {
      const read = await readBoxIcon(supabase, userId, appname, path);
      const stored = await storeIcon(supabase, app, read.bytes, read.contentType);
      return NextResponse.json({ ...stored, generated: false });
    }
    if (!generationAllowed(await countIconGenerations(supabase, userId, app.slug))) {
      return NextResponse.json({ error: "upload_instead" }, { status: 429 });
    }
    const theme = typeof body?.theme === "string" ? (body.theme as "atmosphere" | "pixel") : null;
    const generated = await generateIcon(supabase, userId, app, {
      theme,
      channel: sessionUser ? "web" : "imessage",
    });
    const stored = await storeIcon(supabase, app, generated.bytes, generated.contentType);
    let previewed = false;
    if (!sessionUser) {
      // Called from the Box: the owner is in Messages, so the preview goes there.
      try {
        const sender = await createSpectrumSender();
        try {
          previewed = await sendIconPreview(supabase, sender, userId, appname, generated.bytes);
        } finally {
          await sender.close().catch(() => undefined);
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "icon preview send failed",
            user_id: userId,
            slug: app.slug,
            error: error instanceof Error ? error.name : "unknown",
          })
        );
      }
    }
    return NextResponse.json({ ...stored, generated: true, previewed });
  } catch (error) {
    if (error instanceof MediaGuardError) {
      await recordOpsEvent(supabase, "upload_rejected", userId, error.message);
    }
    if (error instanceof IconError || error instanceof PublishError || error instanceof MediaGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BoxApiError && error.status === 404) {
      return NextResponse.json({ error: "icon file not found" }, { status: 404 });
    }
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "busy" }, { status: 429 });
    }
    throw error;
  }
}
