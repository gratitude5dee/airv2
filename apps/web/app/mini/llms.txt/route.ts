/**
 * MA10 AEO: llms.txt at the mini-origin root (middleware rewrites
 * /llms.txt → /mini/llms.txt on the mini host). Public, cacheable, and
 * limited to public + published apps (MA7).
 */
import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { listPublicApps } from "@/lib/miniapps/registry";
import { etagFor, llmsTxt } from "@/lib/miniapps/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const body = llmsTxt(await listPublicApps(serviceClient()));
  const etag = etagFor(body);
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=600",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, { status: 200, headers });
}
