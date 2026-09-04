import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import {
  BUNDLE_MAX_ZIP_BYTES,
  BundleError,
  bundleContentType,
  bundleKey,
  readZip,
  validateBundle,
} from "./bundles";

interface ZipEntry {
  name: string;
  data: Buffer;
  deflate?: boolean;
}

/** Minimal stored/deflate zip writer for tests. */
function makeZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const method = entry.deflate ? 8 : 0;
    const payload = entry.deflate ? deflateRawSync(entry.data) : entry.data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const localFull = Buffer.concat([local, name, payload]);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    locals.push(localFull);
    offset += localFull.length;
  }
  const centralStart = offset;
  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(centralStart, 16);
  return Buffer.concat([...locals, centralBytes, eocd]);
}

const INDEX = Buffer.from("<!doctype html><h1>hi</h1>");

describe("readZip", () => {
  it("reads stored and deflated entries", () => {
    const zip = makeZip([
      { name: "index.html", data: INDEX },
      { name: "app.js", data: Buffer.from("console.log(1)"), deflate: true },
    ]);
    const files = readZip(zip);
    expect(files.map((f) => f.path)).toEqual(["index.html", "app.js"]);
    expect(files[1]?.bytes.toString()).toBe("console.log(1)");
  });
  it("rejects zips over the 25MB cap with 413", () => {
    const big = Buffer.alloc(BUNDLE_MAX_ZIP_BYTES + 1);
    try {
      readZip(big);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BundleError);
      expect((error as BundleError).status).toBe(413);
    }
  });
  it("rejects non-zip data", () => {
    expect(() => readZip(Buffer.from("not a zip at all"))).toThrowError(
      /not a zip/
    );
  });
  it("rejects unsupported compression methods", () => {
    const zip = makeZip([{ name: "index.html", data: INDEX }]);
    // Patch central-directory method to 12 (bzip2).
    const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt16LE(12, central + 10);
    expect(() => readZip(zip)).toThrowError(/unsupported compression/);
  });
});

describe("validateBundle", () => {
  const file = (path: string, text: string) => ({
    path,
    bytes: Buffer.from(text),
  });
  it("accepts a plain static bundle", () => {
    expect(() =>
      validateBundle([
        file("index.html", "<!doctype html><p>ok</p>"),
        file("assets/app.js", "document.title='x'"),
        file("style.css", "body{}"),
      ])
    ).not.toThrow();
  });
  it("requires a root index.html", () => {
    expect(() => validateBundle([file("app.js", "1")])).toThrowError(
      /index\.html/
    );
    expect(() =>
      validateBundle([file("nested/index.html", "<p>x</p>")])
    ).toThrowError(/index\.html/);
  });
  it("rejects unsafe paths", () => {
    expect(() =>
      validateBundle([
        file("index.html", "x"),
        { path: "../evil.js", bytes: Buffer.from("1") },
      ])
    ).toThrowError(/unsafe path/);
    expect(() =>
      validateBundle([
        file("index.html", "x"),
        { path: "/abs.js", bytes: Buffer.from("1") },
      ])
    ).toThrowError(/unsafe path/);
  });
  it("rejects non-allowlisted file types", () => {
    expect(() =>
      validateBundle([file("index.html", "x"), file("logo.svg", "<svg/>")])
    ).toThrowError(/not allowed/);
    expect(() =>
      validateBundle([file("index.html", "x"), file("mod.wasm", "\0asm")])
    ).toThrowError(/not allowed/);
    expect(() =>
      validateBundle([file("index.html", "x"), file("sw", "code")])
    ).toThrowError(/not allowed/);
  });
  it("rejects service-worker registration anywhere", () => {
    expect(() =>
      validateBundle([
        file("index.html", "x"),
        file("app.js", "navigator.serviceWorker.register('/sw.js')"),
      ])
    ).toThrowError(/service worker/i);
    expect(() =>
      validateBundle([
        file("index.html", "<script>navigator['serviceWorker']</script>"),
      ])
    ).toThrowError(/service worker/i);
  });
  it("scans for service workers case-insensitively, minus react-dom's <link as> literal", () => {
    for (const text of [
      "navigator.ServiceWorker.register('/sw.js')",
      "navigator['SERVICEWORKER']",
      "navigator[\"serviceworker\"]",
      'const k = "ServiceWorker"; navigator[k]',
      'const k = "serviceworker"; navigator[k.replace("w", "W")]',
      'const k = { x: "serviceworker" }; navigator[k.x]',
      'CASE "serviceworker":',
    ]) {
      expect(() => validateBundle([file("index.html", "x"), file("app.js", text)])).toThrowError(
        /service worker/i
      );
    }
    for (const text of [
      'switch (as) { case "serviceworker": case "audioworklet": break }',
      'switch(a){case"serviceworker":case"audioworklet":break}',
    ]) {
      expect(() => validateBundle([file("index.html", "x"), file("app.js", text)])).not.toThrow();
    }
  });
  it("rejects publisher meta CSP overrides", () => {
    expect(() =>
      validateBundle([
        file(
          "index.html",
          `<meta http-equiv="Content-Security-Policy" content="default-src *">`
        ),
      ])
    ).toThrowError(/content security policy/i);
    expect(() =>
      validateBundle([
        file(
          "index.html",
          "<META HTTP-EQUIV=content-security-policy CONTENT='x'>"
        ),
      ])
    ).toThrowError(/content security policy/i);
  });
  it("rejects empty bundles", () => {
    expect(() => validateBundle([])).toThrowError(/empty/);
  });
});

describe("bundle key + content types", () => {
  it("places files under apps/<slug>/<version>/", () => {
    expect(bundleKey("alice-todo", "v1", "index.html")).toBe(
      "apps/alice-todo/v1/index.html"
    );
  });
  it("maps only allowlisted extensions", () => {
    expect(bundleContentType("index.html")).toContain("text/html");
    expect(bundleContentType("x.svg")).toBeNull();
    expect(bundleContentType("noext")).toBeNull();
  });
});
