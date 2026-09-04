import { describe, expect, it } from "vitest";
import { readZip, validateBundle } from "../miniapps/bundles";
import { bundlePathFor, crc32, writeZip } from "./clientZip";

describe("bundlePathFor", () => {
  it("strips the picked folder and drops hidden / dependency entries", () => {
    expect(bundlePathFor("site/index.html")).toBe("index.html");
    expect(bundlePathFor("site/assets/app.js")).toBe("assets/app.js");
    expect(bundlePathFor("index.html")).toBe("index.html");
    expect(bundlePathFor("site/.DS_Store")).toBeNull();
    expect(bundlePathFor("site/.git/config")).toBeNull();
    expect(bundlePathFor("site/node_modules/x/index.js")).toBeNull();
    expect(bundlePathFor("site/__MACOSX/._index.html")).toBeNull();
  });
});

describe("writeZip", () => {
  it("computes the standard crc32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("produces a zip readZip + validateBundle accept, byte-for-byte", async () => {
    const html = "<!doctype html><title>hi</title>".repeat(40);
    const css = "body{margin:0}";
    const blob = await writeZip([
      { path: "index.html", bytes: new TextEncoder().encode(html) },
      { path: "styles/site.css", bytes: new TextEncoder().encode(css) },
    ]);
    const files = readZip(Buffer.from(await blob.arrayBuffer()));
    validateBundle(files);
    expect(files.map((f) => f.path)).toEqual(["index.html", "styles/site.css"]);
    expect(files[0]?.bytes.toString("utf8")).toBe(html);
    expect(files[1]?.bytes.toString("utf8")).toBe(css);
  });
});
