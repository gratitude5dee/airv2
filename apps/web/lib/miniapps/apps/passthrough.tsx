/**
 * Computer/Browser passthrough renderers (extracted from the M7.5 monolith,
 * MA1). Passthrough apps redirect the owner to a freshly-fetched desktop
 * stream URL (never serialized into HTML or storage) and accept no POSTs
 * (C15/C16). Guests never reach here: passthrough exposes the owner's Box
 * screen, so there are no guest actions and render refuses guest sessions.
 */
import { NextResponse } from "next/server";
import { desktopStreamUrl, DesktopUnavailableError } from "@/lib/box/desktop";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
import { forbidden, html, page } from "../html";
import type { MiniAppContext, MiniAppModule } from "./types";

async function renderPassthrough(ctx: MiniAppContext): Promise<NextResponse> {
  if (ctx.session.role !== "owner") {
    return forbidden("this view is owner-only");
  }
  // The desktop stream is WebRTC and cannot be re-streamed through this
  // origin; the owner's browser is redirected to a freshly-fetched stream
  // URL behind the single-use token exchange. no-referrer keeps the URL out
  // of Referer headers; nothing is stored client-side (C17). The browser
  // card is the same live desktop — the headed browser runs on it.
  try {
    const url = await desktopStreamUrl(ctx.supabase, ctx.session.userId);
    await armStopAfter(ctx.supabase, ctx.session.userId);
    const response = NextResponse.redirect(url, 302);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof StartLimitError) {
      return html(
        page(
          "Computer",
          "<h1>Computer</h1><p>Your agent's computer can't start right now — try again in a few minutes.</p>"
        )
      );
    }
    if (error instanceof DesktopUnavailableError) {
      return html(
        page(
          "Computer",
          "<h1>Computer</h1><p>Your agent's screen isn't available yet — it may still be waking up. Pull to refresh in a moment.</p>"
        )
      );
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({
        msg: "computer mini-app failed",
        user_id: ctx.session.userId,
        error: message,
      })
    );
    return html(
      page(
        "Computer",
        "<h1>Computer</h1><p>Couldn't reach your agent's computer — try again shortly.</p>"
      )
    );
  }
}

export const computer: MiniAppModule = { render: renderPassthrough };
export const browser: MiniAppModule = { render: renderPassthrough };
