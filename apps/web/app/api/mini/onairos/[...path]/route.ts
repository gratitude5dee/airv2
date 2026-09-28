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
 *
 * R-SEC-06: the relay is authenticated and destination-bound.
 *  - Auth: the onboarding app's API cookie (`mini_api_onboarding`, minted
 *    path-scoped to /api/mini/onairos when the native Onairos slide
 *    renders) or a fresh C15 minted token on `?t=`. Anything else is 401.
 *  - Paths: only the upstream roots the pinned SDK (onairos@8.7.5) calls —
 *    an open relay would let any browser reach arbitrary api2 endpoints
 *    wearing our approved Origin. Anything else is 404.
 *  - Origin/Referer: set server-side from the request host (the mini
 *    origin under the rewrite), never forwarded — the upstream allowlist
 *    matches our domain, not whatever a caller claims.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiCookieName } from "@/lib/miniapps/apps/published";
import { externalOrigin } from "@/lib/miniapps/gates";
import { verifyToken } from "@/lib/miniapps/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPSTREAM = "https://api2.onairos.uk";

/** First path segments the pinned SDK bundle (onairos@8.7.5) addresses on
 * api2.onairos.uk — enumerated from dist/onairos.esm.js, plus the inference
 * endpoints the handoff apiUrl can carry (/inferenceTest, /combined,
 * /getPersona, /traits). New SDK versions re-derive this set. */
const ALLOWED_SEGMENTS = new Set([
  "api", // connectors/, raw-memories/policy, v1/authorize(.compact)
  "approve",
  "auth", // check-session
  "authorize",
  "cancel",
  "combined",
  "connections", // update
  "dev", // validate-apikey
  "email", // pre-verified, verification, verify, verify/confirm
  "facebook",
  "farcaster",
  "gemini-sync",
  "getAPIurlMobile",
  "getAccountInfo",
  "getPersona",
  "github",
  "gmail",
  "google", // authorize, google
  "hosted-import",
  "import",
  "in", // linkedin connector prefix
  "inferenceTest",
  "invalidate-dashboard-cache",
  "linkedin",
  "llm-data",
  "llm-developer",
  "notion",
  "onairos-ascend",
  "onairos-cny",
  "onairos-valentines",
  "persona", // full, train, delete-account, delete-data
  "pinterest",
  "platform-data",
  "reddit",
  "register", // google
  "sdk", // track/error
  "session",
  "store-pin",
  "tiktok",
  "traits",
  "traits-only",
  "traits-only-fast",
  "x",
  "youtube",
]);

/** Request headers worth relaying: the SDK's key/token/content headers.
 * Cookies and platform session material never cross; origin and referer
 * are stamped server-side below. */
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

/** R-SEC-06: the onboarding app's API cookie or a fresh `?t=` link token. */
function authorized(request: NextRequest): boolean {
  const cookie = request.cookies.get(apiCookieName("onboarding"))?.value;
  if (cookie && verifyToken(cookie, "onboarding")) return true;
  const link = request.nextUrl.searchParams.get("t");
  if (link && verifyToken(link, "onboarding")) return true;
  return false;
}

async function relay(
  request: NextRequest,
  params: Promise<{ path: string[] }>
): Promise<NextResponse> {
  const { path } = await params;
  const segments = path ?? [];
  if (
    segments.length === 0 ||
    !ALLOWED_SEGMENTS.has(segments[0] ?? "")
  ) {
    return NextResponse.json(
      { error: "not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  const url = new URL(
    `${UPSTREAM}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`
  );
  url.search = request.nextUrl.search;
  // The C15 token is our auth — never forward it to the upstream.
  url.searchParams.delete("t");
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // Onairos approves browser access per exact origin (Domains dashboard);
  // the relay stamps the page's real origin itself — caller-supplied
  // values never cross (R-SEC-06).
  headers.set("origin", externalOrigin(request));
  headers.set("referer", `${externalOrigin(request)}/`);
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      ...(body ? { body } : {}),
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
