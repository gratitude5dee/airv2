import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { env } from "../env";

/** The product ships dark until both planes have been configured. */
export function museEnabled(): boolean {
  return env.museEnabled();
}

function equalSecrets(actual: string | null, expected: string | null): boolean {
  if (!actual || !expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

/** Only the Worker can call the private /api/muse service-to-service routes. */
export function hasMuseWorkerToken(request: NextRequest): boolean {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return equalSecrets(bearer, env.museWorkerToken());
}

/** Only this trusted control plane can enqueue a command in the Worker DO. */
export function museInternalToken(): string | null {
  return env.museInternalToken();
}
