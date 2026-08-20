/**
 * Creator template downloads (Phase 3): a store-session publisher fetches a
 * starter zip built by lib/miniapps/templates. The zip is then uploaded back
 * through /api/mini/publish/bundle, so it passes the same validator as any
 * hand-built bundle — this route grants nothing.
 */
import { NextRequest, NextResponse } from "next/server";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { isTemplateName, templateZip } from "@/lib/miniapps/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const name = request.nextUrl.searchParams.get("name") ?? "";
  if (!isTemplateName(name)) {
    return NextResponse.json({ error: "unknown template" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(templateZip(name)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}-template.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
