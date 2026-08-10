/**
 * AES-256-GCM sealing for secrets the control plane must hold at rest
 * (CM1 task 0 / CC10: the box dashboard basic-auth password). The key is
 * BOX_DASHBOARD_AUTH_KEY, a 64-char hex string; ciphertext is
 * `v1:<iv>:<tag>:<data>` in hex so a future key/format rotation is explicit.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function keyBytes(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) {
    throw new Error("secretbox key must be 32 bytes of hex");
  }
  return key;
}

export function sealSecret(plaintext: string, hexKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(hexKey), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${data.toString("hex")}`;
}

export function openSecret(sealed: string, hexKey: string): string {
  const parts = sealed.split(":");
  const [version, ivHex, tagHex, dataHex] = parts;
  if (parts.length !== 4 || version !== "v1" || !ivHex || !tagHex || !dataHex) {
    throw new Error("unrecognized sealed secret format");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(hexKey),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
