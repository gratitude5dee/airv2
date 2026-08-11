/**
 * Computer relay for the web surface. GET redirects the authenticated owner
 * to their own box's freshly-fetched desktop stream URL. The URL never
 * appears in JSON or in the parent page's DOM — the home page embeds this
 * route in an iframe (or opens it in a new tab) and the redirect happens
 * inside the browser's network layer, so page scripts cannot read the
 * cross-origin destination. Referrer-Policy: no-referrer keeps the URL out
 * of downstream Referer headers.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
import { desktopStreamUrl, DesktopUnavailableError } from "@/lib/box/desktop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SAFE_HEADERS: Record<string, string> = {
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

function failure(status: number, message: string): NextResponse {
  return new NextResponse(message, {
    status,
    headers: { ...SAFE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) return failure(401, "unauthorized");

  // ?vnc=1 requests the HTTPS-tunneled noVNC viewer for restrictive networks;
  // it must open as a top-level page (new tab), not embedded.
  const vnc = request.nextUrl.searchParams.get("vnc") === "1";

  try {
    const url = await desktopStreamUrl(supabase, session.userId, { vnc });
    await armStopAfter(supabase, session.userId);
    const response = NextResponse.redirect(url, 302);
    for (const [key, value] of Object.entries(SAFE_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (error) {
    if (error instanceof StartLimitError) {
      return failure(429, "Your agent's computer can't start right now — try again in a few minutes.");
    }
    if (error instanceof DesktopUnavailableError) {
      return failure(503, "Your agent's screen isn't available yet — try again in a moment.");
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({
        msg: "desktop relay failed",
        user_id: session.userId,
        error: message,
      })
    );
    return failure(502, "Couldn't reach your agent's computer.");
  }
}
