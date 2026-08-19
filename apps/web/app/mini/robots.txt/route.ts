/**
 * MA10 SEO: robots.txt on the mini origin. Store pages and discovery files
 * are crawlable; the tokened app views themselves are not.
 */
import { NextResponse } from "next/server";
import { robotsTxt } from "@/lib/miniapps/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return new NextResponse(robotsTxt(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
