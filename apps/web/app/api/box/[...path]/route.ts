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
  StartLimitError,
  type HostedRoute,
} from "@/lib/orchestrator/boxes";
import { dashboardRequestWithRetry } from "@/lib/box/dashboard";
import { openSecret } from "@/lib/crypto/secretbox";
import { env } from "@/lib/env";
import { resolveUpstream } from "@/lib/box/allowlist";
import { getBot } from "@/lib/bots/store";

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

  // V7: /p/<name>/… rides a bot profile — authenticate with THAT profile's
  // key, resolved from the caller's own bots row (the box default key does
  // not open a named profile, and vice versa). No row → 404 before any box
  // traffic happens.
  let profileKey: string | null = null;
  const profileMatch = /^p\/([a-z0-9-]{2,32})\//.exec(joined);
  if (profileMatch?.[1]) {
    const bot = await getBot(supabase, userId, profileMatch[1]);
    if (!bot || bot.status !== "ready") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    profileKey = bot.api_server_key;
  }

  try {
    const box = await ensureBoxAwake(supabase, userId);
    const search = request.nextUrl.search;
    const hasBody =
      request.method === "POST" ||
      request.method === "PUT" ||
      request.method === "PATCH";
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
        ...(requestBody !== undefined ? { body: requestBody } : {}),
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
      const attempt = await dashboardRequestWithRetry(
        supabase,
        box.boxId,
        box.dashboard,
        password,
        (route: HostedRoute, headers: Record<string, string>) =>
          proxyTo(route.url, headers)
      );
      if (attempt.kind === "stale" && attempt.response) {
        // Retry exhausted but the box itself answered — forward its
        // 401/403 verbatim rather than masking it as a gateway error.
        upstream = attempt.response;
      } else if (attempt.kind !== "ok") {
        return NextResponse.json(
          { error: "dashboard login failed" },
          { status: 502 }
        );
      } else {
        upstream = attempt.response;
      }
    } else {
      upstream = await proxyTo(box.target.hostedUrl, {
        Authorization: `Bearer ${profileKey ?? box.target.apiServerKey}`,
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

export async function PATCH(
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
