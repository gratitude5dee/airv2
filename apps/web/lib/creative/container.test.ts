/**
 * An audio file relayed as video/mp4 must be recognised from its tracks, so
 * it reaches fal as a soundtrack and not as a silent motion reference.
 */
import { describe, expect, it } from "vitest";
import {
  audioOnlyMimeType,
  extractAudioTrack,
  isoBmffTrackHandlers,
} from "./container";

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
    // Chained file: an audio stream ends, then a video stream begins.
    expect(
      audioOnlyMimeType(
        "video/ogg",
        Buffer.concat([
          page("\u0001vorbis"),
          page("x", false),
          page("\u0080theora"),
        ]),
      ),
    ).toBe(undefined);
    // A page whose body was cut off is not trusted.
    expect(
      audioOnlyMimeType("video/ogg", page("\u0001vorbis").subarray(0, 40)),
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

const u32 = (...values: number[]): Buffer => {
  const out = Buffer.alloc(4 * values.length);
  values.forEach((value, i) => out.writeUInt32BE(value, 4 * i));
  return out;
};

/**
 * A clip whose mdat interleaves picture and sound chunks. The sound track
 * has five 2-byte samples: two in the first chunk, three in the second.
 */
function clipWithSoundtrack(
  options: {
    co64?: boolean;
    /** Declared sample count; the chunk tables account for five. */
    sampleCount?: number;
    /** Compact stz2 field width instead of a full stsz table. */
    stz2?: 4 | 8 | 16;
    /**
     * An extra sound track listed before the real one: a muted track whose
     * one sample is the first picture chunk, or one with no sample tables.
     */
    decoy?: "disabled" | "tableless";
  } = {},
) {
  const count = options.sampleCount ?? 5;
  const sizes = options.stz2
    ? box(
        "stz2",
        Buffer.from([0, 0, 0, 0, 0, 0, 0, options.stz2]),
        u32(count),
        // Every sample is 2 bytes, packed at the chosen field width.
        options.stz2 === 4
          ? Buffer.alloc(Math.ceil(count / 2), 0x22)
          : options.stz2 === 8
            ? Buffer.alloc(count, 2)
            : Buffer.concat(
                Array.from({ length: count }, () => Buffer.from([0, 2])),
              ),
      )
    : box("stsz", u32(0, 2, count));
  const picture = [Buffer.from("VVVVVVVV"), Buffer.from("WWWWWWWW")];
  const sound = [Buffer.from("a1a1"), Buffer.from("b2b2b2")];
  const mdatBody = Buffer.concat([
    picture[0]!,
    sound[0]!,
    picture[1]!,
    sound[1]!,
  ]);
  const mdatStart = ftyp.length + 8;
  const soundOffsets = [
    mdatStart + picture[0]!.length,
    mdatStart + picture[0]!.length + sound[0]!.length + picture[1]!.length,
  ];
  const offsets = options.co64
    ? box(
        "co64",
        u32(0, 2),
        ...soundOffsets.map((offset) => {
          const wide = Buffer.alloc(8);
          wide.writeBigUInt64BE(BigInt(offset));
          return wide;
        }),
      )
    : box("stco", u32(0, 2, ...soundOffsets));
  const soundTrak = box(
    "trak",
    box(
      "mdia",
      hdlr("soun"),
      box(
        "minf",
        box("stbl", sizes, box("stsc", u32(0, 2, 1, 2, 1, 2, 3, 1)), offsets),
      ),
    ),
  );
  const decoy =
    options.decoy === "disabled"
      ? box(
          "trak",
          box("tkhd", Buffer.from([0, 0, 0, 0]), Buffer.alloc(80)),
          box(
            "mdia",
            hdlr("soun"),
            box(
              "minf",
              box(
                "stbl",
                box("stsz", u32(0, picture[0]!.length, 1)),
                box("stsc", u32(0, 1, 1, 1, 1)),
                box("stco", u32(0, 1, mdatStart)),
              ),
            ),
          ),
        )
      : options.decoy === "tableless"
        ? trak("soun")
        : Buffer.alloc(0);
  const file = Buffer.concat([
    ftyp,
    box("mdat", mdatBody),
    box("moov", box("mvhd", Buffer.alloc(100)), trak("vide"), decoy, soundTrak),
  ]);
  return { file, sound: Buffer.concat(sound), soundTrak };
}

/** The chunk offsets the remuxed file's own table points at, dereferenced. */
function chunksOf(m4a: Buffer, wide: boolean): Buffer[] {
  const table = wide ? "co64" : "stco";
  const at = m4a.indexOf(table, 0, "latin1") + 4;
  const count = m4a.readUInt32BE(at + 4);
  return Array.from({ length: count }, (_, i) => {
    const offset = wide
      ? Number(m4a.readBigUInt64BE(at + 8 + 8 * i))
      : m4a.readUInt32BE(at + 8 + 4 * i);
    return m4a.subarray(offset, offset + (i === 0 ? 4 : 6));
  });
}

describe("extractAudioTrack", () => {
  it("remuxes only the sound track, with chunk offsets that point at its samples", () => {
    const { file, sound, soundTrak } = clipWithSoundtrack();
    const m4a = extractAudioTrack(file);

    expect(m4a).toBeDefined();
    expect(isoBmffTrackHandlers(m4a!)).toEqual(new Set(["soun"]));
    expect(m4a!.toString("latin1", 8, 12)).toBe("M4A ");
    expect(Buffer.concat(chunksOf(m4a!, false)).equals(sound)).toBe(true);
    // A 28-byte M4A ftyp, then mvhd and the sound trak copied verbatim.
    expect(m4a!.length).toBe(
      28 + 8 + (100 + 8) + soundTrak.length + 8 + sound.length,
    );
    expect(m4a!.indexOf("VVVV")).toBe(-1);
  });

  it("rewrites 64-bit chunk offsets too", () => {
    const { file, sound } = clipWithSoundtrack({ co64: true });
    const m4a = extractAudioTrack(file);

    expect(m4a).toBeDefined();
    expect(Buffer.concat(chunksOf(m4a!, true)).equals(sound)).toBe(true);
  });

  it("yields nothing for a silent clip, a sound-only file, or a fragmented one", () => {
    expect(extractAudioTrack(mp4With("vide"))).toBe(undefined);
    expect(extractAudioTrack(mp4With("soun"))).toBe(undefined);
    const { file } = clipWithSoundtrack();
    expect(extractAudioTrack(Buffer.concat([file, box("moof")]))).toBe(
      undefined,
    );
  });

  it("reads compact stz2 sample sizes of every width", () => {
    for (const stz2 of [4, 8, 16] as const) {
      const { file, sound } = clipWithSoundtrack({ stz2 });
      const m4a = extractAudioTrack(file);
      expect(m4a, `stz2 ${stz2}-bit`).toBeDefined();
      expect(Buffer.concat(chunksOf(m4a!, false)).equals(sound)).toBe(true);
    }
  });

  it("passes over a muted or tableless sound track for one that plays", () => {
    for (const decoy of ["disabled", "tableless"] as const) {
      const { file, sound } = clipWithSoundtrack({ decoy });
      const m4a = extractAudioTrack(file);
      expect(m4a, decoy).toBeDefined();
      expect(Buffer.concat(chunksOf(m4a!, false)).equals(sound)).toBe(true);
      expect(m4a!.indexOf("VVVV")).toBe(-1);
    }
  });

  it("yields nothing for a sound track with no samples", () => {
    const empty = box(
      "trak",
      box(
        "mdia",
        hdlr("soun"),
        box(
          "minf",
          box(
            "stbl",
            box("stsz", u32(0, 0, 0)),
            box("stsc", u32(0, 0)),
            box("stco", u32(0, 0)),
          ),
        ),
      ),
    );
    const file = Buffer.concat([
      ftyp,
      box("mdat", Buffer.alloc(16)),
      box("moov", box("mvhd", Buffer.alloc(100)), trak("vide"), empty),
    ]);
    expect(extractAudioTrack(file)).toBe(undefined);
  });

  it("refuses sample tables that disagree with the chunk map", () => {
    // Fewer samples declared than the chunks consume.
    expect(extractAudioTrack(clipWithSoundtrack({ sampleCount: 4 }).file)).toBe(
      undefined,
    );
    // More samples declared than the chunks cover.
    expect(extractAudioTrack(clipWithSoundtrack({ sampleCount: 6 }).file)).toBe(
      undefined,
    );
    expect(
      extractAudioTrack(clipWithSoundtrack({ stz2: 8, sampleCount: 6 }).file),
    ).toBe(undefined);
    // A track with no sample tables at all.
    expect(extractAudioTrack(mp4With("vide", "soun"))).toBe(undefined);
  });
});
