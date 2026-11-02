/**
 * HEIC/HEIF → JPEG for identity uploads. iPhones shoot HEIC by default, and
 * the image-generation lane (character sheets) only takes png/jpeg/webp —
 * uploads convert here once, at ingest, so everything downstream (vault,
 * signed previews, generation references) stays a plain JPEG. heic-convert
 * decodes via libheif compiled to WASM: no native binding, runs on any
 * server runtime.
 *
 * Imported lazily: libheif instantiates WASM at module evaluation, which
 * edge runtimes (workerd) forbid via new WebAssembly.Module — a static
 * import would 500 every route in its import graph. The dynamic import
 * confines the failure to actual HEIC decode calls; runtimes without WASM
 * compile still reject, scoped to the one upload/command.
 */
type Convert = (opts: {
  buffer: Uint8Array | ArrayBuffer;
  format: "JPEG" | "PNG";
  quality?: number;
}) => Promise<ArrayBuffer>;

let convertPromise: Promise<Convert> | undefined;

function loadConvert(): Promise<Convert> {
  convertPromise ??= import("heic-convert").then(
    (m) => (m.default ?? m) as unknown as Convert
  );
  return convertPromise;
}

const HEIF_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

/** ISO-BMFF ftyp major brands that mean a HEIF still-image container. */
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

/**
 * Is this upload a HEIF container? Trust the declared type when present,
 * but also sniff the ftyp box — browsers and pickers sometimes hand HEIC
 * bytes over as application/octet-stream or with no type at all.
 */
export function isHeif(contentType: string, bytes?: Buffer): boolean {
  if (HEIF_TYPES.has(contentType.toLowerCase().trim())) return true;
  if (!bytes || bytes.length < 12) return false;
  if (bytes.toString("latin1", 4, 8) !== "ftyp") return false;
  return HEIF_BRANDS.has(bytes.toString("latin1", 8, 12).toLowerCase());
}

/** Decode a HEIF buffer and re-encode as JPEG (metadata does not survive
 * the decode; the jpeg still runs through the media guard afterwards). */
export async function heifToJpeg(bytes: Buffer, quality = 0.9): Promise<Buffer> {
  const convert = await loadConvert();
  const out = await convert({ buffer: bytes, format: "JPEG", quality });
  return Buffer.from(out);
}

/** Decode a HEIF buffer and re-encode as PNG — same decoder, lossless
 * output for lanes that need exact pixels (the /freeze studio's source
 * still). Slower and larger than the JPEG path; use only when the format
 * matters. */
export async function heifToPng(bytes: Buffer): Promise<Buffer> {
  const convert = await loadConvert();
  const out = await convert({ buffer: bytes, format: "PNG" });
  return Buffer.from(out);
}
