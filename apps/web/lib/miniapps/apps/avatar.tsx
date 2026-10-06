/**
 * /avatar mini-app: the FYE elemental casting stage (avatar.wzrd.tech)
 * served inside the mini-app shell. The whole experience — Three.js stage,
 * MediaPipe hand tracking, workshop presets — stays on its own origin and
 * this view is a full-bleed frame into it, so every control works exactly
 * as it does on the site.
 *
 * Camera delegation is the whole reason this module exists instead of a
 * link-out: getUserMedia inside a cross-origin frame passes only when the
 * iframe's `allow` delegates it AND this page's Permissions-Policy names
 * the origin — both are set here, so Hand mode works full-page on
 * mini.wzrd.tech and docked in /home (which delegates camera into the mini
 * origin in turn). Where the webview has no camera (iOS Messages card), the
 * stage falls back to pointer input on its own.
 *
 * Owner-only (access='single'): guests and card viewers get the forbidden
 * page. No POSTs — every control lives inside the frame.
 */
import { NextResponse } from "next/server";
import { forbidden } from "../html";
import { renderShell, shellHtml } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";

const AVATAR_ORIGIN = "https://avatar.wzrd.tech";

/**
 * The shell CSP is default-src 'none', so the frame needs an explicit
 * frame-src (child-src kept for engines that never made the CSP3 move).
 * Permissions-Policy widens camera/mic/autoplay/fullscreen past the base
 * `(self)` allowlist to the frame's origin — the header path matters on
 * engines that consult the document policy before the `allow` attribute,
 * and the attribute is the delegation they all honor for cross-origin
 * children. Both are set deliberately.
 */
function allowEmbedded(response: NextResponse): NextResponse {
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  response.headers.set(
    "Content-Security-Policy",
    `${csp}; frame-src ${AVATAR_ORIGIN}; child-src ${AVATAR_ORIGIN}`
  );
  response.headers.set(
    "Permissions-Policy",
    `camera=(self "${AVATAR_ORIGIN}"), ` +
      `microphone=(self "${AVATAR_ORIGIN}"), ` +
      `autoplay=(self "${AVATAR_ORIGIN}"), ` +
      `fullscreen=(self "${AVATAR_ORIGIN}")`
  );
  return response;
}

async function renderAvatar(ctx: MiniAppContext): Promise<NextResponse> {
  if (ctx.session.role !== "owner") {
    return forbidden("this view is owner-only");
  }
  const body = `<div style="flex:1;display:flex;flex-direction:column;align-self:stretch;width:100%;min-height:0"><iframe src="${AVATAR_ORIGIN}/" title="Avatar — FYE elemental casting stage" allow="camera ${AVATAR_ORIGIN}; microphone ${AVATAR_ORIGIN}; autoplay ${AVATAR_ORIGIN}; fullscreen ${AVATAR_ORIGIN}" allowfullscreen referrerpolicy="no-referrer" style="flex:1;width:100%;min-height:0;border:0;border-radius:var(--radius-panel);background:#0b0b10"></iframe><p class="muted" style="text-align:center;margin:0.5rem 0 0">Tap “Hand mode” for camera tracking and “Controls” for the move pad — drawing always works. <a href="${AVATAR_ORIGIN}/" target="_blank" rel="noopener">Open avatar.wzrd.tech ↗</a></p></div>`;
  return allowEmbedded(
    shellHtml(
      renderShell({
        title: "Avatar",
        kicker: "Avatar",
        body,
        lite: ctx.session.via === "card",
      })
    )
  );
}

export const avatar: MiniAppModule = { render: renderAvatar };
