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
      yield { start: offset + header, end: offset + size };
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
    // Only beginning-of-stream pages carry a codec header; they all come first.
    if ((flags & 0x02) === 0) break;
    codecs.push(bytes.toString("latin1", dataStart, dataStart + 8));
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
