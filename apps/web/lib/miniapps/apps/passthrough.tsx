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
import { mintToken, verifyToken } from "../tokens";
import { esc, forbidden } from "../html";
import { renderShell, shellHtml } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";

export async function renderPassthrough(
  ctx: MiniAppContext
): Promise<NextResponse> {
  if (ctx.session.role !== "owner") {
    return forbidden("this view is owner-only");
  }
  const params = ctx.request.nextUrl.searchParams;
  const ATTEMPT_COOKIE = "mini_desktop_attempt";
  const ATTEMPT_TOKEN_APP = "desktop-readiness";
  const READINESS_BUDGET_MS = 30_000;
  const restart = params.get("restart") === "1";
  const storedAttempt = restart
    ? null
    : verifyToken(
        ctx.request.cookies.get(ATTEMPT_COOKIE)?.value ?? "",
        ATTEMPT_TOKEN_APP
      );
  const storedDeadline = Number(storedAttempt?.resourceId ?? Number.NaN);
  const reuseStoredAttempt =
    storedAttempt?.userId === ctx.session.userId &&
    Number.isFinite(storedDeadline) &&
    storedDeadline > 0;
  const readinessDeadline = reuseStoredAttempt
    ? storedDeadline
    : Date.now() + READINESS_BUDGET_MS;
  const freshAttempt = reuseStoredAttempt
    ? null
    : mintToken(
        ctx.session.userId,
        ATTEMPT_TOKEN_APP,
        String(readinessDeadline),
        5
      );
  const withAttemptCookie = (
    response: NextResponse,
    disposition: "keep" | "clear" = "keep"
  ): NextResponse => {
    if (disposition === "clear") {
      response.cookies.set(ATTEMPT_COOKIE, "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: ctx.basePath,
        maxAge: 0,
      });
    } else if (freshAttempt) {
      response.cookies.set(ATTEMPT_COOKIE, freshAttempt, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: ctx.basePath,
        maxAge: 300,
      });
    }
    return response;
  };
  // The desktop stream is WebRTC and cannot be re-streamed through this
  // origin; the owner's browser is redirected to a freshly-fetched stream
  // URL behind the single-use token exchange. no-referrer keeps the URL out
  // of Referer headers; nothing is stored client-side (C17). The browser
  // card is the same live desktop — the headed browser runs on it.
  const errorPage = (message: string) =>
    withAttemptCookie(shellHtml(
      renderShell({
        title: "Computer",
        kicker: "Screen",
        body: `<section class="panel"><p>${message}</p><p><a href="${esc(`${ctx.request.nextUrl.pathname}?view=live&restart=1`)}" target="_top" rel="noopener">Retry now</a></p></section>`,
        lite: ctx.session.via === "card",
      })
    ));
  // ?vnc=1 requests the HTTPS-tunneled noVNC viewer for restrictive
  // networks; its page must be top-level, so callers open it in a new tab.
  const vnc = params.get("vnc") === "1";
  const parsedRetry = Number.parseInt(params.get("retry") ?? "0", 10);
  const retry = Number.isFinite(parsedRetry)
    ? Math.max(0, Math.min(parsedRetry, 20))
    : 0;
  // A refresh must advance the attempt in the URL; otherwise a browser can
  // loop forever on a provider that reports a running box but never starts
  // its desktop daemon. Six attempts cover roughly 30 seconds for the slow
  // wake path and leave a deliberate manual retry after that budget.
  const MAX_AUTO_RETRIES = 6;
  // 1 + 2 + 4 + 5 + 5 + 5 seconds stays inside the readiness budget while
  // leaving a visible, deliberate manual retry instead of a refresh loop.
  const retryDelaySeconds = [1, 2, 4, 5, 5, 5][retry] ?? 5;
  const retryUrl = (nextRetry: number, restartAttempt = false): string => {
    const query = new URLSearchParams({
      view: "live",
      retry: String(nextRetry),
      ...(vnc ? { vnc: "1" } : {}),
      ...(restartAttempt ? { restart: "1" } : {}),
    });
    return `${ctx.request.nextUrl.pathname}?${query.toString()}`;
  };
  const retryAvailable =
    retry < MAX_AUTO_RETRIES && Date.now() < readinessDeadline;
  const manualRetry = retryAvailable
    ? retryUrl(retry + 1)
    : retryUrl(0, true);
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
          body: `<section class="panel"><p>Waking your agent's computer\u2026</p><p class="muted">This page retries briefly while the computer wakes.${retryAvailable ? " It will refresh automatically." : " Automatic retries stopped after about 30 seconds."}</p><p><a href="${esc(manualRetry)}" target="_top" rel="noopener">Retry now</a></p></section>`,
          lite: ctx.session.via === "card",
        })
      );
      if (retryAvailable) {
        waking.headers.set("Refresh", `${retryDelaySeconds}; url=${retryUrl(retry + 1)}`);
        waking.headers.set("Retry-After", String(retryDelaySeconds));
      }
      waking.headers.set("Cache-Control", "no-store");
      return withAttemptCookie(waking);
    }
    if (stream.status === "preparing") {
      const next = retryUrl(retry + 1);
      const vncUrl = retryAvailable
        ? `${ctx.request.nextUrl.pathname}?view=live&vnc=1`
        : `${ctx.request.nextUrl.pathname}?view=live&vnc=1&restart=1`;
      const preparing = shellHtml(
        renderShell({
          title: "Computer",
          kicker: "Screen",
          body: `<section class="panel"><p>Preparing your agent's screen…</p><p class="muted">The computer is on, but its desktop stream is still starting.${retryAvailable ? " This page will retry shortly." : " Automatic retries stopped after about 30 seconds."}</p><p style="display:flex;gap:.75rem;flex-wrap:wrap"><a href="${esc(vncUrl)}" target="_top" rel="noopener">Try VNC</a><a href="${esc(manualRetry)}" target="_top" rel="noopener">Retry now</a></p></section>`,
          lite: ctx.session.via === "card",
        })
      );
      if (retryAvailable) {
        preparing.headers.set("Refresh", `${retryDelaySeconds}; url=${next}`);
        preparing.headers.set("Retry-After", String(retryDelaySeconds));
      }
      preparing.headers.set("Cache-Control", "no-store");
      return withAttemptCookie(preparing);
    }
    await armStopAfter(ctx.supabase, ctx.session.userId);
    const response = NextResponse.redirect(stream.url, 302);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    return withAttemptCookie(response, "clear");
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
      "Couldn't prepare your agent's computer right now. Check your connection, then retry."
    );
  }
}

// The computer slug grew a task-state header page in MA6 — see computer.tsx.
export const browser: MiniAppModule = { render: renderPassthrough };
