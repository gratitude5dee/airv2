/**
 * Storage key scheme for the creative-assets bucket (CM2). Everything lives
 * under the user's prefix so M8 deletion removes one prefix; masters are
 * content-addressed so identical renders occupy one object.
 */
import { randomBytes } from "node:crypto";

export const ASSETS_BUCKET = "creative-assets";

/**
 * Delivery URL TTL. Meta's container flow polls `status_code` until it
 * leaves IN_PROGRESS and video processing can run minutes; 30 minutes covers
 * worst-case processing plus the retry margin of one sweep cycle, and no
 * more (CC3).
 */
export const DELIVERY_TTL_SECONDS = 30 * 60;

const EXT_PATTERN = /^[a-z0-9]{1,8}$/;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
};

export function normalizeExt(ext: string): string | null {
  const lowered = ext.toLowerCase();
  if (!EXT_PATTERN.test(lowered) || !(lowered in CONTENT_TYPES)) {
    return null;
  }
  return lowered;
}

export function contentType(ext: string): string {
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export function masterKey(userId: string, sha256: string, ext: string): string {
  return `${userId}/masters/${sha256}.${ext}`;
}

export function deliveryKey(userId: string, ext: string): string {
  return `${userId}/deliveries/${randomBytes(16).toString("hex")}.${ext}`;
}

/** The prefix M8 user deletion removes. */
export function userPrefix(userId: string): string {
  return `${userId}/`;
}
