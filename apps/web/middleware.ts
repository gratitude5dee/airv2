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
 *   mini host  /api/mini/*      → pass through, marked x-mini-host: 1
 *   main host  /mini            → serve store home         (canonical)
 *   main host  /mini/<slug>     → rewrite /mini/store/<slug> (canonical detail)
 *   main host  /mini/store/<s>  → 308 /mini/<s>            (legacy links)
 *   main host  /mini/login|publish|<slug>/* → 308 to the mini origin
 *
 * Rewritten requests carry x-mini-host: 1 so the loader scopes cookies and
 * redirects to the external /<slug> path.
 */
import { NextRequest, NextResponse } from "next/server";

function miniHost(): string {
  const origin = process.env["MINIAPP_ORIGIN"] ?? "https://mini.wzrd.tech";
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

  // x-mini-host is a middleware-owned marker: never trust it from the
  // client — a spoofed value would steer loader cookie paths and the
  // post-gate redirect origins downstream. Strip it from every request;
  // only the mini-origin rewrite below sets it back.
  const spoofed = request.headers.has("x-mini-host");
  const headers = new Headers(request.headers);
  headers.delete("x-mini-host");

  if (!onMini) {
    // Discovery is served from the mini origin (MA10); the backing search
    // tool at /api/store/search stays on the main origin for gateway callers.
    if (pathname === "/api/store/index.json") {
      const target = new URL(
        pathname + search,
        process.env["MINIAPP_ORIGIN"] ?? "https://mini.wzrd.tech"
      );
      return NextResponse.redirect(target, 308);
    }
    // Main origin: canonical store pages live here (hybrid) — /mini is the
    // store home and /mini/<slug> the app detail page. Everything that runs
    // publisher code or mints store sessions (loader paths, bundle assets,
    // login, publish) stays on the sandboxed mini origin.
    if (pathname === "/mini" || pathname.startsWith("/mini/")) {
      const rest = pathname.replace(/^\/mini\/?/, "");
      if (rest === "") {
        return NextResponse.next({ request: { headers } });
      }
      const segments = rest.split("/");
      if (segments[0] === "store") {
        // Legacy detail path: 308 to the canonical /mini/<slug>.
        if (segments.length === 2) {
          const target = new URL(request.nextUrl);
          target.pathname = `/mini/${segments[1]}`;
          return NextResponse.redirect(target, 308);
        }
        // /mini/store/<slug>/agent.md and friends serve as routed.
        return NextResponse.next({ request: { headers } });
      }
      // Tokened launch/grant links (?t=/?g=) redeem at the mini-origin
      // loader — the token rides the redirect, still spent exactly once.
      const tokened =
        request.nextUrl.searchParams.has("t") ||
        request.nextUrl.searchParams.has("g");
      if (
        segments.length === 1 &&
        !tokened &&
        segments[0] !== "login" &&
        segments[0] !== "publish"
      ) {
        const rewritten = new URL(request.nextUrl);
        rewritten.pathname = `/mini/store/${segments[0]}`;
        return NextResponse.rewrite(rewritten, { request: { headers } });
      }
      const target = new URL(
        `/${rest}` + search,
        process.env["MINIAPP_ORIGIN"] ?? "https://mini.wzrd.tech"
      );
      return NextResponse.redirect(target, 308);
    }
    if (spoofed) {
      return NextResponse.next({ request: { headers } });
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
    const passthrough = spoofed
      ? NextResponse.next({ request: { headers } })
      : NextResponse.next();
    // Store/loader APIs mint app cookies and redirects, so they carry the
    // same external-path marker as rewritten app requests: gates scope the
    // paid session cookie to /<slug>, where the app is actually served.
    if (pathname.startsWith("/api/mini/")) {
      headers.set("x-mini-host", "1");
      return NextResponse.next({ request: { headers } });
    }
    if (pathname.startsWith("/api/apps/")) return passthrough;
    // MA10 machine registry lives on the mini origin.
    if (pathname === "/api/store/index.json") return passthrough;
    return new NextResponse("not found", { status: 404 });
  }

  // First-party static assets (public/) are shared across both hosts —
  // mini-app shells reference them by absolute path, so they must not be
  // rewritten into loader slugs.
  if (pathname.startsWith("/creator-os/")) {
    return NextResponse.next({ request: { headers } });
  }

  // Everything else on the mini host is store or loader territory: rewrite
  // under /mini and mark the request so the loader uses external paths.
  const rewritten = new URL(request.nextUrl);
  rewritten.pathname = pathname === "/" ? "/mini" : `/mini${pathname}`;
  headers.set("x-mini-host", "1");
  const response = NextResponse.rewrite(rewritten, { request: { headers } });
  // MA11 load: the store home is public, session-free SSR — let the edge
  // cache it briefly. Loaders (/<slug>) stay dynamic: they carry cookies.
  if (pathname === "/" && request.method === "GET" && !search) {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );
  }
  return response;
}

export const config = {
  // Skip Next internals only. Static-looking extensions still need the
  // middleware: published bundle assets (/<slug>/app.js etc. on the mini
  // host) must be rewritten to /mini/<slug>/<path> to be served (MA3).
  matcher: ["/((?!_next/|favicon.ico$).*)"],
};
