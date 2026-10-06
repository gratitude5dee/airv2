/**
 * Per-box WZRD Connect MCP proxy (R-CONN-01). Mirrors /api/mcp/composio:
 * boxes authenticate with their per-box GATEWAY_TOKEN; the request is
 * forwarded to connector.wzrd.tech /mcp with the user's runtime token
 * injected server-side — no connector credential ever lands in a box.
 *
 * On top of the composio proxy shape, this route also pins the user's
 * connection alias on execute_action/get_action_guide calls that omit it:
 * `air-<userId>` selects the user's own named connection, so a box can
 * never reach another user's account even if it passes no alias — and a
 * foreign alias fails the worker's allowedConnections check anyway since
 * the token only grants this user's app ids.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { ensureWzrdConnectToken } from "@/lib/wzrdconnect/tokens";
import { wzrdConnectionAlias } from "@/lib/wzrdconnect/slugs";
import { env } from "@/lib/env";
import { guardResponse, requireBox } from "@/lib/auth/guard";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

/** MCP tools whose arguments address a connection by name. */
const CONNECTION_NAME_TOOLS = new Set([
  "execute_action",
  "get_action_guide",
  "proxy_request",
]);

interface JsonRpcCall {
  jsonrpc?: string;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

/**
 * Inject `connectionName: air-<userId>` into tools/call arguments that
 * don't already name a connection. Returns the (possibly rewritten) body —
 * a body that isn't JSON or isn't a tools/call is forwarded untouched.
 */
function injectConnectionAlias(bodyText: string, userId: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
  const calls = Array.isArray(parsed) ? parsed : [parsed];
  let touched = false;
  for (const call of calls) {
    const message = call as JsonRpcCall;
    if (message?.method !== "tools/call") continue;
    const name = message.params?.name;
    if (!name || !CONNECTION_NAME_TOOLS.has(name)) continue;
    const args = message.params?.arguments;
    if (!args || typeof args !== "object") continue;
    if (args["connectionName"] ?? args["alias"]) continue;
    args["connectionName"] = wzrdConnectionAlias(userId);
    touched = true;
  }
  return touched ? JSON.stringify(parsed) : bodyText;
}

async function proxy(request: NextRequest): Promise<Response> {
  const supabase = serviceClient();
  const box = await requireBox(supabase, request).catch(guardResponse);
  if (box instanceof NextResponse) return box;
  const userId = box.userId;
  let token: string;
  try {
    ({ token } = await ensureWzrdConnectToken(supabase, userId));
  } catch (error) {
    log.error("wzrd connect mcp proxy: token resolve failed", {user_id: userId,
        error: error instanceof Error ? error.message.slice(0, 200) : "unknown",});
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  const headers = new Headers({ authorization: `Bearer ${token}` });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Streamable-HTTP servers 406 without the dual accept — real MCP clients
  // send it; fill it in for minimal callers.
  if (!headers.has("accept")) {
    headers.set("accept", "application/json, text/event-stream");
  }

  // Bodies that ride JSON are buffered so the alias injection can rewrite
  // them; streaming bodies pass through untouched.
  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const text = await request.text();
    body = injectConnectionAlias(text, userId);
  }

  const upstream = await fetch(`${env.wzrdConnectOrigin()}/mcp`, {
    method: request.method,
    headers,
    body,
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
