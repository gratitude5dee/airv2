/**
 * Host routing (MA0, goal.md §4.2). mini.wzrd.tech is a separate origin from
 * the main app — the store and every mini-app live there; the main origin
 * never serves store routes and the mini origin never serves main-app routes.
 *
 *   mini host  /                → rewrite /mini            (store home)
 *   mini host  /store/<slug>    → rewrite /mini/store/<slug>
 *   mini host  /login           → rewrite /mini/login      (store OTP login)
 *   mini host  /mini/<app>?t=…  → 301 /<app>?t=…           (legacy links;
 *                                 the single-use token rides the redirect)
 *   mini host  /<slug>          → rewrite /mini/<slug>     (loader v2)
 *   mini host  /api/mini/*      → pass through
 *   main host  /mini/<app>      → 308 to the mini origin   (legacy links)
 *
 * Rewritten requests carry x-mini-host: 1 so the loader scopes cookies and
 * redirects to the external /<slug> path.
 */
import { NextRequest, NextResponse } from "next/server";

function miniHost(): string {
  const origin = process.env.MINIAPP_ORIGIN ?? "https://mini.wzrd.tech";
  try {
    return new URL(origin).host;
  } catch {
    return "mini.wzrd.tech";
  }
}

export function middleware(request: NextRequest): NextResponse {
  const host = request.headers.get("host") ?? "";
  const { pathname, search } = request.nextUrl;
  const onMini = host === miniHost();

  if (!onMini) {
    // Discovery is served from the mini origin (MA10); the backing search
    // tool at /api/store/search stays on the main origin for gateway callers.
    if (pathname === "/api/store/index.json") {
      const target = new URL(
        pathname + search,
        process.env.MINIAPP_ORIGIN ?? "https://mini.wzrd.tech"
      );
      return NextResponse.redirect(target, 308);
    }
    // Main origin: mini-app and store paths live on the mini origin only.
    if (pathname === "/mini" || pathname.startsWith("/mini/")) {
      const target = new URL(
        pathname.replace(/^\/mini\/?/, "/") + search,
        process.env.MINIAPP_ORIGIN ?? "https://mini.wzrd.tech"
      );
      return NextResponse.redirect(target, 308);
    }
    return NextResponse.next();
  }

  // Mini origin. Legacy /mini/<app> URLs 301 to /<app>, preserving ?t=… —
  // the token is still redeemed exactly once, on the request that follows.
  if (pathname === "/mini" || pathname.startsWith("/mini/")) {
    const target = new URL(request.nextUrl);
    target.pathname = pathname.replace(/^\/mini\/?/, "/");
    return NextResponse.redirect(target, 301);
  }

  // API routes pass through untouched; only /api/mini/* (store/loader) and
  // /api/apps/* (the published-bundle Apps API, MA3) belong here.
  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/mini/")) return NextResponse.next();
    if (pathname.startsWith("/api/apps/")) return NextResponse.next();
    // MA10 machine registry lives on the mini origin.
    if (pathname === "/api/store/index.json") return NextResponse.next();
    return new NextResponse("not found", { status: 404 });
  }

  // Everything else on the mini host is store or loader territory: rewrite
  // under /mini and mark the request so the loader uses external paths.
  const rewritten = new URL(request.nextUrl);
  rewritten.pathname = pathname === "/" ? "/mini" : `/mini${pathname}`;
  const headers = new Headers(request.headers);
  headers.set("x-mini-host", "1");
  return NextResponse.rewrite(rewritten, { request: { headers } });
}

export const config = {
  // Skip Next internals only. Static-looking extensions still need the
  // middleware: published bundle assets (/<slug>/app.js etc. on the mini
  // host) must be rewritten to /mini/<slug>/<path> to be served (MA3).
  matcher: ["/((?!_next/|favicon.ico$).*)"],
};
