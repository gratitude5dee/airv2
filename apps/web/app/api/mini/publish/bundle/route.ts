/**
 * MA3 bundle upload: multipart zip for an owned app → validate (25 MB cap,
 * static allowlist, no service workers, no CSP overrides, index.html
 * required) → apps/<slug>/<version>/ on R2 → registry points at the new
 * version. Uploading never publishes — the status flip is separate.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { ownedApp, PublishError } from "@/lib/miniapps/publish";
import {
  BUNDLE_MAX_ZIP_BYTES,
  BundleError,
  uploadBundle,
} from "@/lib/miniapps/bundles";
import { r2Configured } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json(
      { error: "bundle storage unavailable" },
      { status: 503 }
    );
  }
  const form = await request.formData().catch(() => null);
  const slug = form?.get("slug");
  const file = form?.get("bundle");
  if (typeof slug !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (file.size > BUNDLE_MAX_ZIP_BYTES) {
    return NextResponse.json({ error: "bundle too large" }, { status: 413 });
  }
  const supabase = serviceClient();
  try {
    const app = await ownedApp(supabase, userId, slug);
    const zip = Buffer.from(await file.arrayBuffer());
    const version = await uploadBundle(supabase, app.id, app.slug, zip);
    return NextResponse.json({ ok: true, version });
  } catch (error) {
    if (error instanceof PublishError || error instanceof BundleError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
