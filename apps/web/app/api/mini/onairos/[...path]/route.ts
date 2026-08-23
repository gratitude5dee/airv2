/**
 * MA9.2 — same-origin relay for the Onairos web SDK. The Onairos API
 * (api2.onairos.uk) sends no CORS headers, so browser calls from our origins
 * are blocked and `initializeApiKey` always failed on the onboarding slide.
 * The SDK bundle is therefore built against this path (scripts/
 * build-onairos-connect.mjs) and the relay forwards each call server-side.
 *
 * Fixed upstream host — never a client-supplied URL (no SSRF surface). The
 * relay carries only what the SDK sent (x-api-key, authorization, JSON
 * bodies); platform cookies are stripped both ways and nothing is logged.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPSTREAM = "https://api2.onairos.uk";

/** Request headers worth relaying: the SDK's key/token/content headers.
 * Cookies and platform session material never cross. */
const FORWARD_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "x-api-key",
  // The SDK's Google/OAuth endpoints branch on the caller platform and
  // attribution — without these /google/authorize can refuse the web flow.
  "x-sdk-platform",
  "x-onairos-utm-source",
];

const FORWARD_RESPONSE_HEADERS = ["content-type"];

async function relay(
  request: NextRequest,
  params: Promise<{ path: string[] }>
): Promise<NextResponse> {
  const { path } = await params;
  const segments = (path ?? []).map((segment) => encodeURIComponent(segment));
  const url = new URL(`${UPSTREAM}/${segments.join("/")}`);
  url.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return NextResponse.json(
      { error: "onairos upstream unreachable" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return relay(request, context.params);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return relay(request, context.params);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return relay(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  return relay(request, context.params);
}
