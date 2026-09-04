/**
 * GitHub Actions OIDC verification for /api/create/push: signature against
 * the issuer JWKS, then iss/aud/exp/nbf, then the claims the route keys on.
 * Every defect is an OidcError (the route answers 401 without detail).
 */
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GITHUB_OIDC_ISSUER,
  OidcError,
  resetJwksCache,
  verifyActionsToken,
  type JwksFetch,
} from "./oidc";

const NOW = 1_800_000_000_000;
const NOW_S = NOW / 1000;

function keyPair(kid: string): { kid: string; privateKey: KeyObject; jwk: Record<string, unknown> } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    kid,
    privateKey,
    jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" },
  };
}

const primary = keyPair("kid-1");
const rotated = keyPair("kid-2");

const CLAIMS = {
  iss: GITHUB_OIDC_ISSUER,
  aud: "wzrd-create",
  iat: NOW_S - 30,
  nbf: NOW_S - 30,
  exp: NOW_S + 300,
  repository: "alice/site",
  repository_id: "123",
  repository_owner_id: "77",
  ref: "refs/heads/main",
  sha: "a".repeat(40),
  job_workflow_ref: "alice/site/.github/workflows/wzrd-create.yml@refs/heads/main",
  run_id: "999",
  actor_id: "77",
};

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function sign(
  claims: Record<string, unknown>,
  options: { key?: KeyObject; kid?: string; alg?: string } = {}
): string {
  const header = b64url(JSON.stringify({ alg: options.alg ?? "RS256", typ: "JWT", kid: options.kid ?? primary.kid }));
  const payload = b64url(JSON.stringify(claims));
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(options.key ?? primary.privateKey);
  return `${header}.${payload}.${b64url(signature)}`;
}

let jwks: ReturnType<typeof vi.fn<JwksFetch>>;

beforeEach(() => {
  resetJwksCache();
  jwks = vi.fn<JwksFetch>(async () => [primary.jwk]);
});

async function verify(token: string, extra: { now?: number; audience?: string } = {}) {
  return verifyActionsToken(token, { now: NOW, fetchJwks: jwks, audience: "wzrd-create", ...extra });
}

describe("verifyActionsToken", () => {
  it("returns the routing claims for a good token", async () => {
    const claims = await verify(sign(CLAIMS));
    expect(claims).toEqual({
      repository: "alice/site",
      repository_id: "123",
      repository_owner_id: "77",
      ref: "refs/heads/main",
      sha: "a".repeat(40),
      job_workflow_ref: "alice/site/.github/workflows/wzrd-create.yml@refs/heads/main",
      run_id: "999",
      actor_id: "77",
    });
  });

  it("accepts aud as an array containing ours", async () => {
    await expect(verify(sign({ ...CLAIMS, aud: ["other", "wzrd-create"] }))).resolves.toBeTruthy();
  });

  it("caches the JWKS across calls", async () => {
    await verify(sign(CLAIMS));
    await verify(sign(CLAIMS));
    expect(jwks).toHaveBeenCalledTimes(1);
  });

  it("refetches once for an unknown kid (rotation), then fails if still unknown", async () => {
    jwks.mockResolvedValueOnce([primary.jwk]).mockResolvedValueOnce([primary.jwk, rotated.jwk]);
    await verify(sign(CLAIMS));
    await expect(
      verify(sign(CLAIMS, { key: rotated.privateKey, kid: rotated.kid }))
    ).resolves.toBeTruthy();
    expect(jwks).toHaveBeenCalledTimes(2);

    resetJwksCache();
    jwks.mockResolvedValue([primary.jwk]);
    await expect(verify(sign(CLAIMS, { kid: "kid-never" }))).rejects.toThrow(/unknown signing key/);
    expect(jwks).toHaveBeenCalledTimes(4);
  });

  it("rejects a signature from another key under a known kid", async () => {
    await expect(verify(sign(CLAIMS, { key: rotated.privateKey, kid: primary.kid }))).rejects.toThrow(
      /bad signature/
    );
  });

  it("rejects a tampered payload", async () => {
    const [h, , s] = sign(CLAIMS).split(".") as [string, string, string];
    const forged = b64url(JSON.stringify({ ...CLAIMS, repository_id: "666" }));
    await expect(verify(`${h}.${forged}.${s}`)).rejects.toThrow(/bad signature/);
  });

  it.each([
    ["alg none", { alg: "none" }],
    ["HS256", { alg: "HS256" }],
  ])("rejects %s", async (_label, options) => {
    await expect(verify(sign(CLAIMS, options))).rejects.toThrow(/unsupported token header/);
  });

  it("rejects a header without kid", async () => {
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = b64url(JSON.stringify(CLAIMS));
    const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(primary.privateKey);
    await expect(verify(`${header}.${payload}.${b64url(signature)}`)).rejects.toThrow(
      /unsupported token header/
    );
  });

  it.each(["", "a.b", "a.b.c.d", "not-a-jwt"])("rejects malformed token %j", async (token) => {
    await expect(verify(token)).rejects.toBeInstanceOf(OidcError);
  });

  it("rejects the wrong issuer", async () => {
    await expect(verify(sign({ ...CLAIMS, iss: "https://evil.example" }))).rejects.toThrow(
      /wrong issuer/
    );
  });

  it("rejects the wrong audience", async () => {
    await expect(verify(sign({ ...CLAIMS, aud: "someone-else" }))).rejects.toThrow(/wrong audience/);
    await expect(verify(sign(CLAIMS), { audience: "other" })).rejects.toThrow(/wrong audience/);
  });

  it("rejects expired tokens beyond 60s skew, accepts inside it", async () => {
    await expect(verify(sign({ ...CLAIMS, exp: NOW_S - 61 }))).rejects.toThrow(/expired/);
    await expect(verify(sign({ ...CLAIMS, exp: NOW_S - 59 }))).resolves.toBeTruthy();
    await expect(verify(sign({ ...CLAIMS, exp: "soon" }))).rejects.toThrow(/expired/);
  });

  it("rejects nbf/iat in the future beyond skew", async () => {
    await expect(verify(sign({ ...CLAIMS, nbf: NOW_S + 61 }))).rejects.toThrow(/not yet valid/);
    await expect(verify(sign({ ...CLAIMS, iat: NOW_S + 61 }))).rejects.toThrow(/issued in the future/);
  });

  it("rejects a token missing a routing claim", async () => {
    const { job_workflow_ref: _omit, ...rest } = CLAIMS;
    await expect(verify(sign(rest))).rejects.toThrow(/missing claim job_workflow_ref/);
    await expect(verify(sign({ ...CLAIMS, repository_id: 123 }))).rejects.toThrow(
      /missing claim repository_id/
    );
  });
});
