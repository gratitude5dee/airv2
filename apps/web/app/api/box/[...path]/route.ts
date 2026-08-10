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
import { ensureBoxAwake, StartLimitError } from "@/lib/orchestrator/boxes";
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
    let baseUrl: string;
    let headers: Record<string, string>;
    if (upstreamKind === "dashboard") {
      const authKey = env.boxDashboardAuthKey();
      if (!box.dashboard || !box.dashboardAuthSealed || !authKey) {
        return NextResponse.json(
          { error: "dashboard credential unavailable" },
          { status: 503 }
        );
      }
      const password = openSecret(box.dashboardAuthSealed, authKey);
      const basic = Buffer.from(`air:${password}`).toString("base64");
      baseUrl = box.dashboard.url;
      headers = {
        Authorization: `Basic ${basic}`,
        Cookie: `_port_auth=${box.dashboard.token}`,
      };
    } else {
      baseUrl = box.target.hostedUrl;
      headers = {
        Authorization: `Bearer ${box.target.apiServerKey}`,
        Cookie: `_port_auth=${box.target.hostedToken}`,
      };
    }
    const hasBody = request.method === "POST" || request.method === "PUT";
    const upstream = await fetch(
      `${baseUrl}/${joined}${search}`,
      {
        method: request.method,
        headers: hasBody
          ? { ...headers, "Content-Type": "application/json" }
          : headers,
        body: hasBody ? await request.text() : undefined,
      }
    );
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
