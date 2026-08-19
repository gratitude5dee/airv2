/**
 * MA8 enforcement is code, not review: every write path into the public
 * media lane (owner presigned uploads, agent media_publish, icon uploads,
 * Apps API media-upload-url) runs through this guard. Public means public —
 * vault values, transcripts, and mail bodies must never survive a trip
 * through here, and images lose their metadata (EXIF/GPS) on the way in.
 */
import { scrubVaultValues } from "../vault/scrub";

export class MediaGuardError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "MediaGuardError";
    this.status = status;
  }
}

/** MA4: images / video / audio / pdf / txt / json only. No svg (scriptable). */
export const ALLOWED_MEDIA_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/json": "json",
};

/** Hard cap on any single public-media object (agent pulls + uploads). */
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024;

export function allowedMediaType(contentType: string): boolean {
  return Object.hasOwn(ALLOWED_MEDIA_TYPES, contentType.toLowerCase().trim());
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = digits.charCodeAt(i) - 48;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

const SECRET_PATTERNS: RegExp[] = [
  // Private key material
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // TOTP provisioning URIs (vault seeds)
  /otpauth:\/\//i,
  // Common API key shapes
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  // R2/S3 secret access keys are 40 base64-ish chars next to their name
  /(r2|aws|s3)[_-]?secret[_-]?access[_-]?key/i,
];

/**
 * Vault-pattern scrub for text uploads: reject content that looks like a
 * card number (Luhn-valid 13–19 digits), a private key, a TOTP seed, or an
 * API credential — and anything matching a value registered with the
 * process-local vault scrubber.
 */
export function textContainsSecrets(text: string): string | null {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) return "credential-like content";
  }
  const candidates = text.match(/(?:\d[ -]?){13,19}/g) ?? [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      return "card-number-like content";
    }
  }
  if (scrubVaultValues(text) !== text) return "vault value";
  return null;
}

/** JPEG: drop APP1 (EXIF/XMP) and APP13 (IPTC) segments; keep pixel data. */
function stripJpegMetadata(bytes: Buffer): Buffer {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const parts: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    // Start of scan: everything from here is entropy-coded data.
    if (marker === 0xda) {
      parts.push(bytes.subarray(offset));
      break;
    }
    const length = bytes.readUInt16BE(offset + 2);
    const segmentEnd = offset + 2 + length;
    if (segmentEnd > bytes.length) break;
    const isMetadata = marker === 0xe1 || marker === 0xed; // APP1, APP13
    if (!isMetadata) parts.push(bytes.subarray(offset, segmentEnd));
    offset = segmentEnd;
  }
  return Buffer.concat(parts);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_METADATA_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

/** PNG: drop textual/EXIF ancillary chunks; keep everything structural. */
function stripPngMetadata(bytes: Buffer): Buffer {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_MAGIC)) return bytes;
  const parts: Buffer[] = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("latin1");
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) break;
    if (!PNG_METADATA_CHUNKS.has(type)) {
      parts.push(bytes.subarray(offset, chunkEnd));
    }
    offset = chunkEnd;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

/** EXIF strip on images (CC4 approach, control-plane side). */
export function stripImageMetadata(bytes: Buffer, contentType: string): Buffer {
  if (contentType === "image/jpeg") return stripJpegMetadata(bytes);
  if (contentType === "image/png") return stripPngMetadata(bytes);
  return bytes;
}

/**
 * The one gate every R2 write path calls with the full bytes in hand:
 * content-type allowlist → size cap → text scrub → EXIF strip. Returns the
 * (possibly rewritten) bytes to store.
 */
export function guardMediaUpload(
  bytes: Buffer,
  contentType: string,
  options?: { maxBytes?: number }
): Buffer {
  const type = contentType.toLowerCase().trim();
  if (!allowedMediaType(type)) {
    throw new MediaGuardError(`content type not allowed: ${type}`);
  }
  const cap = options?.maxBytes ?? MEDIA_MAX_BYTES;
  if (bytes.length === 0) throw new MediaGuardError("empty upload");
  if (bytes.length > cap) {
    throw new MediaGuardError(`upload exceeds ${cap} bytes`, 413);
  }
  if (type === "text/plain" || type === "text/markdown" || type === "application/json") {
    const reason = textContainsSecrets(bytes.toString("utf8"));
    if (reason) {
      throw new MediaGuardError(`public upload rejected: ${reason}`, 422);
    }
  }
  return stripImageMetadata(bytes, type);
}
