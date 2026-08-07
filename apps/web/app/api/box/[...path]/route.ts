/**
 * Allowlisted Hermes dashboard proxy (goal.md M7 §4). Allowlist, never
 * denylist: anything not listed returns 404 — including /api/env,
 * /api/ops/*, PUT /api/config, /api/gateway/*, /api/credentials/* (C5).
 * The Box `_token` is appended server-side and never reaches a browser (C3).
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWLIST: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^api\/skills$/ },
  { method: "PUT", pattern: /^api\/skills\/toggle$/ },
  { method: "GET", pattern: /^api\/skills\/hub\/search$/ },
  { method: "POST", pattern: /^api\/skills\/hub\/(install|uninstall|update)$/ },
  { method: "GET", pattern: /^api\/mcp\/servers$/ },
  { method: "GET", pattern: /^api\/mcp\/catalog$/ },
  { method: "GET", pattern: /^api\/cron\/jobs$/ },
  { method: "POST", pattern: /^api\/cron\/jobs$/ },
  { method: "GET", pattern: /^api\/analytics\/usage$/ },
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
  // M7 wires the authenticated per-user proxy to the box's dashboard (9119)
  // here, appending the hosted `_token` server-side.
  return NextResponse.json(
    { error: "proxy not yet provisioned" },
    { status: 503 }
  );
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
