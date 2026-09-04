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

export interface ZipLimits {
  maxZipBytes: number;
  maxUnpackedBytes: number;
  maxFiles: number;
}

const BUNDLE_ZIP_LIMITS: ZipLimits = {
  maxZipBytes: BUNDLE_MAX_ZIP_BYTES,
  maxUnpackedBytes: BUNDLE_MAX_UNPACKED_BYTES,
  maxFiles: BUNDLE_MAX_FILES,
};

/**
 * Parse a zip's central directory into in-memory files. Defaults to the
 * bundle caps; a caller unpacking something larger than a bundle (a whole
 * repository archive, of which only a subtree becomes the bundle) passes
 * its own caps and still runs `validateBundle` on what it keeps.
 */
export function readZip(zip: Buffer, limits: ZipLimits = BUNDLE_ZIP_LIMITS): BundleFile[] {
  const { maxZipBytes, maxUnpackedBytes, maxFiles } = limits;
  if (zip.length > maxZipBytes) {
    throw new BundleError(`bundle exceeds ${maxZipBytes} bytes`, 413);
  }
  const eocd = findEocd(zip);
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  if (count > maxFiles) {
    throw new BundleError(`bundle exceeds ${maxFiles} files`);
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
    if (unpacked > maxUnpackedBytes) {
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
        maxOutputLength: maxUnpackedBytes,
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
const SERVICE_WORKER_RE =
  /["']?serviceworker["']?|navigator\[.{0,40}serviceworker/gi;
// react-dom carries `case "serviceworker":` (a `<link as>` value); that exact
// lowercase literal is never the DOM property, every other spelling counts.
const SERVICE_WORKER_AS_VALUE = /^["']serviceworker["']$/;

export function mentionsServiceWorker(text: string): boolean {
  for (const match of text.matchAll(SERVICE_WORKER_RE)) {
    if (!SERVICE_WORKER_AS_VALUE.test(match[0])) return true;
  }
  return false;
}

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
      if (mentionsServiceWorker(text)) {
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

/** Store validated files at apps/<slug>/<version>/ (the immutable prefix). */
export async function storeBundle(
  slug: string,
  version: string,
  files: BundleFile[]
): Promise<void> {
  for (const file of files) {
    const contentType = bundleContentType(file.path);
    if (!contentType) throw new BundleError(`file type not allowed: ${file.path}`);
    await putObject(bundleKey(slug, version, file.path), file.bytes, contentType);
  }
}
