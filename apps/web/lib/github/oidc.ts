/**
 * V11 §10 Lane C, build mode: a repository's own GitHub Actions run pushes
 * its static output to /api/create/push. The run authenticates with the
 * Actions OIDC token (`id-token: write`) requested for our audience — no
 * long-lived secret is ever created for the repo or stored anywhere.
 *
 * Verification is the standard OIDC discipline, done here with node:crypto
 * so no JWT library enters the dependency set: RS256 signature against the
 * issuer's JWKS (cached one hour, refetched once on an unknown `kid`), then
 * `iss`, `aud`, `exp`/`nbf`. The claims that matter afterwards are
 * `repository_id` (which link), `ref` (which branch), `sha` (which commit)
 * and `job_workflow_ref` (which workflow file) — the route checks all four
 * against the link the owner created.
 */
import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";
import { env } from "../env";

export const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const JWKS_TTL_MS = 60 * 60_000;
const CLOCK_SKEW_S = 60;

export class OidcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OidcError";
  }
}

export interface ActionsClaims {
  repository: string;
  repository_id: string;
  repository_owner_id: string;
  ref: string;
  sha: string;
  job_workflow_ref: string;
  run_id: string;
  actor_id: string;
}

interface Jwk extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

interface JwksCache {
  fetchedAt: number;
  keys: Jwk[];
}

let cache: JwksCache | null = null;

export type JwksFetch = () => Promise<Jwk[]>;

async function fetchJwks(): Promise<Jwk[]> {
  let response: Response;
  try {
    response = await fetch(JWKS_URL, {
      headers: { accept: "application/json", "user-agent": "wzrd-create" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new OidcError(
      `jwks unreachable: ${error instanceof Error ? error.message : "fetch failed"}`
    );
  }
  if (!response.ok) throw new OidcError(`jwks ${response.status}`);
  const data = (await response.json()) as { keys?: Jwk[] };
  if (!Array.isArray(data.keys)) throw new OidcError("jwks malformed");
  return data.keys;
}

async function keyFor(kid: string, fetcher: JwksFetch, now: number): Promise<Jwk> {
  if (!cache || now - cache.fetchedAt > JWKS_TTL_MS) {
    cache = { fetchedAt: now, keys: await fetcher() };
  }
  let key = cache.keys.find((k) => k.kid === kid);
  if (!key) {
    // Rotation: refetch once for an unknown kid, never per request.
    cache = { fetchedAt: now, keys: await fetcher() };
    key = cache.keys.find((k) => k.kid === kid);
  }
  if (!key) throw new OidcError("unknown signing key");
  return key;
}

/** Test seam: drop the cached JWKS. */
export function resetJwksCache(): void {
  cache = null;
}

function decodeSegment<T>(segment: string, what: string): T {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch {
    throw new OidcError(`malformed ${what}`);
  }
}

function str(claims: Record<string, unknown>, name: string): string {
  const value = claims[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new OidcError(`missing claim ${name}`);
  }
  return value;
}

/**
 * Verify an Actions OIDC token for our audience and return the claims the
 * push route keys on. Throws OidcError on any defect; the caller maps that
 * to 401 without detail.
 */
export async function verifyActionsToken(
  token: string,
  options: { now?: number; fetchJwks?: JwksFetch; audience?: string } = {}
): Promise<ActionsClaims> {
  const now = options.now ?? Date.now();
  const fetcher = options.fetchJwks ?? fetchJwks;
  const audience = options.audience ?? env.githubOidcAudience();
  const parts = token.split(".");
  if (parts.length !== 3) throw new OidcError("malformed token");
  const [h, p, s] = parts as [string, string, string];
  const header = decodeSegment<{ alg?: unknown; kid?: unknown; typ?: unknown }>(h, "header");
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new OidcError("unsupported token header");
  }
  const jwk = await keyFor(header.kid, fetcher, now);
  if (jwk.kty !== "RSA" || (jwk.alg && jwk.alg !== "RS256")) {
    throw new OidcError("unsupported signing key");
  }
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const valid = createVerify("RSA-SHA256")
    .update(`${h}.${p}`)
    .verify(publicKey, Buffer.from(s, "base64url"));
  if (!valid) throw new OidcError("bad signature");

  const claims = decodeSegment<Record<string, unknown>>(p, "payload");
  if (claims["iss"] !== GITHUB_OIDC_ISSUER) throw new OidcError("wrong issuer");
  const aud = claims["aud"];
  const audOk = Array.isArray(aud) ? aud.includes(audience) : aud === audience;
  if (!audOk) throw new OidcError("wrong audience");
  const nowS = Math.floor(now / 1000);
  const exp = claims["exp"];
  if (typeof exp !== "number" || exp + CLOCK_SKEW_S < nowS) throw new OidcError("expired");
  const nbf = claims["nbf"];
  if (typeof nbf === "number" && nbf - CLOCK_SKEW_S > nowS) throw new OidcError("not yet valid");
  const iat = claims["iat"];
  if (typeof iat === "number" && iat - CLOCK_SKEW_S > nowS) throw new OidcError("issued in the future");

  return {
    repository: str(claims, "repository"),
    repository_id: str(claims, "repository_id"),
    repository_owner_id: str(claims, "repository_owner_id"),
    ref: str(claims, "ref"),
    sha: str(claims, "sha"),
    job_workflow_ref: str(claims, "job_workflow_ref"),
    run_id: str(claims, "run_id"),
    actor_id: str(claims, "actor_id"),
  };
}
