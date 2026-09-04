/**
 * Byte-level sniff for attachments whose declared type says video but whose
 * bytes carry only sound. Messages hands an audio file over in an MP4/MOV
 * container (a Voice Memo, a song bounced from GarageBand) and the relay
 * labels the container, not the tracks, so `video/mp4` reaches staging with
 * no picture in it. Sent to fal as a video reference it becomes a motion
 * reference and the sound is discarded; classified as audio it lands in
 * `reference_audio_urls` and actually plays under the render.
 */

/**
 * Box types a file may legitimately open with. MP4 leads with ftyp; QuickTime
 * may skip it and start straight at wide/mdat/moov/free.
 */
const LEADING_BOXES = new Set(["ftyp", "wide", "mdat", "moov", "free", "skip"]);

/** ISO-BMFF `hdlr` handler types found under moov/trak/mdia. */
export function isoBmffTrackHandlers(bytes: Buffer): Set<string> {
  const handlers = new Set<string>();
  if (bytes.length < 12 || !LEADING_BOXES.has(bytes.toString("latin1", 4, 8))) {
    return handlers;
  }
  const moov = findChild(bytes, 0, bytes.length, "moov");
  if (!moov) return handlers;
  for (const trak of children(bytes, moov.start, moov.end, "trak")) {
    const mdia = findChild(bytes, trak.start, trak.end, "mdia");
    if (!mdia) continue;
    const hdlr = findChild(bytes, mdia.start, mdia.end, "hdlr");
    // hdlr body: version/flags (4) + pre_defined (4) + handler_type (4).
    if (!hdlr || hdlr.end - hdlr.start < 12) continue;
    handlers.add(bytes.toString("latin1", hdlr.start + 8, hdlr.start + 12));
  }
  return handlers;
}

interface Box {
  /** First byte of the box header. */
  offset: number;
  /** First byte of the box body. */
  start: number;
  /** One past the last byte of the box. */
  end: number;
}

function* children(
  bytes: Buffer,
  from: number,
  to: number,
  type: string,
): Generator<Box> {
  let offset = from;
  while (offset + 8 <= to) {
    let size = bytes.readUInt32BE(offset);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > to) return;
      const large = bytes.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return;
      size = Number(large);
      header = 16;
    } else if (size === 0) {
      size = to - offset;
    }
    if (size < header || offset + size > to) return;
    if (bytes.toString("latin1", offset + 4, offset + 8) === type) {
      yield { offset, start: offset + header, end: offset + size };
    }
    offset += size;
  }
}

function findChild(
  bytes: Buffer,
  from: number,
  to: number,
  type: string,
): Box | undefined {
  for (const box of children(bytes, from, to, type)) return box;
  return undefined;
}

function box(type: string, ...body: Buffer[]): Buffer {
  const payload = Buffer.concat(body);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, payload]);
}

/**
 * Per-sample byte sizes from a full (stsz) or compact (stz2) table.
 * Undefined when neither is present or the table is truncated.
 */
function sampleSizes(
  bytes: Buffer,
  stbl: Box,
): { count: number; sizeOf: (index: number) => number } | undefined {
  const stsz = findChild(bytes, stbl.start, stbl.end, "stsz");
  if (stsz) {
    if (stsz.end - stsz.start < 12) return undefined;
    const uniform = bytes.readUInt32BE(stsz.start + 4);
    const count = bytes.readUInt32BE(stsz.start + 8);
    if (uniform === 0 && stsz.end - stsz.start < 12 + 4 * count) {
      return undefined;
    }
    return {
      count,
      sizeOf: (index) =>
        uniform || bytes.readUInt32BE(stsz.start + 12 + 4 * index),
    };
  }
  const stz2 = findChild(bytes, stbl.start, stbl.end, "stz2");
  if (!stz2 || stz2.end - stz2.start < 12) return undefined;
  const fieldBits = bytes[stz2.start + 7] ?? 0;
  const count = bytes.readUInt32BE(stz2.start + 8);
  if (![4, 8, 16].includes(fieldBits)) return undefined;
  if (stz2.end - stz2.start < 12 + Math.ceil((fieldBits * count) / 8)) {
    return undefined;
  }
  const table = stz2.start + 12;
  return {
    count,
    sizeOf: (index) => {
      if (fieldBits === 16) return bytes.readUInt16BE(table + 2 * index);
      const byte = bytes[table + (fieldBits === 8 ? index : index >> 1)] ?? 0;
      if (fieldBits === 8) return byte;
      return index % 2 === 0 ? byte >> 4 : byte & 0x0f;
    },
  };
}

/**
 * The byte range of every chunk of one track, in chunk order, from its
 * sample tables. Undefined when the tables are absent, truncated, do not
 * account for every sample, or point outside the file.
 */
function trackChunks(
  bytes: Buffer,
  stbl: Box,
):
  | { offsets: Box; width: 4 | 8; entries: number[]; lengths: number[] }
  | undefined {
  const sizes = sampleSizes(bytes, stbl);
  const stsc = findChild(bytes, stbl.start, stbl.end, "stsc");
  const stco = findChild(bytes, stbl.start, stbl.end, "stco");
  const co64 = stco
    ? undefined
    : findChild(bytes, stbl.start, stbl.end, "co64");
  const offsets = stco ?? co64;
  if (!sizes || !stsc || !offsets) return undefined;
  if (stsc.end - stsc.start < 8 || offsets.end - offsets.start < 8) {
    return undefined;
  }

  const runCount = bytes.readUInt32BE(stsc.start + 4);
  if (stsc.end - stsc.start < 8 + 12 * runCount) return undefined;
  const runs = Array.from({ length: runCount }, (_, i) => ({
    firstChunk: bytes.readUInt32BE(stsc.start + 8 + 12 * i),
    samplesPerChunk: bytes.readUInt32BE(stsc.start + 12 + 12 * i),
  }));

  const chunkCount = bytes.readUInt32BE(offsets.start + 4);
  const width = stco ? 4 : 8;
  if (offsets.end - offsets.start < 8 + width * chunkCount) return undefined;
  const entries: number[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const at = offsets.start + 8 + width * i;
    if (stco) {
      entries.push(bytes.readUInt32BE(at));
    } else {
      const large = bytes.readBigUInt64BE(at);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
      entries.push(Number(large));
    }
  }

  const lengths: number[] = [];
  let sample = 0;
  let run = 0;
  for (let chunk = 1; chunk <= chunkCount; chunk++) {
    while (run + 1 < runs.length && (runs[run + 1]?.firstChunk ?? 0) <= chunk) {
      run++;
    }
    const perChunk = runs[run]?.samplesPerChunk ?? 0;
    if (perChunk === 0 || sample + perChunk > sizes.count) return undefined;
    let length = 0;
    for (let i = 0; i < perChunk; i++) length += sizes.sizeOf(sample++);
    const offset = entries[chunk - 1] ?? 0;
    if (offset + length > bytes.length) return undefined;
    lengths.push(length);
  }
  if (sizes.count === 0 || sample !== sizes.count) return undefined;
  return { offsets, width, entries, lengths };
}

/**
 * The sound track of an MP4/MOV that also carries a picture, remuxed into an
 * M4A of its own, or undefined when there is no such track or the container
 * is fragmented or malformed. Sample data is copied, never decoded.
 *
 * A video reference is a *motion* reference to the provider; its soundtrack
 * is not heard. Handing the same track over as an audio reference too is
 * what puts it under the render.
 */
export function extractAudioTrack(bytes: Buffer): Buffer | undefined {
  if (bytes.length < 12 || !LEADING_BOXES.has(bytes.toString("latin1", 4, 8))) {
    return undefined;
  }
  if (findChild(bytes, 0, bytes.length, "moof")) return undefined;
  const moov = findChild(bytes, 0, bytes.length, "moov");
  if (!moov) return undefined;
  const mvhd = findChild(bytes, moov.start, moov.end, "mvhd");
  if (!mvhd) return undefined;

  const sounds: Box[] = [];
  let picture = false;
  for (const trak of children(bytes, moov.start, moov.end, "trak")) {
    const mdia = findChild(bytes, trak.start, trak.end, "mdia");
    const hdlr = mdia && findChild(bytes, mdia.start, mdia.end, "hdlr");
    if (!hdlr || hdlr.end - hdlr.start < 12) continue;
    const handler = bytes.toString("latin1", hdlr.start + 8, hdlr.start + 12);
    if (handler === "vide") picture = true;
    if (handler === "soun") sounds.push(trak);
  }
  if (!picture) return undefined;

  // A disabled track (tkhd flag bit 0 clear) is what an editor muted; the
  // render must not bring it back.
  const enabled = (trak: Box): boolean => {
    const tkhd = findChild(bytes, trak.start, trak.end, "tkhd");
    return (
      !tkhd ||
      tkhd.end - tkhd.start < 4 ||
      ((bytes[tkhd.start + 3] ?? 1) & 1) === 1
    );
  };
  const candidates = sounds.filter(enabled);

  let sound: Box | undefined;
  let chunks: ReturnType<typeof trackChunks> = undefined;
  for (const trak of candidates) {
    const mdia = findChild(bytes, trak.start, trak.end, "mdia");
    const minf = mdia && findChild(bytes, mdia.start, mdia.end, "minf");
    const stbl = minf && findChild(bytes, minf.start, minf.end, "stbl");
    chunks = stbl && trackChunks(bytes, stbl);
    if (chunks) {
      sound = trak;
      break;
    }
  }
  if (!sound || !chunks) return undefined;

  const ftyp = box("ftyp", Buffer.from("M4A \0\0\0\0M4A mp42isom", "latin1"));
  const mvhdBytes = bytes.subarray(mvhd.offset, mvhd.end);
  const trakBytes = Buffer.from(bytes.subarray(sound.offset, sound.end));
  const moovSize = 8 + mvhdBytes.length + trakBytes.length;
  const dataStart = ftyp.length + moovSize + 8;

  // Chunk offsets are absolute file positions; rewrite them for the new file.
  const { width } = chunks;
  const table = chunks.offsets.start + 8 - sound.offset;
  const data: Buffer[] = [];
  let position = dataStart;
  for (const [i, length] of chunks.lengths.entries()) {
    const from = chunks.entries[i] ?? 0;
    data.push(bytes.subarray(from, from + length));
    if (width === 8) {
      trakBytes.writeBigUInt64BE(BigInt(position), table + 8 * i);
    } else {
      if (position > 0xffffffff) return undefined;
      trakBytes.writeUInt32BE(position, table + 4 * i);
    }
    position += length;
  }

  return Buffer.concat([
    ftyp,
    box("moov", mvhdBytes, trakBytes),
    box("mdat", ...data),
  ]);
}

/** Codec identifiers on the first packet of an Ogg logical stream. */
const OGG_AUDIO_CODECS = ["\u0001vorbis", "OpusHead", "\u007fFLAC", "Speex   "];

/**
 * Codec identifiers of every beginning-of-stream page in an Ogg file, or
 * undefined when the pages don't parse.
 */
function oggStreamCodecs(bytes: Buffer): string[] | undefined {
  const codecs: string[] = [];
  let offset = 0;
  while (offset + 27 <= bytes.length) {
    if (bytes.toString("latin1", offset, offset + 4) !== "OggS")
      return undefined;
    const flags = bytes[offset + 5] ?? 0;
    const segments = bytes[offset + 26] ?? 0;
    const dataStart = offset + 27 + segments;
    if (dataStart > bytes.length) return undefined;
    let dataLength = 0;
    for (let i = 0; i < segments; i++) {
      dataLength += bytes[offset + 27 + i] ?? 0;
    }
    if (dataStart + dataLength > bytes.length) return undefined;
    // Every beginning-of-stream page carries a codec header; a chained file
    // may open a new set of streams part-way through, so walk every page.
    if ((flags & 0x02) !== 0) {
      codecs.push(bytes.toString("latin1", dataStart, dataStart + 8));
    }
    offset = dataStart + dataLength;
  }
  return codecs.length > 0 ? codecs : undefined;
}

/**
 * The MIME type of a raw MPEG audio stream (ADTS AAC or MP3) from its first
 * frame header, or undefined when the bytes are neither.
 */
function mpegAudioMimeType(bytes: Buffer): string | undefined {
  if (bytes.toString("latin1", 0, 3) === "ID3") return "audio/mpeg";
  const [first = 0, second = 0] = bytes;
  if (first !== 0xff || (second & 0xe0) !== 0xe0) return undefined;
  const layer = (second >> 1) & 0x03;
  // ADTS: 12 sync bits, MPEG version bit, layer bits fixed at 00.
  if ((second & 0xf6) === 0xf0) return "audio/aac";
  // MPEG-1/2/2.5 audio: layer 00 is reserved; III is the mp3 we can stage.
  return layer === 0x01 ? "audio/mpeg" : undefined;
}

/**
 * The audio MIME type an attachment declared as `video/*` should be staged
 * under, or undefined when the bytes really do carry a picture (or are not
 * recognisably audio-only).
 */
export function audioOnlyMimeType(
  mimeType: string,
  bytes: Buffer,
): string | undefined {
  if (!mimeType.toLowerCase().startsWith("video/")) return undefined;
  const handlers = isoBmffTrackHandlers(bytes);
  if (handlers.size > 0) {
    return handlers.has("soun") && !handlers.has("vide")
      ? "audio/mp4"
      : undefined;
  }
  if (bytes.length < 12) return undefined;
  if (
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WAVE"
  ) {
    return "audio/wav";
  }
  if (bytes.toString("latin1", 0, 4) === "OggS") {
    const codecs = oggStreamCodecs(bytes);
    return codecs?.every((codec) =>
      OGG_AUDIO_CODECS.some((audio) => codec.startsWith(audio)),
    )
      ? "audio/ogg"
      : undefined;
  }
  return mpegAudioMimeType(bytes);
}
