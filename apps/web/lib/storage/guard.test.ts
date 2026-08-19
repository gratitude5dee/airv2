import { describe, expect, it } from "vitest";
import { registerVaultValue } from "../vault/scrub";
import {
  allowedMediaType,
  guardMediaUpload,
  MEDIA_MAX_BYTES,
  MediaGuardError,
  stripImageMetadata,
  textContainsSecrets,
} from "./guard";

function minimalJpegWithExif(): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const exifPayload = Buffer.from("Exif\0\0GPS-SECRET-LOCATION", "latin1");
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1]),
    (() => {
      const len = Buffer.alloc(2);
      len.writeUInt16BE(exifPayload.length + 2);
      return len;
    })(),
    exifPayload,
  ]);
  const dqt = Buffer.from([0xff, 0xdb, 0x00, 0x04, 0x01, 0x02]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
  return Buffer.concat([soi, app1, dqt, sos]);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  return Buffer.concat([len, Buffer.from(type, "latin1"), data, crc]);
}

function minimalPngWithText(): Buffer {
  return Buffer.concat([
    PNG_MAGIC,
    pngChunk("IHDR", Buffer.alloc(13)),
    pngChunk("tEXt", Buffer.from("Author\0secret-camera-owner", "latin1")),
    pngChunk("eXIf", Buffer.from("gps-coords", "latin1")),
    pngChunk("IDAT", Buffer.from([1, 2, 3])),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("allowedMediaType", () => {
  it("accepts allowlisted types", () => {
    expect(allowedMediaType("image/png")).toBe(true);
    expect(allowedMediaType("application/pdf")).toBe(true);
  });
  it("rejects scriptable and unknown types", () => {
    expect(allowedMediaType("image/svg+xml")).toBe(false);
    expect(allowedMediaType("text/html")).toBe(false);
    expect(allowedMediaType("application/octet-stream")).toBe(false);
    expect(allowedMediaType("application/zip")).toBe(false);
  });
});

describe("guardMediaUpload negative paths", () => {
  it("rejects disallowed content types", () => {
    expect(() =>
      guardMediaUpload(Buffer.from("<svg/>"), "image/svg+xml")
    ).toThrowError(MediaGuardError);
  });
  it("rejects empty uploads", () => {
    expect(() => guardMediaUpload(Buffer.alloc(0), "image/png")).toThrowError(
      /empty/
    );
  });
  it("rejects oversize uploads with 413", () => {
    try {
      guardMediaUpload(Buffer.alloc(11), "image/png", { maxBytes: 10 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MediaGuardError);
      expect((error as MediaGuardError).status).toBe(413);
    }
    expect(MEDIA_MAX_BYTES).toBe(50 * 1024 * 1024);
  });
  it("rejects text containing private keys", () => {
    expect(() =>
      guardMediaUpload(
        Buffer.from("-----BEGIN RSA PRIVATE KEY-----\nabc"),
        "text/plain"
      )
    ).toThrowError(/credential/);
  });
  it("rejects text containing API-key shapes", () => {
    for (const secret of [
      "sk-abcdefghijklmnop1234",
      "AKIAABCDEFGHIJKLMNOP",
      "ghp_abcdefghijklmnopqrst",
      "otpauth://totp/x?secret=ABC",
      "R2_SECRET_ACCESS_KEY=deadbeef",
    ]) {
      expect(() =>
        guardMediaUpload(Buffer.from(`note: ${secret}`), "text/plain")
      ).toThrowError(MediaGuardError);
    }
  });
  it("rejects Luhn-valid card numbers", () => {
    expect(textContainsSecrets("card: 4111 1111 1111 1111")).toMatch(/card/);
    expect(() =>
      guardMediaUpload(Buffer.from("pay 4111-1111-1111-1111"), "text/markdown")
    ).toThrowError(/card/);
  });
  it("does not flag ordinary non-Luhn digit runs", () => {
    expect(textContainsSecrets("order id 1234567890123")).toBeNull();
  });
  it("rejects registered vault values in text", () => {
    registerVaultValue("hunter2-super-secret-value");
    expect(() =>
      guardMediaUpload(
        Buffer.from("the password is hunter2-super-secret-value"),
        "application/json"
      )
    ).toThrowError(/vault/);
  });
});

describe("stripImageMetadata", () => {
  it("strips JPEG APP1 (EXIF) segments", () => {
    const input = minimalJpegWithExif();
    expect(input.includes(Buffer.from("GPS-SECRET-LOCATION"))).toBe(true);
    const output = stripImageMetadata(input, "image/jpeg");
    expect(output.includes(Buffer.from("GPS-SECRET-LOCATION"))).toBe(false);
    // Pixel-path segments survive.
    expect(output[0]).toBe(0xff);
    expect(output[1]).toBe(0xd8);
    expect(output.includes(Buffer.from([0xff, 0xdb]))).toBe(true);
    expect(output.includes(Buffer.from([0xff, 0xda]))).toBe(true);
  });
  it("strips PNG textual and eXIf chunks", () => {
    const input = minimalPngWithText();
    const output = stripImageMetadata(input, "image/png");
    expect(output.includes(Buffer.from("secret-camera-owner"))).toBe(false);
    expect(output.includes(Buffer.from("gps-coords"))).toBe(false);
    expect(output.includes(Buffer.from("IDAT", "latin1"))).toBe(true);
    expect(output.includes(Buffer.from("IEND", "latin1"))).toBe(true);
  });
  it("passes non-image types through untouched", () => {
    const pdf = Buffer.from("%PDF-1.4 fake");
    expect(stripImageMetadata(pdf, "application/pdf")).toBe(pdf);
  });
  it("runs the strip inside guardMediaUpload", () => {
    const output = guardMediaUpload(minimalJpegWithExif(), "image/jpeg");
    expect(output.includes(Buffer.from("GPS-SECRET-LOCATION"))).toBe(false);
  });
});
