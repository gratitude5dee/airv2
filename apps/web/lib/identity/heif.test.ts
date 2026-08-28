import { describe, expect, it } from "vitest";
import { heifToJpeg, isHeif } from "./heif";

function ftyp(brand: string): Buffer {
  const header = Buffer.alloc(16);
  header.writeUInt32BE(16, 0);
  header.write("ftyp", 4, "latin1");
  header.write(brand, 8, "latin1");
  return header;
}

describe("isHeif", () => {
  it("matches declared HEIC/HEIF content types", () => {
    expect(isHeif("image/heic")).toBe(true);
    expect(isHeif("image/heif")).toBe(true);
    expect(isHeif("IMAGE/HEIC ")).toBe(true);
    expect(isHeif("image/heic-sequence")).toBe(true);
  });

  it("rejects supported image types", () => {
    expect(isHeif("image/png")).toBe(false);
    expect(isHeif("image/jpeg")).toBe(false);
    expect(isHeif("image/webp")).toBe(false);
  });

  it("byte-sniffs ftyp brands when the declared type lies", () => {
    expect(isHeif("application/octet-stream", ftyp("heic"))).toBe(true);
    expect(isHeif("image/jpeg", ftyp("mif1"))).toBe(true);
    expect(isHeif("application/octet-stream", ftyp("isom"))).toBe(false);
    expect(
      isHeif("application/octet-stream", Buffer.from([0xff, 0xd8, 0xff]))
    ).toBe(false);
    expect(isHeif("application/octet-stream", Buffer.alloc(4))).toBe(false);
  });
});

describe("heifToJpeg", () => {
  it("rejects bytes that are not a decodable HEIF image", async () => {
    await expect(heifToJpeg(ftyp("heic"))).rejects.toThrow();
    await expect(heifToJpeg(Buffer.from("not an image"))).rejects.toThrow();
  });
});
