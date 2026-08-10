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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Everything here is served by api_server (8642). Dashboard (9119) slices
// need the box's basic-auth credential, which the control plane does not
// hold — do not add dashboard paths without persisting one first.
const ALLOWLIST: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^api\/sessions$/ },
  { method: "GET", pattern: /^api\/sessions\/[A-Za-z0-9_-]+$/ },
  { method: "GET", pattern: /^api\/sessions\/[A-Za-z0-9_-]+\/messages$/ },
  { method: "GET", pattern: /^v1\/skills$/ },
  { method: "GET", pattern: /^v1\/toolsets$/ },
  { method: "GET", pattern: /^api\/mcp\/servers$/ },
  { method: "GET", pattern: /^api\/jobs$/ },
];

function isAllowed(method: string, path: string): boolean {
  return ALLOWLIST.some(
    (entry) => entry.method === method && entry.pattern.test(path)
  );
}

async function handle(
  request: NextRequest,
  params: Promise<{ path: string[] }>
): Promise<NextResponse> {
  const { path } = await params;
  const joined = path.join("/");
  if (!isAllowed(request.method, joined)) {
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
    const upstream = await fetch(
      `${box.target.hostedUrl}/${joined}${search}`,
      {
        method: request.method,
        headers: {
          Authorization: `Bearer ${box.target.apiServerKey}`,
          Cookie: `_port_auth=${box.target.hostedToken}`,
        },
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
