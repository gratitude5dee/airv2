/**
 * An audio file relayed as video/mp4 must be recognised from its tracks, so
 * it reaches fal as a soundtrack and not as a silent motion reference.
 */
import { describe, expect, it } from "vitest";
import { audioOnlyMimeType, isoBmffTrackHandlers } from "./container";

const box = (type: string, ...body: Buffer[]): Buffer => {
  const payload = Buffer.concat(body);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, payload]);
};

const hdlr = (handler: string): Buffer =>
  box("hdlr", Buffer.alloc(8), Buffer.from(handler, "latin1"), Buffer.alloc(4));

const trak = (handler: string): Buffer =>
  box("trak", box("mdia", hdlr(handler)));

const ftyp = box("ftyp", Buffer.from("isom", "latin1"), Buffer.alloc(8));

const mp4With = (...handlers: string[]): Buffer =>
  Buffer.concat([
    ftyp,
    box("mdat", Buffer.alloc(16)),
    box("moov", box("mvhd", Buffer.alloc(100)), ...handlers.map(trak)),
  ]);

describe("isoBmffTrackHandlers", () => {
  it("lists the handler of every track under moov", () => {
    expect(isoBmffTrackHandlers(mp4With("vide", "soun"))).toEqual(
      new Set(["vide", "soun"]),
    );
  });

  it("walks 64-bit box sizes", () => {
    const moov = box("moov", trak("soun"));
    const large = Buffer.alloc(16);
    large.writeUInt32BE(1, 0);
    large.write("moov", 4, "latin1");
    large.writeBigUInt64BE(BigInt(moov.length + 8), 8);
    const bytes = Buffer.concat([ftyp, large, moov.subarray(8)]);

    expect(isoBmffTrackHandlers(bytes)).toEqual(new Set(["soun"]));
  });

  it("reads a QuickTime file that opens with wide/mdat instead of ftyp", () => {
    const mov = Buffer.concat([
      box("wide"),
      box("mdat", Buffer.alloc(32)),
      box("moov", trak("soun")),
    ]);

    expect(isoBmffTrackHandlers(mov)).toEqual(new Set(["soun"]));
  });

  it("stops at a truncated or foreign container", () => {
    expect(isoBmffTrackHandlers(Buffer.from("ID3\u0004\u0000"))).toEqual(
      new Set(),
    );
    const truncated = box("moov", trak("soun")).subarray(0, 20);
    expect(isoBmffTrackHandlers(Buffer.concat([ftyp, truncated]))).toEqual(
      new Set(),
    );
  });
});

describe("audioOnlyMimeType", () => {
  it("reclassifies a sound-only MP4 relayed as video", () => {
    expect(audioOnlyMimeType("video/mp4", mp4With("soun"))).toBe("audio/mp4");
    expect(audioOnlyMimeType("video/quicktime", mp4With("soun"))).toBe(
      "audio/mp4",
    );
  });

  it("leaves a real video alone", () => {
    expect(audioOnlyMimeType("video/mp4", mp4With("vide", "soun"))).toBe(
      undefined,
    );
    expect(audioOnlyMimeType("video/mp4", mp4With("vide"))).toBe(undefined);
  });

  it("only second-guesses video types", () => {
    expect(audioOnlyMimeType("audio/x-m4a", mp4With("soun"))).toBe(undefined);
    expect(audioOnlyMimeType("image/jpeg", mp4With("soun"))).toBe(undefined);
  });

  it("tells ADTS AAC from MP3 frame headers", () => {
    const raw = (...head: number[]) =>
      Buffer.concat([Buffer.from(head), Buffer.alloc(12)]);

    expect(audioOnlyMimeType("video/mp4", raw(0xff, 0xf1, 0x50, 0x80))).toBe(
      "audio/aac",
    );
    expect(audioOnlyMimeType("video/mp4", raw(0xff, 0xf9, 0x50, 0x80))).toBe(
      "audio/aac",
    );
    expect(audioOnlyMimeType("video/mp4", raw(0xff, 0xfb, 0x90, 0x00))).toBe(
      "audio/mpeg",
    );
    expect(audioOnlyMimeType("video/mp4", raw(0xff, 0xe3, 0x90, 0x00))).toBe(
      "audio/mpeg",
    );
    // Layer I/II are not something fal plays.
    expect(audioOnlyMimeType("video/mp4", raw(0xff, 0xfd, 0x90, 0x00))).toBe(
      undefined,
    );
    expect(audioOnlyMimeType("video/mp4", raw(0xff, 0xff, 0x90, 0x00))).toBe(
      undefined,
    );
  });

  it("accepts Ogg only when every stream is an audio codec", () => {
    const page = (codec: string, bos = true): Buffer => {
      const body = Buffer.from(codec.padEnd(30, "\u0000"), "latin1");
      const header = Buffer.alloc(27);
      header.write("OggS", 0, "latin1");
      header[5] = bos ? 0x02 : 0x00;
      header[26] = 1;
      return Buffer.concat([header, Buffer.from([body.length]), body]);
    };

    expect(
      audioOnlyMimeType(
        "video/ogg",
        Buffer.concat([page("\u0001vorbis"), page("x", false)]),
      ),
    ).toBe("audio/ogg");
    expect(audioOnlyMimeType("video/ogg", page("OpusHead"))).toBe("audio/ogg");
    expect(audioOnlyMimeType("video/ogg", page("\u0080theora"))).toBe(
      undefined,
    );
    expect(
      audioOnlyMimeType(
        "video/ogg",
        Buffer.concat([page("\u0080theora"), page("\u0001vorbis")]),
      ),
    ).toBe(undefined);
  });

  it("recognises tagged mp3 and wav bytes behind a video label; a bare Ogg page is not enough", () => {
    expect(
      audioOnlyMimeType(
        "video/mp4",
        Buffer.from(
          "ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        ),
      ),
    ).toBe("audio/mpeg");
    expect(
      audioOnlyMimeType(
        "video/mp4",
        Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(8)]),
      ),
    ).toBe("audio/mpeg");
    expect(
      audioOnlyMimeType(
        "video/mp4",
        Buffer.from("RIFF\u0000\u0000\u0000\u0000WAVEfmt ", "latin1"),
      ),
    ).toBe("audio/wav");
    expect(
      audioOnlyMimeType(
        "video/webm",
        Buffer.from(
          "OggS\u0000\u0002\u0000\u0000\u0000\u0000\u0000\u0000",
          "latin1",
        ),
      ),
    ).toBe(undefined);
  });

  it("does not guess from unrecognised bytes", () => {
    expect(audioOnlyMimeType("video/mp4", Buffer.from("mov-bytes"))).toBe(
      undefined,
    );
  });
});
