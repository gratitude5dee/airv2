/**
 * Small-door tokens (V13 CF4 / §5.3): candidates that unlock `<slug>-draft`
 * through air-dev for Browser Run, and live tokens the OwnerRoom's
 * WebSocket verifies on its first message. Both are the same
 * `b64url(payload).b64url(sig)` shape as the Vercel side's live-token mint.
 */
import { mintSignedToken, verifySignedToken } from "./sign";

export const CANDIDATE_TTL_S = 600;
export const LIVE_TTL_S = 600;
export const CANDIDATE_HEADER = "x-air-candidate";

export interface CandidateClaims {
  slug: string;
  version: string;
  exp: number;
}

export interface LiveClaims {
  job: string;
  user: string;
  exp: number;
}

/** Minted by the job for the check step only; air-dev verifies the same. */
export async function mintCandidate(
  secret: string,
  slug: string,
  version: string,
  ttlS = CANDIDATE_TTL_S,
  now = Date.now()
): Promise<string> {
  return mintSignedToken(secret, {
    slug,
    version,
    exp: Math.floor(now / 1000) + ttlS,
  });
}

export async function verifyCandidate(
  secret: string,
  token: string,
  slug: string,
  now = Date.now()
): Promise<CandidateClaims | null> {
  const payload = await verifySignedToken(secret, token, { slug }, now);
  if (payload === null) return null;
  const version = payload["version"];
  return typeof version === "string" && version !== ""
    ? { slug, version, exp: Number(payload["exp"]) }
    : null;
}

export async function verifyLive(
  secret: string,
  token: string,
  job: string,
  now = Date.now()
): Promise<LiveClaims | null> {
  const payload = await verifySignedToken(secret, token, { job }, now);
  if (payload === null) return null;
  const user = payload["user"];
  return typeof user === "string" && user !== ""
    ? { job, user, exp: Number(payload["exp"]) }
    : null;
}
