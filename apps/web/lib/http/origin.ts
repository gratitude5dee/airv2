/**
 * Same-origin guard for state-changing requests, ported from OpenInstinct's
 * `isAllowedMutationOrigin` (lib/manager/index.ts). Cookie-authenticated
 * mutations (the vault surface) accept an `Origin` header only when it
 * matches the origin the request itself arrived on — including the
 * proxy-forwarded host Vercel presents — so a cross-site form/fetch cannot
 * ride the session cookie.
 *
 * A missing `Origin` is allowed: server-to-server and non-browser callers
 * (Box, cron) send none, and browsers always attach one to a cross-origin
 * state-changing request.
 */
import type { NextRequest } from "next/server";

export function isAllowedMutationOrigin({
  forwardedHost,
  forwardedProto,
  host,
  origin,
  requestUrl,
}: {
  readonly forwardedHost: string | null;
  readonly forwardedProto: string | null;
  readonly host: string | null;
  readonly origin: string | null;
  readonly requestUrl: string;
}): boolean {
  if (!origin) return true;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const request = new URL(requestUrl);
  const allowedOrigins = new Set([request.origin]);
  const protocol = firstForwardedValue(forwardedProto) ?? request.protocol;

  for (const candidateHost of [forwardedHost, host]) {
    const candidate = firstForwardedValue(candidateHost);
    if (!candidate) continue;
    try {
      allowedOrigins.add(
        new URL(`${normalizeProtocol(protocol)}//${candidate}`).origin
      );
    } catch {
      continue;
    }
  }

  return allowedOrigins.has(parsedOrigin.origin);
}

/** Header-reading wrapper for Next route handlers. */
export function isSameOriginRequest(request: NextRequest): boolean {
  return isAllowedMutationOrigin({
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    requestUrl: request.url,
  });
}

function firstForwardedValue(value: string | null): string | undefined {
  const first = value?.split(",", 1)[0]?.trim();
  return first?.length ? first : undefined;
}

function normalizeProtocol(protocol: string): string {
  return protocol.endsWith(":") ? protocol : `${protocol}:`;
}
