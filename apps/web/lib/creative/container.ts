/**
 * Byte-level sniff for attachments whose declared type says video but whose
 * bytes carry only sound. Messages hands an audio file over in an MP4/MOV
 * container (a Voice Memo, a song bounced from GarageBand) and the relay
 * labels the container, not the tracks, so `video/mp4` reaches staging with
 * no picture in it. Sent to fal as a video reference it becomes a motion
 * reference and the sound is discarded; classified as audio it lands in
 * `reference_audio_urls` and actually plays under the render.
 */

/** ISO-BMFF `hdlr` handler types found under moov/trak/mdia. */
export function isoBmffTrackHandlers(bytes: Buffer): Set<string> {
  const handlers = new Set<string>();
  if (bytes.length < 12 || bytes.toString("latin1", 4, 8) !== "ftyp") {
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

const MP3_SYNC = 0xe0;

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
  if (bytes.toString("latin1", 0, 3) === "ID3") return "audio/mpeg";
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & MP3_SYNC) === MP3_SYNC) {
    return "audio/mpeg";
  }
  if (
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WAVE"
  ) {
    return "audio/wav";
  }
  if (bytes.toString("latin1", 0, 4) === "OggS") return "audio/ogg";
  return undefined;
}
