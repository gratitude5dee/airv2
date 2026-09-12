/**
 * Coinbase CDP request JWTs for Advanced Trade. Two key shapes are
 * supported because CDP issues both:
 *  - Ed25519 keys created at portal.coinbase.com: the secret is a
 *    base64-encoded raw Ed25519 key (64 bytes: seed ‖ public key). Node's
 *    crypto needs a PKCS8 wrapper, so the 32-byte seed is re-armored.
 *  - Legacy retail keys: an EC P-256 PEM ("BEGIN EC PRIVATE KEY"), signed
 *    ES256 with the DER signature transcoded to the raw r‖s form JWS wants.
 * Tokens live 120s and are minted per request — never stored.
 */
import { createPrivateKey, createSign, sign as signEd } from "node:crypto";
import { randomBytes } from "node:crypto";

const TOKEN_TTL_SECONDS = 120;
/** PKCS8 header for a raw Ed25519 seed (RFC 8410). */
const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

function base64url(data: Buffer | string): string {
  return Buffer.from(data).toString("base64url");
}

function looksLikePem(secret: string): boolean {
  return secret.includes("-----BEGIN");
}

function ed25519Key(rawSecret: string): ReturnType<typeof createPrivateKey> {
  const raw = Buffer.from(rawSecret.trim(), "base64");
  if (raw.length === 64) {
    const seed = raw.subarray(0, 32);
    const der = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
    return createPrivateKey({
      key: der,
      format: "der",
      type: "pkcs8",
    });
  }
  if (raw.length === 32) {
    const der = Buffer.concat([ED25519_PKCS8_PREFIX, raw]);
    return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  }
  // Some CDP exports already ship PEM/DER text; try it verbatim.
  try {
    return createPrivateKey(rawSecret);
  } catch {
    throw new Error("That Coinbase key secret is not a recognized format.");
  }
}

/** DER (ECDSA) → raw 64-byte r‖s for JWS ES256. */
function derToRaw(signature: Buffer): Buffer {
  // Minimal ASN.1 walk: SEQ(0x30) len INT(0x02) r-len r INT(0x02) s-len s
  let offset = 2;
  const readInt = (): Buffer => {
    if (signature[offset] !== 0x02) throw new Error("bad ECDSA signature");
    offset += 1;
    const len = signature[offset] ?? 0;
    offset += 1;
    let bytes = signature.subarray(offset, offset + len);
    offset += len;
    if (bytes.length > 32) bytes = bytes.subarray(bytes.length - 32);
    return bytes;
  };
  const r = readInt();
  const s = readInt();
  return Buffer.concat([
    Buffer.concat([Buffer.alloc(Math.max(0, 32 - r.length)), r]),
    Buffer.concat([Buffer.alloc(Math.max(0, 32 - s.length)), s]),
  ]);
}

export function mintCdpJwt(input: {
  keyId: string;
  keySecret: string;
  method: "GET" | "POST";
  host: string;
  path: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: looksLikePem(input.keySecret) ? "ES256" : "EdDSA",
    kid: input.keyId,
    nonce: randomBytes(12).toString("hex"),
    typ: "JWT",
  };
  const payload = {
    aud: ["retail_rest_api_proxy"],
    exp: now + TOKEN_TTL_SECONDS,
    iss: "cdp",
    nbf: now,
    sub: input.keyId,
    uris: [`${input.method} ${input.host}${input.path}`],
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload),
  )}`;
  if (looksLikePem(input.keySecret)) {
    const der = createSign("sha256")
      .update(signingInput)
      .sign(createPrivateKey(input.keySecret));
    return `${signingInput}.${base64url(derToRaw(der))}`;
  }
  const signature = signEd(null, Buffer.from(signingInput), ed25519Key(input.keySecret));
  return `${signingInput}.${base64url(signature)}`;
}
