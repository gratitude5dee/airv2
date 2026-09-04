/**
 * V11 §5.1 Share tab — a QR for one owned app's public URL, rendered server-
 * side with the wallet's QR helper so the surface ships no QR library.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { ownedApp, PublishError } from "@/lib/miniapps/publish";
import { nestedPathFor } from "@/lib/miniapps/nested";
import { addressQrDataUrl } from "@/lib/wallet/qr";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  try {
    const app = await ownedApp(serviceClient(), userId, slug);
    const url = `${env.miniappOrigin().replace(/\/$/, "")}${nestedPathFor(app.slug)}`;
    const qr = await addressQrDataUrl(url);
    if (!qr) {
      return NextResponse.json({ error: "qr unavailable" }, { status: 503 });
    }
    return NextResponse.json({ slug: app.slug, url, qr });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
