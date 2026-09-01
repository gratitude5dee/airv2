/**
 * Per-box MasterKey MCP proxy. MasterKey's /mcp needs a per-user OAuth token
 * that must never land in a box, so boxes authenticate here with their own
 * GATEWAY_TOKEN (same trust shape as the inference gateway and the Composio
 * proxy) and the request is forwarded with the user's MasterKey token
 * attached server-side. Each box can only ever reach its own user's account
 * and wallet.
 *
 * `run_service` calls are the only tool that moves money, so they pass the
 * control-plane spend gate first (monthly cap + per-call ceiling → 429) and
 * are metered into masterkey_runs / agent_runs (metadata only) afterwards.
 * Every other MCP message (initialize, tools/list, discovery tools, SSE GET)
 * streams straight through.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { serviceClient } from "@/lib/supabase";
import {
  ensureMasterkeyToken,
  forgetMasterkeyToken,
  MasterkeyError,
  parseMcpBody,
  runCostUsd,
  type ToolResult,
} from "@/lib/masterkey/client";
import { checkMasterkeySpend, recordMasterkeyRun } from "@/lib/masterkey/spend";

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

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

interface RunServiceCall {
  id: number | string | null;
  serviceId: string;
  operation: string | null;
}

/** The run_service call in a POST body, if that's what it is. */
function findRunServiceCall(body: string): RunServiceCall | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const messages = (Array.isArray(parsed) ? parsed : [parsed]) as JsonRpcRequest[];
  for (const message of messages) {
    if (message?.method !== "tools/call") continue;
    if (message.params?.name !== "run_service") continue;
    const args = message.params.arguments ?? {};
    const serviceId = args["serviceId"];
    const operation = args["operation"];
    return {
      id: message.id ?? null,
      serviceId: typeof serviceId === "string" ? serviceId : "",
      operation: typeof operation === "string" ? operation : null,
    };
  }
  return null;
}

function jsonRpcError(id: number | string | null, code: number, message: string, status: number): Response {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status }
  );
}

async function proxy(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  const gatewayToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!gatewayToken) return unauthorized();

  const supabase = serviceClient();
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", gatewayToken)
    .maybeSingle();
  if (!box) return unauthorized();
  const userId = box.user_id as string;

  let token: string;
  try {
    ({ token } = await ensureMasterkeyToken(supabase, userId));
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "masterkey mcp proxy: token resolve failed",
        user_id: userId,
        error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      })
    );
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  const headers = new Headers({ authorization: `Bearer ${token}` });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.text() : undefined;
  const run = body ? findRunServiceCall(body) : null;

  if (run) {
    if (!run.serviceId) {
      return jsonRpcError(run.id, -32602, "serviceId is required", 400);
    }
    const verdict = await checkMasterkeySpend(supabase, userId, run.serviceId);
    if (!verdict.ok) {
      return jsonRpcError(run.id, -32000, verdict.message, verdict.status);
    }
  }

  const startedAt = Date.now();
  const upstream = await fetch(`${env.masterkeyOrigin()}/mcp`, {
    method: request.method,
    headers,
    body: body ?? null,
  });
  if (upstream.status === 401) forgetMasterkeyToken(userId);

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  if (!run) {
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  }

  // run_service: buffer the (single) reply so the receipt can be written
  // before it is handed back. Only cost/outcome metadata is kept (C4).
  const text = await upstream.text();
  let ok = false;
  let costUsd: number | null = null;
  let errorCode: string | null = upstream.ok ? null : `http_${upstream.status}`;
  if (upstream.ok) {
    const reply = parseMcpBody(upstream.headers.get("content-type") ?? "", text).find(
      (message) => message.id === run.id
    );
    if (reply?.error) {
      errorCode = "rpc_error";
    } else if (reply?.result) {
      const result = reply.result as ToolResult;
      ok = !result.isError && !result.structuredContent?.["error"];
      costUsd = runCostUsd(result);
      if (!ok) {
        const code = result.structuredContent?.["code"];
        errorCode = typeof code === "string" ? code : "tool_error";
      }
    } else {
      errorCode = "no_reply";
    }
  }
  try {
    await recordMasterkeyRun(supabase, userId, {
      serviceId: run.serviceId,
      operation: run.operation,
      source: "mcp",
      ok,
      costUsd,
      latencyMs: Date.now() - startedAt,
      errorCode,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "masterkey run receipt failed",
        user_id: userId,
        error: error instanceof MasterkeyError || error instanceof Error ? error.message : "unknown",
      })
    );
  }
  return new Response(text, { status: upstream.status, headers: responseHeaders });
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
