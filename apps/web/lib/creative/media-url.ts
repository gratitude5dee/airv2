/**
 * SSRF gate for provider-returned media URLs, ported from outsideairworker
 * src/media-url.ts. HTTPS only, no credentials, no non-443 ports, no IP
 * literals or internal hostnames, host allowlist from GMI_MEDIA_HOSTS plus
 * the built-in storage.googleapis.com. Redirects are validated hop by hop
 * and the download never re-follows a redirect chain after validation.
 */
import { env } from "../env";

const normalizedHost = (hostname: string): string =>
  hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

const isIpv4 = (host: string): boolean => {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }
  const octets = parts.map(Number);
  return octets.every((octet) => octet <= 255);
};

const isPrivateHost = (host: string): boolean => {
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    // Literal IPs are never a valid GMI/CDN media origin. Rejecting all of
    // them also eliminates DNS rebinding and private-range ambiguity.
    isIpv4(host)
  ) {
    return true;
  }
  // Literal IPv6 addresses are never a valid GMI/CDN media origin.
  return host.includes(":");
};

const isValidDnsHostname = (host: string): boolean =>
  host.length <= 253 &&
  host.includes(".") &&
  host
    .split(".")
    .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;
const GENERATED_MEDIA_DOWNLOAD_TIMEOUT_MS = 60_000;
export const MAX_GENERATED_MEDIA_BYTES = 100 * 1024 * 1024;

/**
 * GMI's image model delivers through Google Cloud Storage; fal (the /zap
 * lane) delivers through fal.media subdomains.
 */
const BUILTIN_MEDIA_HOSTS = ["storage.googleapis.com", "fal.media"] as const;

export const generatedMediaHosts = (): readonly string[] => [
  ...BUILTIN_MEDIA_HOSTS,
  ...env.gmiMediaHosts(),
];

type RedirectFetcher = (input: string, init: RequestInit) => Promise<Response>;

export interface FetchedGeneratedMedia {
  bytes: Buffer;
  mimeType: string;
  url: string;
}

/** Validates a GMI/CDN hostname before it is placed in the runtime allowlist. */
export const assertSafeGeneratedMediaHost = (value: string): string => {
  const host = normalizedHost(value);
  if (!host || !isValidDnsHostname(host) || isPrivateHost(host)) {
    throw new Error("Generated media host is not a safe public DNS hostname");
  }
  return host;
};

export const assertSafeGeneratedMediaUrl = (
  value: string,
  allowedHosts: readonly string[] = generatedMediaHosts()
): string => {
  if (allowedHosts.length === 0) {
    throw new Error("Generated media URL requires GMI_MEDIA_HOSTS");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Generated media URL is invalid");
  }

  let host: string;
  try {
    host = assertSafeGeneratedMediaHost(url.hostname);
  } catch {
    throw new Error("Generated media URL is not a safe HTTPS origin");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("Generated media URL is not a safe HTTPS origin");
  }
  if (
    !allowedHosts.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    )
  ) {
    throw new Error("Generated media URL is outside GMI_MEDIA_HOSTS");
  }
  return url.toString();
};

const mimeTypeFromUrl = (
  url: string,
  kind: "image" | "video"
): string | undefined => {
  const extension = new URL(url).pathname.split(".").at(-1)?.toLowerCase();
  const byExtension: Record<string, string> = {
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heic",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    mov: "video/quicktime",
    mp4: "video/mp4",
    png: "image/png",
    webp: "image/webp",
  };
  const mimeType = extension ? byExtension[extension] : undefined;
  return mimeType?.startsWith(`${kind}/`) ? mimeType : undefined;
};

const mimeTypeForResponse = (
  response: Response,
  url: string,
  kind: "image" | "video"
): string => {
  const header = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  const allowedMimeTypes =
    kind === "image"
      ? new Set(["image/gif", "image/heic", "image/jpeg", "image/png", "image/webp"])
      : new Set(["video/mp4", "video/quicktime"]);
  if (header && allowedMimeTypes.has(header)) {
    return header;
  }
  const inferred = mimeTypeFromUrl(url, kind);
  if (inferred) {
    return inferred;
  }
  throw new Error("Generated media response has no usable MIME type");
};

/**
 * Magic-number check so provider-declared typing is never trusted end to
 * end: the delivered bytes must actually start like the MIME they claim.
 */
const bytesMatchMimeType = (bytes: Buffer, mimeType: string): boolean => {
  const startsWith = (offset: number, ...values: number[]): boolean =>
    values.every((byte, index) => bytes[offset + index] === byte);
  switch (mimeType) {
    case "image/png":
      return startsWith(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/jpeg":
      return startsWith(0, 0xff, 0xd8, 0xff);
    case "image/gif":
      return startsWith(0, 0x47, 0x49, 0x46, 0x38);
    case "image/webp":
      return startsWith(0, 0x52, 0x49, 0x46, 0x46) && startsWith(8, 0x57, 0x45, 0x42, 0x50);
    case "image/heic":
    case "video/mp4":
    case "video/quicktime":
      // ISO BMFF: an 'ftyp' box at offset 4.
      return startsWith(4, 0x66, 0x74, 0x79, 0x70);
    default:
      return false;
  }
};

const readResponseAtMost = async (response: Response): Promise<Buffer> => {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength) {
    const length = Number(declaredLength);
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_GENERATED_MEDIA_BYTES
    ) {
      throw new Error("Generated media is too large to deliver");
    }
  }

  if (!response.body) {
    throw new Error("Generated media response has no body");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!(value instanceof Uint8Array)) {
        throw new Error("Generated media response returned invalid bytes");
      }
      total += value.byteLength;
      if (total > MAX_GENERATED_MEDIA_BYTES) {
        await reader.cancel("Generated media is too large to deliver");
        throw new Error("Generated media is too large to deliver");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) {
    throw new Error("Generated media response is empty");
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    total
  );
};

/**
 * Downloads the exact bytes to deliver. Unlike URL attachment builders, this
 * never performs a second redirect-following fetch after the allowlist check,
 * preventing a redirect TOCTOU escape.
 */
export const fetchSafeGeneratedMedia = async (
  value: string,
  kind: "image" | "video",
  allowedHosts: readonly string[] = generatedMediaHosts(),
  fetcher: RedirectFetcher = (input, init) => fetch(input, init)
): Promise<FetchedGeneratedMedia> => {
  const deadline = Date.now() + GENERATED_MEDIA_DOWNLOAD_TIMEOUT_MS;
  let current = assertSafeGeneratedMediaUrl(value, allowedHosts);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error("Generated media download timed out");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remaining);
    let response: Response;
    try {
      response = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Generated media download timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      void response.body?.cancel().catch(() => undefined);
      if (redirects === MAX_REDIRECTS) {
        throw new Error("Generated media URL exceeded redirect limit");
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Generated media URL redirect has no location");
      }
      current = assertSafeGeneratedMediaUrl(
        new URL(location, current).toString(),
        allowedHosts
      );
      continue;
    }
    if (!response.ok) {
      throw new Error(`Generated media download failed (${response.status})`);
    }
    const mimeType = mimeTypeForResponse(response, current, kind);
    const bytes = await readResponseAtMost(response);
    if (!bytesMatchMimeType(bytes, mimeType)) {
      throw new Error("Generated media bytes do not match their MIME type");
    }
    return { bytes, mimeType, url: current };
  }

  throw new Error("Generated media URL exceeded redirect limit");
};
