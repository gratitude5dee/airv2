/**
 * MA10 SEO: sitemap.xml on the mini origin — the store home plus every
 * public + published app detail page (public storefronts are store apps and
 * appear here automatically). MA7: nothing draft, private, or unlisted.
 */
import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { listPublicApps } from "@/lib/miniapps/registry";
import { etagFor, sitemapXml } from "@/lib/miniapps/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const body = sitemapXml(await listPublicApps(serviceClient()));
  const etag = etagFor(body);
  const headers = {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=600",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, { status: 200, headers });
}
