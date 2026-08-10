/**
 * Allowlisted Hermes dashboard proxy (goal.md M7 §4). Allowlist, never
 * denylist: anything not listed returns 404 — including /api/env,
 * /api/ops/*, PUT /api/config, /api/gateway/*, /api/credentials/* (C5).
 * The Box `_token` is appended server-side and never reaches a browser (C3).
 *
 * Both surfaces share this proxy: the browser authenticates with the session
 * cookie, the desktop app with its scoped device token, so History and Skills
 * read the same box state on either.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import {
  ensureBoxAwake,
  refreshDashboardRoute,
  StartLimitError,
  type HostedRoute,
} from "@/lib/orchestrator/boxes";
import { openSecret } from "@/lib/crypto/secretbox";
import { env } from "@/lib/env";
import { resolveUpstream } from "@/lib/box/allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(
  request: NextRequest,
  params: Promise<{ path: string[] }>
): Promise<NextResponse> {
  const { path } = await params;
  const joined = path.join("/");
  const upstreamKind = resolveUpstream(request.method, joined);
  if (!upstreamKind) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.userId;
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const search = request.nextUrl.search;
    const hasBody = request.method === "POST" || request.method === "PUT";
    const requestBody = hasBody ? await request.text() : undefined;

    const proxyTo = async (
      baseUrl: string,
      headers: Record<string, string>
    ): Promise<Response> =>
      fetch(`${baseUrl}/${joined}${search}`, {
        method: request.method,
        headers: hasBody
          ? { ...headers, "Content-Type": "application/json" }
          : headers,
        body: requestBody,
      });

    let upstream: Response;
    if (upstreamKind === "dashboard") {
      const authKey = env.boxDashboardAuthKey();
      if (!box.dashboard || !box.dashboardAuthSealed || !authKey) {
        return NextResponse.json(
          { error: "dashboard credential unavailable" },
          { status: 503 }
        );
      }
      const password = openSecret(box.dashboardAuthSealed, authKey);
      // Dashboard auth is a password-login flow, not an Authorization
      // header: POST /auth/password-login verifies the credential and
      // mints hermes_session_* cookies that gate every protected route.
      // The cookies stay in this handler's memory — never forwarded to
      // the client (C3).
      const dashboardAttempt = async (
        route: HostedRoute
      ): Promise<Response | null> => {
        const login = await fetch(`${route.url}/auth/password-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `_port_auth=${route.token}`,
          },
          body: JSON.stringify({
            provider: "basic",
            username: "air",
            password,
          }),
        });
        if (!login.ok) return null;
        const sessionCookies = login.headers
          .getSetCookie()
          .map((cookie) => cookie.split(";")[0])
          .join("; ");
        if (!sessionCookies) return null;
        return proxyTo(route.url, {
          Cookie: `_port_auth=${route.token}; ${sessionCookies}`,
        });
      };
      let attempt = await dashboardAttempt(box.dashboard);
      // The hosted _token rotates on resume and the wake path refreshes the
      // dashboard route only in the background — on a stale-token rejection,
      // re-register the route synchronously and retry once.
      if (!attempt || attempt.status === 401 || attempt.status === 403) {
        const fresh = await refreshDashboardRoute(supabase, box.boxId);
        if (fresh) {
          attempt = (await dashboardAttempt(fresh)) ?? attempt;
        }
      }
      if (!attempt) {
        return NextResponse.json(
          { error: "dashboard login failed" },
          { status: 502 }
        );
      }
      upstream = attempt;
    } else {
      upstream = await proxyTo(box.target.hostedUrl, {
        Authorization: `Bearer ${box.target.apiServerKey}`,
        Cookie: `_port_auth=${box.target.hostedToken}`,
      });
    }
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json(
        { error: "start_limit_reached" },
        { status: 429 }
      );
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "box proxy failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "proxy failed" }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return handle(request, context.params);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return handle(request, context.params);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return handle(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return handle(request, context.params);
}
