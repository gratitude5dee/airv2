/**
 * Browser-side zip writer for the Create surface's folder Drop (V11 §8.1):
 * a picked folder becomes one bundle zip the same route accepts from a file
 * picker. Plain Uint8Array/DataView — no Buffer, no dependency. Entries are
 * deflated through CompressionStream when the browser has it, else stored;
 * readZip (lib/miniapps/bundles.ts) accepts both.
 */

export interface ZipEntry {
  path: string;
  bytes: Uint8Array;
}

const SKIPPED_SEGMENT = /^(\.|node_modules$|__MACOSX$)/;

/**
 * Folder pickers report paths as `<folder>/<rest>`; the bundle wants
 * `<rest>` with index.html at the root. Hidden entries and dependency
 * folders never belong in a bundle.
 */
export function bundlePathFor(relativePath: string): string | null {
  const segments = relativePath.split("/").filter(Boolean);
  const rest = segments.length > 1 ? segments.slice(1) : segments;
  if (rest.length === 0 || rest.some((s) => SKIPPED_SEGMENT.test(s))) {
    return null;
  }
  return rest.join("/");
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    return out.length < bytes.length ? out : null;
  } catch {
    return null;
  }
}

export async function writeZip(entries: ZipEntry[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const deflated = await deflateRaw(entry.bytes);
    const payload = deflated ?? entry.bytes;
    const method = deflated ? 8 : 0;
    const crc = crc32(entry.bytes);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, payload.length, true);
    lv.setUint32(22, entry.bytes.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, payload.length, true);
    cv.setUint32(24, entry.bytes.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, payload);
    centrals.push(central);
    offset += local.length + payload.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...locals, ...centrals, eocd] as BlobPart[], {
    type: "application/zip",
  });
}

/** Zip a folder picked through `<input type="file" webkitdirectory>`. */
export async function zipFolder(files: Iterable<File>): Promise<Blob> {
  const entries: ZipEntry[] = [];
  for (const file of files) {
    const path = bundlePathFor(file.webkitRelativePath || file.name);
    if (!path) continue;
    entries.push({ path, bytes: new Uint8Array(await file.arrayBuffer()) });
  }
  return writeZip(entries);
}
