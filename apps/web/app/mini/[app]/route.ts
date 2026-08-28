/**
 * Mini-app loader v2 (MA1). One dispatcher, registry-driven:
 *  - resolve the slug against mini_apps — the path is a routing hint, never
 *    an authorization; unknown/unpublished slugs 404 within one request.
 *  - GET ?t=<token>: verify token.app === path.app (multi-use within its
 *    short TTL), exchange it for a short-lived HttpOnly cookie scoped to
 *    this app's path, and redirect with the token stripped from the URL
 *    (C15).
 *  - GET ?g=<grant>: redeem a guest grant into a guest session scoped to
 *    exactly that app + resource (MA4).
 *  - otherwise run the gate chain (visibility → password → x402 → session)
 *    and dispatch to the renderer module at lib/miniapps/apps/<slug> (MA5).
 * All state lives in the user's box; this origin shares no session with the
 * main app and nothing is ever written to client storage (C17).
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { mintToken, recordRedemption, verifyToken } from "@/lib/miniapps/tokens";
import { getRegistryApp, type RegistryApp } from "@/lib/miniapps/registry";
import {
  cookieName,
  elapsedMs,
  externalOrigin,
  logGateEvent,
  passwordGate,
  runGateChain,
  sessionFromCookie,
  visibilityGate,
  x402Gate,
  type GateOutcome,
  type GateTimings,
} from "@/lib/miniapps/gates";
import { guestRateLimited, redeemGuestGrant } from "@/lib/miniapps/guests";
import { FIRST_PARTY_MODULES, type MiniAppModule } from "@/lib/miniapps/apps";
import { publishedModule } from "@/lib/miniapps/apps/published";
import { isStorefrontApp, storefront } from "@/lib/miniapps/apps/storefront";
import {
  esc,
  forbidden,
  html,
  notFound,
  page,
  sessionExpired,
  withBaseHeaders,
} from "@/lib/miniapps/html";
import { recordOpsEvent } from "@/lib/security/limits";
import {
  userStyle,
  withProfileCache,
  withStyle,
  type MiniStyle,
} from "@/lib/miniapps/themeContext";
import type { MiniSession } from "@/lib/miniapps/gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Studio generate/edit actions run a synchronous creative render (420s
// budget + a possible resume) — match the creative events lane's cap.
export const maxDuration = 800;

/**
 * Per-request latency line. Every return path emits exactly one, so a slow
 * open can be split into gate round-trips vs. the renderer's own work.
 * `lane` says which branch served the request: a token exchange, a guest
 * grant redemption, or a gated render.
 */
type LoadLane =
  | "token_exchange"
  | "grant"
  | "gated_render"
  | "unknown_app"
  | "prefetch";

interface LoadLog {
  slug: string;
  method: "GET" | "POST";
  start: number;
  lane: LoadLane;
  gate?: GateTimings | undefined;
  renderMs?: number | undefined;
}

function logLoad(
  log: LoadLog,
  outcome: string,
  status: number
): void {
  console.log(
    JSON.stringify({
      msg: "miniapp load",
      app: log.slug,
      method: log.method,
      lane: log.lane,
      outcome,
      status,
      ms: elapsedMs(log.start),
      gate_ms: log.gate?.totalMs ?? null,
      gate_visibility_ms: log.gate?.visibilityMs ?? null,
      gate_password_ms: log.gate?.passwordMs ?? null,
      gate_x402_ms: log.gate?.x402Ms ?? null,
      gate_session_ms: log.gate?.sessionMs ?? null,
      render_ms: log.renderMs ?? null,
    })
  );
}

/**
 * External base path for the app: on mini.wzrd.tech the middleware rewrites
 * /<slug> → /mini/<slug> and marks the request, so redirects and cookie
 * paths must use the external /<slug> form there.
 */
function basePathFor(request: NextRequest, slug: string): string {
  return request.headers.get("x-mini-host") === "1"
    ? `/${slug}`
    : `/mini/${slug}`;
}

/**
 * Link previews and speculative prefetches (iMessage/Slack unfurlers, Next
 * HEAD derivation, browser prefetch) must never redeem a single-use token —
 * only the user's real tap may. Serve them a placeholder instead.
 */
function isPrefetch(request: NextRequest): boolean {
  if (request.method === "HEAD") return true;
  const purpose = (
    request.headers.get("sec-purpose") ??
    request.headers.get("purpose") ??
    request.headers.get("x-purpose") ??
    request.headers.get("x-moz") ??
    ""
  ).toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("preview")) return true;
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  return [
    "facebookexternalhit",
    "facebot",
    "twitterbot",
    "slackbot",
    "discordbot",
    "telegrambot",
    "whatsapp",
    "linkedinbot",
    "skypeuripreview",
    "imessagelinkpreview",
    "applebot",
    "googlebot",
    "bingbot",
    "bot/",
    "preview",
  ].some((needle) => ua.includes(needle));
}

function resolveModule(app: RegistryApp): MiniAppModule | null {
  // First-party rows dispatch by slug; merchant storefront rows (MA8) to
  // the storefront module; publisher rows (owner_user_id set +
  // bundle_version) dispatch to the published-bundle module (MA3).
  if (isStorefrontApp(app)) return storefront;
  return FIRST_PARTY_MODULES[app.slug] ?? publishedModule(app);
}

/**
 * MA8 public surfaces: the visibility/password/x402 gates still run, but an
 * anonymous visitor with no session cookie gets a synthetic guest session
 * for the app's owner (scoped to this app only — it mints nothing and the
 * guest-action gate still applies) instead of a 403.
 */
async function runPublicGateChain(
  request: NextRequest,
  supabase: SupabaseClient,
  app: RegistryApp,
  basePath: string,
  submittedPassword?: string
): Promise<GateOutcome> {
  const chainStart = performance.now();
  const timings: GateTimings = { totalMs: 0 };
  const done = (): GateTimings => ({
    ...timings,
    totalMs: elapsedMs(chainStart),
  });

  let mark = performance.now();
  const visibility = visibilityGate(app);
  timings.visibilityMs = elapsedMs(mark);
  if (visibility) return { ok: false, response: visibility, timings: done() };

  mark = performance.now();
  const password = passwordGate(request, app, basePath, submittedPassword);
  timings.passwordMs = elapsedMs(mark);
  if (password) {
    await logGateEvent(
      supabase,
      app.id,
      null,
      password.settled ? "gate_settled" : "gate_challenged",
      "password"
    );
    return { ok: false, response: password.response, timings: done() };
  }

  mark = performance.now();
  const payment = await x402Gate(request, app, { basePath });
  timings.x402Ms = elapsedMs(mark);
  if (payment) {
    await logGateEvent(supabase, app.id, null, "gate_challenged", "x402");
    return { ok: false, response: payment, timings: done() };
  }

  mark = performance.now();
  const session = sessionFromCookie(request, app.slug);
  timings.sessionMs = elapsedMs(mark);
  if (session) return { ok: true, session, timings: done() };
  if (!app.owner_user_id)
    return { ok: false, response: notFound(), timings: done() };
  return {
    ok: true,
    session: {
      userId: app.owner_user_id,
      resourceId: "storefront",
      role: "guest",
    },
    timings: done(),
  };
}

/**
 * The shell wordmark links back to Home for the session owner — a fresh
 * signed link per render (multi-use within its TTL). Guests stay put: Home
 * is the owner's launcher, not theirs.
 */
function sessionStyle(
  style: MiniStyle,
  session: MiniSession,
  slug: string,
  basePath: string
): MiniStyle {
  if (session.role !== "owner") return style;
  const prefix = basePath.slice(0, basePath.length - slug.length);
  const homeHref = `${prefix}home?t=${mintToken(session.userId, "home", "default", 15, { via: session.via })}`;
  return { ...style, homeHref };
}

/**
 * Sliding session: every gated request re-mints the path-scoped cookie, so
 * a sheet left open in Messages keeps working past the original 15 minutes
 * instead of dead-ending taps into a 403 ("Unable to Load App").
 */
function refreshCookie(
  response: NextResponse,
  session: MiniSession,
  slug: string,
  basePath: string
): NextResponse {
  // Synthetic storefront guests never had a cookie — don't mint one.
  if (session.role === "guest" && !session.grantId) return response;
  response.cookies.set(
    cookieName(slug),
    mintToken(session.userId, slug, session.resourceId, 15, {
      role: session.role,
      grantId: session.grantId,
      via: session.via,
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: basePath,
      maxAge: 15 * 60,
    }
  );
  return response;
}

export function GET(
  request: NextRequest,
  context: { params: Promise<{ app: string }> }
): Promise<NextResponse> {
  return withProfileCache(() => handleGet(request, context));
}

export function POST(
  request: NextRequest,
  context: { params: Promise<{ app: string }> }
): Promise<NextResponse> {
  return withProfileCache(() => handlePost(request, context));
}

/**
 * The style of the session the request already carries. A cookie is signed
 * and scoped to this slug, so its user id is authentic before the gate chain
 * runs — the read can overlap the registry lookup and the chain instead of
 * waiting behind them. It is only *used* once the chain has approved the
 * same user; the prefetch itself decides nothing.
 */
function prefetchStyle(
  request: NextRequest,
  supabase: SupabaseClient,
  slug: string
): { userId: string; style: Promise<MiniStyle> } | null {
  const params = request.nextUrl.searchParams;
  if (params.get("t") || params.get("g")) return null;
  const session = sessionFromCookie(request, slug);
  if (!session) return null;
  const style = userStyle(supabase, session.userId);
  // A gate may block before anything awaits this — keep a failed read from
  // surfacing as an unhandled rejection.
  void style.catch(() => undefined);
  return { userId: session.userId, style };
}

/** The prefetched style when it belongs to the session the gates approved. */
async function styleFor(
  supabase: SupabaseClient,
  session: MiniSession,
  prefetched: { userId: string; style: Promise<MiniStyle> } | null
): Promise<MiniStyle> {
  if (prefetched && prefetched.userId === session.userId) {
    return prefetched.style;
  }
  return userStyle(supabase, session.userId);
}

async function handleGet(
  request: NextRequest,
  context: { params: Promise<{ app: string }> }
): Promise<NextResponse> {
  const start = performance.now();
  const { app: slug } = await context.params;
  const log: LoadLog = { slug, method: "GET", start, lane: "gated_render" };
  const supabase = serviceClient();
  // Registry lookup, session verification and the style read are independent
  // of each other — start them together so the gated_render lane pays for
  // one round trip instead of three.
  const prefetched = prefetchStyle(request, supabase, slug);
  const app = await getRegistryApp(supabase, slug);
  if (!app) {
    log.lane = "unknown_app";
    logLoad(log, "unknown slug", 404);
    return notFound();
  }
  const appModule = resolveModule(app);
  if (!appModule) {
    log.lane = "unknown_app";
    logLoad(log, "no module", 404);
    return notFound();
  }
  const basePath = basePathFor(request, slug);

  const token = request.nextUrl.searchParams.get("t");
  if (token) {
    log.lane = "token_exchange";
    // token.app === path.app — the path is a routing hint, never authz. The
    // exchange still respects visibility/status: a suspended app cannot be
    // entered even with a fresh token.
    const blocked = visibilityGate(app);
    if (blocked) {
      logLoad(log, "visibility blocked", blocked.status);
      return blocked;
    }
    if (isPrefetch(request)) {
      log.lane = "prefetch";
      logLoad(log, "prefetch placeholder", 200);
      return html(
        page(app.name, `<h1>${esc(app.name)}</h1><div class="card">Tap to open.</div>`)
      );
    }
    const claims = verifyToken(token, slug);
    if (!claims) {
      logLoad(log, "invalid token", 403);
      return sessionExpired("This signed link is invalid or has expired.");
    }
    if (!(await recordRedemption(supabase, claims))) {
      logLoad(log, "token already redeemed", 403);
      return sessionExpired("This signed link is no longer valid.");
    }
    console.log(
      JSON.stringify({ msg: "miniapp opened", user_id: claims.userId, app: slug })
    );
    await logGateEvent(supabase, app.id, claims.userId, "app_opened", "token");
    const response = withBaseHeaders(
      NextResponse.redirect(new URL(basePath, externalOrigin(request)), 303)
    );
    response.cookies.set(
      cookieName(slug),
      mintToken(claims.userId, slug, claims.resourceId, 15, {
        role: claims.role ?? "owner",
        grantId: claims.grantId,
        via: claims.via,
      }),
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: basePath,
        maxAge: 15 * 60,
      }
    );
    logLoad(log, "token exchanged", 303);
    return response;
  }

  const grantId = request.nextUrl.searchParams.get("g");
  if (grantId) {
    log.lane = "grant";
    // MA4: a share URL redeems into a guest session for exactly this app +
    // resource. Replay against another slug fails the app_id match; the
    // session it mints cannot mint anything broader.
    const blocked = visibilityGate(app);
    if (blocked) {
      logLoad(log, "visibility blocked", blocked.status);
      return blocked;
    }
    if (isPrefetch(request)) {
      log.lane = "prefetch";
      logLoad(log, "prefetch placeholder", 200);
      return html(
        page(app.name, `<h1>${esc(app.name)}</h1><div class="card">Tap to open.</div>`)
      );
    }
    // Guest grants only exist for multiplayer apps — owner-only apps never
    // redeem, even if a grant row exists for them.
    if (app.access !== "multiplayer") {
      logLoad(log, "not shareable", 403);
      return forbidden("this app is not shareable");
    }
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (guestRateLimited(grantId, ip)) {
      logLoad(log, "guest rate limited", 429);
      return new NextResponse("too many requests", { status: 429 });
    }
    const grant = await redeemGuestGrant(supabase, grantId, app.id);
    if (!grant) {
      logLoad(log, "invalid grant", 403);
      return forbidden("this invite is no longer valid");
    }
    await logGateEvent(supabase, app.id, grant.created_by, "app_opened", "guest");
    await recordOpsEvent(supabase, "guest_session", grant.created_by, slug);
    const response = withBaseHeaders(
      NextResponse.redirect(new URL(basePath, externalOrigin(request)), 303)
    );
    response.cookies.set(
      cookieName(slug),
      mintToken(grant.created_by, slug, grant.resource_id, 15, {
        role: "guest",
        grantId: grant.id,
      }),
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: basePath,
        maxAge: 15 * 60,
      }
    );
    logLoad(log, "grant redeemed", 303);
    return response;
  }

  const gate = appModule.publicAccess
    ? await runPublicGateChain(request, supabase, app, basePath)
    : await runGateChain(request, supabase, app, basePath);
  log.gate = gate.timings;
  if (!gate.ok) {
    logLoad(log, "gate blocked", gate.response.status);
    return gate.response;
  }

  const renderStart = performance.now();
  const style = await styleFor(supabase, gate.session, prefetched);
  const response = await withStyle(
    sessionStyle(style, gate.session, slug, basePath),
    () =>
      appModule.render({
        request,
        supabase,
        app,
        session: gate.session,
        basePath,
      })
  );
  log.renderMs = elapsedMs(renderStart);
  logLoad(log, "rendered", response.status);
  return refreshCookie(response, gate.session, slug, basePath);
}

async function handlePost(
  request: NextRequest,
  context: { params: Promise<{ app: string }> }
): Promise<NextResponse> {
  const start = performance.now();
  const { app: slug } = await context.params;
  const log: LoadLog = { slug, method: "POST", start, lane: "gated_render" };
  const supabase = serviceClient();
  const app = await getRegistryApp(supabase, slug);
  if (!app) {
    log.lane = "unknown_app";
    logLoad(log, "unknown slug", 404);
    return notFound();
  }
  const appModule = resolveModule(app);
  if (!appModule) {
    log.lane = "unknown_app";
    logLoad(log, "no module", 404);
    return notFound();
  }
  const basePath = basePathFor(request, slug);

  const form = await request.formData().catch(() => new FormData());
  const action = String(form.get("action") ?? "");

  // The password gate consumes its own form post before a session exists.
  const submittedPassword =
    action === "__password"
      ? String(form.get("password") ?? "")
      : undefined;

  const gate = appModule.publicAccess
    ? await runPublicGateChain(request, supabase, app, basePath, submittedPassword)
    : await runGateChain(request, supabase, app, basePath, submittedPassword);
  log.gate = gate.timings;
  if (!gate.ok) {
    logLoad(log, "gate blocked", gate.response.status);
    return gate.response;
  }
  if (action === "__password") {
    // Already unlocked — just reload the view.
    logLoad(log, "password settled", 303);
    return withBaseHeaders(
      NextResponse.redirect(new URL(basePath, externalOrigin(request)), 303)
    );
  }

  if (!appModule.action) {
    logLoad(log, "no action handler", 404);
    return notFound();
  }

  if (
    gate.session.role === "guest" &&
    !(appModule.guestActions ?? []).includes(action)
  ) {
    logLoad(log, "guest action refused", 403);
    return forbidden("guests can't do that here");
  }

  const renderStart = performance.now();
  const style = await userStyle(supabase, gate.session.userId);
  const response = await withStyle(
    sessionStyle(style, gate.session, slug, basePath),
    () =>
      appModule.action!(
        { request, supabase, app, session: gate.session, basePath },
        form
      )
  );
  log.renderMs = elapsedMs(renderStart);
  logLoad(log, "action handled", response.status);
  return refreshCookie(response, gate.session, slug, basePath);
}
