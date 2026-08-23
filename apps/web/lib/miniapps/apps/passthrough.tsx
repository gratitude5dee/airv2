/**
 * Computer/Browser passthrough renderers (extracted from the M7.5 monolith,
 * MA1). Passthrough apps redirect the owner to a freshly-fetched desktop
 * stream URL (never serialized into HTML or storage) and accept no POSTs
 * (C15/C16). Guests never reach here: passthrough exposes the owner's Box
 * screen, so there are no guest actions and render refuses guest sessions.
 */
import { NextResponse } from "next/server";
import { desktopStreamUrlIfUp } from "@/lib/box/desktop";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
import { forbidden } from "../html";
import { renderShell, shellHtml } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";

export async function renderPassthrough(
  ctx: MiniAppContext
): Promise<NextResponse> {
  if (ctx.session.role !== "owner") {
    return forbidden("this view is owner-only");
  }
  // The desktop stream is WebRTC and cannot be re-streamed through this
  // origin; the owner's browser is redirected to a freshly-fetched stream
  // URL behind the single-use token exchange. no-referrer keeps the URL out
  // of Referer headers; nothing is stored client-side (C17). The browser
  // card is the same live desktop — the headed browser runs on it.
  const errorPage = (message: string) =>
    shellHtml(
      renderShell({
        title: "Computer",
        kicker: "Screen",
        body: `<section class="panel"><p>${message}</p></section>`,
        lite: ctx.session.via === "card",
      })
    );
  // ?vnc=1 requests the HTTPS-tunneled noVNC viewer for restrictive
  // networks; its page must be top-level, so callers open it in a new tab.
  const vnc = ctx.request.nextUrl.searchParams.get("vnc") === "1";
  try {
    const stream = await desktopStreamUrlIfUp(
      ctx.supabase,
      ctx.session.userId,
      { vnc }
    );
    if (stream.status === "waking") {
      // The machine is booting: render a progress page that reloads itself
      // until the stream is ready, instead of holding the request open
      // through a multi-minute resume (the iframe embed recovers by itself).
      const waking = shellHtml(
        renderShell({
          title: "Computer",
          kicker: "Screen",
          body: `<section class="panel"><p>Waking your agent's computer\u2026</p><p class="muted">This can take a couple of minutes after a long sleep. This page refreshes itself.</p></section>`,
          lite: ctx.session.via === "card",
        })
      );
      waking.headers.set("Refresh", "5");
      waking.headers.set("Cache-Control", "no-store");
      return waking;
    }
    await armStopAfter(ctx.supabase, ctx.session.userId);
    const response = NextResponse.redirect(stream.url, 302);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof StartLimitError) {
      return errorPage(
        "Your agent's computer can't start right now — try again in a few minutes."
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
    return errorPage(
      "Couldn't reach your agent's computer — try again shortly."
    );
  }
}

// The computer slug grew a task-state header page in MA6 — see computer.tsx.
export const browser: MiniAppModule = { render: renderPassthrough };
