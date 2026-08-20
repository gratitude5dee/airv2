/**
 * Mini-app loader v2 (MA1). One dispatcher, registry-driven:
 *  - resolve the slug against mini_apps — the path is a routing hint, never
 *    an authorization; unknown/unpublished slugs 404 within one request.
 *  - GET ?t=<token>: verify token.app === path.app, redeem the single-use
 *    token, exchange it for a short-lived HttpOnly cookie scoped to this
 *    app's path, and redirect with the token stripped from the URL (C15).
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
import { mintToken, redeemOnce, verifyToken } from "@/lib/miniapps/tokens";
import { getRegistryApp, type RegistryApp } from "@/lib/miniapps/registry";
import {
  cookieName,
  externalOrigin,
  logGateEvent,
  passwordGate,
  runGateChain,
  sessionFromCookie,
  visibilityGate,
  x402Gate,
  type GateOutcome,
} from "@/lib/miniapps/gates";
import { guestRateLimited, redeemGuestGrant } from "@/lib/miniapps/guests";
import { FIRST_PARTY_MODULES, type MiniAppModule } from "@/lib/miniapps/apps";
import { publishedModule } from "@/lib/miniapps/apps/published";
import { isStorefrontApp, storefront } from "@/lib/miniapps/apps/storefront";
import {
  forbidden,
  notFound,
  sessionExpired,
  withBaseHeaders,
} from "@/lib/miniapps/html";
import { recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  const visibility = visibilityGate(app);
  if (visibility) return { ok: false, response: visibility };
  const password = passwordGate(request, app, basePath, submittedPassword);
  if (password) {
    await logGateEvent(
      supabase,
      app.id,
      null,
      password.settled ? "gate_settled" : "gate_challenged",
      "password"
    );
    return { ok: false, response: password.response };
  }
  const payment = await x402Gate(request, app, { basePath });
  if (payment) {
    await logGateEvent(supabase, app.id, null, "gate_challenged", "x402");
    return { ok: false, response: payment };
  }
  const session = sessionFromCookie(request, app.slug);
  if (session) return { ok: true, session };
  if (!app.owner_user_id) return { ok: false, response: notFound() };
  return {
    ok: true,
    session: {
      userId: app.owner_user_id,
      resourceId: "storefront",
      role: "guest",
    },
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ app: string }> }
): Promise<NextResponse> {
  const { app: slug } = await context.params;
  const supabase = serviceClient();
  const app = await getRegistryApp(supabase, slug);
  if (!app) return notFound();
  const appModule = resolveModule(app);
  if (!appModule) return notFound();
  const basePath = basePathFor(request, slug);

  const token = request.nextUrl.searchParams.get("t");
  if (token) {
    // token.app === path.app — the path is a routing hint, never authz. The
    // exchange still respects visibility/status: a suspended app cannot be
    // entered even with a fresh token.
    const blocked = visibilityGate(app);
    if (blocked) return blocked;
    const claims = verifyToken(token, slug);
    if (!claims) return sessionExpired("This signed link is invalid or has expired.");
    if (!(await redeemOnce(supabase, claims))) {
      return sessionExpired("This signed link was already used.");
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

  const grantId = request.nextUrl.searchParams.get("g");
  if (grantId) {
    // MA4: a share URL redeems into a guest session for exactly this app +
    // resource. Replay against another slug fails the app_id match; the
    // session it mints cannot mint anything broader.
    const blocked = visibilityGate(app);
    if (blocked) return blocked;
    // Guest grants only exist for multiplayer apps — owner-only apps never
    // redeem, even if a grant row exists for them.
    if (app.access !== "multiplayer") {
      return forbidden("this app is not shareable");
    }
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (guestRateLimited(grantId, ip)) {
      return new NextResponse("too many requests", { status: 429 });
    }
    const grant = await redeemGuestGrant(supabase, grantId, app.id);
    if (!grant) return forbidden("this invite is no longer valid");
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
    return response;
  }

  const gate = appModule.publicAccess
    ? await runPublicGateChain(request, supabase, app, basePath)
    : await runGateChain(request, supabase, app, basePath);
  if (!gate.ok) return gate.response;

  return appModule.render({
    request,
    supabase,
    app,
    session: gate.session,
    basePath,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ app: string }> }
): Promise<NextResponse> {
  const { app: slug } = await context.params;
  const supabase = serviceClient();
  const app = await getRegistryApp(supabase, slug);
  if (!app) return notFound();
  const appModule = resolveModule(app);
  if (!appModule) return notFound();
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
  if (!gate.ok) return gate.response;
  if (action === "__password") {
    // Already unlocked — just reload the view.
    return withBaseHeaders(
      NextResponse.redirect(new URL(basePath, externalOrigin(request)), 303)
    );
  }

  if (!appModule.action) return notFound();

  if (
    gate.session.role === "guest" &&
    !(appModule.guestActions ?? []).includes(action)
  ) {
    return forbidden("guests can't do that here");
  }

  return appModule.action(
    { request, supabase, app, session: gate.session, basePath },
    form
  );
}
