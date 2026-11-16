// HEIC → JPEG transcode for the airv2 worker: workerd cannot run a HEIF
// decoder (libheif WASM / sharp both fail there), so swap reference photos
// are fetched and decoded here on Deno, which runs the same wasm fine.
// Auth: same x-relay-token gate as gmi-relay — this is not an open proxy.
// POST { "url": "<signed heic url>" } → image/jpeg bytes.

import heicDecode from "npm:heic-decode@2.1.0";
import jpegJs from "npm:jpeg-js@0.4.4";

const RELAY_KEY = Deno.env.get("GMI_RELAY_KEY");
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
// HEIF containers carry an ftyp box whose major brand is one of these.
const HEIF_BRANDS = /^(heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1)$/;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (!RELAY_KEY || req.headers.get("x-relay-token") !== RELAY_KEY) {
    return new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = (await req.json().catch(() => undefined)) as
    | { url?: unknown }
    | undefined;
  const url = body?.url;
  if (typeof url !== "string" || !/^https:\/\//.test(url)) {
    return json({ error: "an https url is required" }, 400);
  }

  let bytes: Uint8Array;
  try {
    const src = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!src.ok) return json({ error: `source fetch failed (${src.status})` }, 502);
    bytes = new Uint8Array(await src.arrayBuffer());
  } catch (e) {
    return json({ error: `source fetch failed: ${e}` }, 502);
  }
  if (bytes.byteLength === 0) return json({ error: "empty source" }, 400);
  if (bytes.byteLength > MAX_INPUT_BYTES) return json({ error: "source too large" }, 413);

  const brand = new TextDecoder().decode(bytes.subarray(8, 12));
  if (!HEIF_BRANDS.test(brand)) {
    return json({ error: `not a HEIF image (ftyp brand "${brand}")` }, 415);
  }

  try {
    const { width, height, data } = await heicDecode({ buffer: bytes });
    const jpeg = jpegJs.encode({ data, width, height }, 90);
    return new Response(jpeg.data, {
      headers: { "content-type": "image/jpeg" },
    });
  } catch (e) {
    return json({ error: `decode failed: ${e}` }, 502);
  }
});
