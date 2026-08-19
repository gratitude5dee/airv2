/**
 * MA10 machine registry: GET /api/store/index.json — an array of public +
 * published apps carrying MA7 fields only (name, description, slug, url,
 * publisher, gates, access, updated_at). ETag + cache headers; served on the
 * mini origin (middleware redirects the main origin to it).
 */
import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { listPublicApps } from "@/lib/miniapps/registry";
import { buildIndex, etagFor } from "@/lib/miniapps/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const apps = await listPublicApps(serviceClient());
  const body = JSON.stringify(buildIndex(apps));
  const etag = etagFor(body);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=300",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, { status: 200, headers });
}
