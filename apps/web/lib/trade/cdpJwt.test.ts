import { describe, expect, it } from "vitest";
import { createPrivateKey, generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { mintCdpJwt } from "./cdpJwt";

function decode(segment: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(segment, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

describe("mintCdpJwt", () => {
  it("signs Ed25519 keys (base64 32-byte seed) with the uri claim", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" });
    // PKCS8: last 32 bytes are the seed.
    const seed = pkcs8.subarray(pkcs8.length - 32);
    const keySecret = Buffer.from(seed).toString("base64");

    const jwt = mintCdpJwt({
      keyId: "organizations/test-org/apiKeys/test-key",
      keySecret,
      method: "GET",
      host: "api.coinbase.com",
      path: "/api/v3/brokerage/accounts",
    });
    const [header, payload, signature] = jwt.split(".");
    expect(header).toBeTruthy();
    expect(payload).toBeTruthy();
    expect(signature).toBeTruthy();
    const head = decode(header!);
    expect(head["alg"]).toBe("EdDSA");
    expect(head["kid"]).toBe("organizations/test-org/apiKeys/test-key");
    const body = decode(payload!);
    expect(body["iss"]).toBe("cdp");
    expect(body["sub"]).toBe("organizations/test-org/apiKeys/test-key");
    expect(body["uris"]).toEqual([
      "GET api.coinbase.com/api/v3/brokerage/accounts",
    ]);
    // Signature verifies against the key we generated.
    const key = createPrivateKey({
      key: privateKey.export({ format: "pem", type: "pkcs8" }),
    });
    const signed = nodeSign(null, Buffer.from(`${header}.${payload}`), key);
    expect(Buffer.from(signature!, "base64url").equals(signed)).toBe(true);
  });

  it("signs PEM EC keys with ES256", () => {
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const jwt = mintCdpJwt({
      keyId: "key-1",
      keySecret: pem,
      method: "POST",
      host: "api.coinbase.com",
      path: "/api/v3/brokerage/orders",
    });
    const [header, payload] = jwt.split(".");
    expect(decode(header!)["alg"]).toBe("ES256");
    expect(decode(payload!)["uris"]).toEqual([
      "POST api.coinbase.com/api/v3/brokerage/orders",
    ]);
  });
});
