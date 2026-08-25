/**
 * Per-box Composio MCP proxy (goal.md §7.3). Composio's tool-router MCP
 * endpoint requires the org API key on every request, and that key must
 * never land in a box. Boxes authenticate here with their per-box
 * GATEWAY_TOKEN (same trust shape as the inference gateway); the request is
 * forwarded to that user's own session endpoint with the key injected
 * server-side, so each box can only ever reach its own user's session.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { serviceClient } from "@/lib/supabase";
import { ensureComposioSession } from "@/lib/provisioning/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** MCP streamable-HTTP headers the client legitimately controls. */
const FORWARDED_REQUEST_HEADERS = [
  "content-type",
  "accept",
  "mcp-session-id",
  "mcp-protocol-version",
  "last-event-id",
] as const;

const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "mcp-session-id",
  "mcp-protocol-version",
] as const;

async function proxy(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return unauthorized();

  const supabase = serviceClient();
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (!box) return unauthorized();
  const userId = box.user_id as string;

  let mcpUrl: string;
  try {
    ({ mcpUrl } = await ensureComposioSession(supabase, userId));
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "composio mcp proxy: session resolve failed",
        user_id: userId,
        error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      })
    );
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  const headers = new Headers({ "x-api-key": env.composioApiKey() });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const upstream = await fetch(mcpUrl, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    // @ts-expect-error duplex is required by undici for streaming bodies
    duplex: "half",
  });

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  return proxy(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return proxy(request);
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return proxy(request);
}
