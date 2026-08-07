/**
 * Allowlisted Hermes dashboard proxy (goal.md M7 §4). Allowlist, never
 * denylist: anything not listed returns 404 — including /api/env,
 * /api/ops/*, PUT /api/config, /api/gateway/*, /api/credentials/* (C5).
 * The Box `_token` is appended server-side and never reaches a browser (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { ensureBoxAwake } from "@/lib/orchestrator/boxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
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
