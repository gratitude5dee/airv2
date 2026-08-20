/**
 * MA3 bundle pipeline: a published app is a zip of static files, nothing
 * else. Server-side validation (25 MB zip cap, per-file extension allowlist,
 * uncompressed-size cap against zip bombs, no service workers, no publisher
 * <meta http-equiv> CSP overrides), then unpack to apps/<slug>/<version>/ on
 * the platform bucket. No publisher server code, ever (MA3 invariant).
 *
 * The zip reader is deliberately minimal: central-directory walk +
 * inflateRawSync — no dependency, no symlinks, no zip64.
 */
import { inflateRawSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { putObject } from "../storage/r2";
import {
  BUNDLE_MAX_ZIP_BYTES,
  BUNDLE_MAX_UNPACKED_BYTES,
  BUNDLE_MAX_FILES,
} from "./bundleLimits";

export class BundleError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BundleError";
    this.status = status;
  }
}

export {
  BUNDLE_MAX_ZIP_BYTES,
  BUNDLE_MAX_UNPACKED_BYTES,
  BUNDLE_MAX_FILES,
} from "./bundleLimits";

/** Static-only allowlist. No svg (scriptable), no wasm, no source maps. */
const EXTENSION_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function bundleContentType(path: string): string | null {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return null;
  return EXTENSION_TYPES[path.slice(dot + 1).toLowerCase()] ?? null;
}

export interface BundleFile {
  path: string;
  bytes: Buffer;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

function findEocd(zip: Buffer): number {
  const min = Math.max(0, zip.length - 65557);
  for (let i = zip.length - 22; i >= min; i -= 1) {
    if (zip.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new BundleError("not a zip file");
}

/** Parse a zip's central directory into in-memory files. */
export function readZip(zip: Buffer): BundleFile[] {
  if (zip.length > BUNDLE_MAX_ZIP_BYTES) {
    throw new BundleError(`bundle exceeds ${BUNDLE_MAX_ZIP_BYTES} bytes`, 413);
  }
  const eocd = findEocd(zip);
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  if (count > BUNDLE_MAX_FILES) {
    throw new BundleError(`bundle exceeds ${BUNDLE_MAX_FILES} files`);
  }
  const files: BundleFile[] = [];
  let unpacked = 0;
  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > zip.length || zip.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new BundleError("corrupt zip central directory");
    }
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue; // directory entry
    unpacked += uncompressedSize;
    if (unpacked > BUNDLE_MAX_UNPACKED_BYTES) {
      throw new BundleError("bundle unpacks too large", 413);
    }
    if (localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw new BundleError("corrupt zip local header");
    }
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    let bytes: Buffer;
    if (method === 0) {
      bytes = Buffer.from(data);
    } else if (method === 8) {
      bytes = inflateRawSync(data, {
        maxOutputLength: BUNDLE_MAX_UNPACKED_BYTES,
      });
    } else {
      throw new BundleError(`unsupported compression method in ${name}`);
    }
    if (bytes.length !== uncompressedSize) {
      throw new BundleError(`size mismatch in ${name}`);
    }
    files.push({ path: name, bytes });
  }
  return files;
}

const SAFE_PATH = /^[a-zA-Z0-9_][a-zA-Z0-9._/-]*$/;
const META_CSP_RE =
  /<meta[^>]+http-equiv\s*=\s*["']?content-security-policy/i;
const SERVICE_WORKER_RE = /serviceWorker|navigator\[.{0,40}serviceWorker/i;

/**
 * Validate an unpacked bundle: safe relative paths, allowlisted extensions,
 * an index.html at the root, no service-worker registration anywhere, and no
 * publisher CSP overrides (the loader's CSP is the contract).
 */
export function validateBundle(files: BundleFile[]): void {
  if (files.length === 0) throw new BundleError("empty bundle");
  let hasIndex = false;
  for (const file of files) {
    if (
      !SAFE_PATH.test(file.path) ||
      file.path.includes("..") ||
      file.path.startsWith("/")
    ) {
      throw new BundleError(`unsafe path in bundle: ${file.path}`);
    }
    const contentType = bundleContentType(file.path);
    if (!contentType) {
      throw new BundleError(`file type not allowed: ${file.path}`);
    }
    if (file.path === "index.html") hasIndex = true;
    const isText =
      contentType.startsWith("text/") || contentType === "application/json";
    if (isText) {
      const text = file.bytes.toString("utf8");
      if (SERVICE_WORKER_RE.test(text)) {
        throw new BundleError(
          `service workers are not allowed (${file.path})`
        );
      }
      if (contentType.startsWith("text/html") && META_CSP_RE.test(text)) {
        throw new BundleError(
          `bundle may not override the content security policy (${file.path})`
        );
      }
    }
  }
  if (!hasIndex) throw new BundleError("bundle must contain index.html");
}

export function bundleKey(slug: string, version: string, path: string): string {
  return `apps/${slug}/${version}/${path}`;
}

/**
 * Validate + upload a zip for an owned draft/published app, then point the
 * registry row at the new immutable version.
 */
export async function uploadBundle(
  supabase: SupabaseClient,
  appId: string,
  slug: string,
  zip: Buffer
): Promise<string> {
  const files = readZip(zip);
  validateBundle(files);
  const version = `v${Date.now()}`;
  for (const file of files) {
    const contentType = bundleContentType(file.path);
    if (!contentType) throw new BundleError(`file type not allowed: ${file.path}`);
    await putObject(bundleKey(slug, version, file.path), file.bytes, contentType);
  }
  const { error } = await supabase
    .from("mini_apps")
    .update({ bundle_version: version, updated_at: new Date().toISOString() })
    .eq("id", appId);
  if (error) throw new Error(`bundle version update failed: ${error.message}`);
  console.log(
    JSON.stringify({ msg: "miniapp bundle uploaded", slug, version, files: files.length })
  );
  return version;
}
