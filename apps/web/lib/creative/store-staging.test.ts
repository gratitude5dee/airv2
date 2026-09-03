/**
 * iPhone attachments reach the creative lanes as HEIC, which no provider
 * accepts as an input image. Staging must hand the provider a JPEG object
 * whose signed URL ends in .jpg, and must refuse rather than stage HEIC
 * bytes behind a JPEG content type when the decode fails.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { heifToJpeg } from "../identity/heif";
import { stageCreativeInput } from "./store";

vi.mock("../identity/heif", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../identity/heif")>()),
  heifToJpeg: vi.fn(),
}));

/** A HEIC container header — enough for isHeif's ftyp sniff. */
const heicBytes = (): Buffer =>
  Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypheic", "latin1"),
    Buffer.alloc(12),
  ]);

const uploads: { key: string; contentType: string; bytes: Buffer }[] = [];

const fakeSupabase = () =>
  ({
    storage: {
      from: () => ({
        upload: (key: string, bytes: Buffer, options: { contentType: string }) => {
          uploads.push({ key, bytes, contentType: options.contentType });
          return Promise.resolve({ error: null });
        },
        createSignedUrl: (key: string) =>
          Promise.resolve({
            error: null,
            data: { signedUrl: `https://storage.test/${key}?token=x` },
          }),
        remove: () => Promise.resolve({ error: null }),
      }),
    },
  }) as unknown as SupabaseClient;

describe("stageCreativeInput HEIC handling", () => {
  beforeEach(() => {
    uploads.length = 0;
    vi.mocked(heifToJpeg).mockReset();
  });

  it("converts HEIC to JPEG before the object and its signed URL exist", async () => {
    const jpeg = Buffer.from("jpeg-bytes");
    vi.mocked(heifToJpeg).mockResolvedValue(jpeg);

    const staged = await stageCreativeInput(
      fakeSupabase(),
      "u1",
      heicBytes(),
      "image/heic"
    );

    expect(staged?.kind).toBe("image");
    expect(staged?.mimeType).toBe("image/jpeg");
    expect(staged?.storageKey.endsWith(".jpg")).toBe(true);
    expect(staged?.url).toContain(".jpg");
    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.contentType).toBe("image/jpeg");
    expect(uploads[0]?.bytes.equals(jpeg)).toBe(true);
  });

  it("sniffs HEIC bytes that arrive with a lying content type", async () => {
    vi.mocked(heifToJpeg).mockResolvedValue(Buffer.from("jpeg-bytes"));

    const staged = await stageCreativeInput(
      fakeSupabase(),
      "u1",
      heicBytes(),
      "application/octet-stream"
    );

    expect(staged?.mimeType).toBe("image/jpeg");
    expect(heifToJpeg).toHaveBeenCalledOnce();
  });

  it("stages nothing when the HEIC decode fails", async () => {
    vi.mocked(heifToJpeg).mockRejectedValue(new Error("libheif said no"));

    const staged = await stageCreativeInput(
      fakeSupabase(),
      "u1",
      heicBytes(),
      "image/heic"
    );

    expect(staged).toBeUndefined();
    expect(uploads).toHaveLength(0);
  });

  it("leaves a plain JPEG untouched", async () => {
    const staged = await stageCreativeInput(
      fakeSupabase(),
      "u1",
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      "image/jpeg"
    );

    expect(staged?.mimeType).toBe("image/jpeg");
    expect(heifToJpeg).not.toHaveBeenCalled();
  });
});

describe("stageCreativeInput clips", () => {
  beforeEach(() => {
    uploads.length = 0;
  });

  it("stages an iPhone video as a video reference", async () => {
    const staged = await stageCreativeInput(
      fakeSupabase(),
      "u1",
      Buffer.from("mov-bytes"),
      "video/quicktime"
    );

    expect(staged?.kind).toBe("video");
    expect(staged?.mimeType).toBe("video/quicktime");
    expect(staged?.storageKey.endsWith(".mov")).toBe(true);
    expect(uploads[0]?.contentType).toBe("video/quicktime");
  });

  it("stages a voice memo or song as an audio reference", async () => {
    const memo = await stageCreativeInput(
      fakeSupabase(),
      "u1",
      Buffer.from("m4a-bytes"),
      "audio/x-m4a"
    );
    const song = await stageCreativeInput(
      fakeSupabase(),
      "u1",
      Buffer.from("mp3-bytes"),
      "audio/mpeg"
    );

    expect(memo?.kind).toBe("audio");
    expect(memo?.storageKey.endsWith(".m4a")).toBe(true);
    expect(uploads[0]?.contentType).toBe("audio/mp4");
    expect(song?.kind).toBe("audio");
    expect(song?.storageKey.endsWith(".mp3")).toBe(true);
    expect(uploads[1]?.contentType).toBe("audio/mpeg");
  });

  it("refuses attachment types no endpoint accepts", async () => {
    const staged = await stageCreativeInput(
      fakeSupabase(),
      "u1",
      Buffer.from("%PDF-1.7"),
      "application/pdf"
    );

    expect(staged).toBeUndefined();
    expect(uploads).toHaveLength(0);
  });
});
