// HTTP front for the media operations workerd cannot run. The Worker in
// ../src authenticates callers; this server only listens inside the
// container and trusts what reaches it.
//
//   GET  /healthz
//   POST /v1/heic?format=jpeg|png&quality=0..1      body: HEIF bytes   -> image bytes
//   POST /v1/image/resize?width=&height=&fit=&format=&quality=         -> image bytes
//   POST /v1/video/probe                            body: media bytes  -> JSON
//   POST /v1/video/freeze-stitch?clipIn=&clipOut=&freezeAt=   (seconds)
//        body: multipart `source` + `camera` clips, or JSON
//        {"sourceUrl","cameraUrl"} fetched from MEDIA_FETCH_HOSTS      -> video/mp4
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import heicConvert from "heic-convert";
import sharp from "sharp";
import { buildFreezeEditGraph } from "./freeze-graph.mjs";

const execFileAsync = promisify(execFile);
const MAX_BODY_BYTES = 200 * 1024 * 1024;
// A freeze source clip may be 250 MiB (MAX_FREEZE_CLIP_BYTES in apps/web); the
// camera clip and multipart framing ride on top.
const MAX_STITCH_BODY_BYTES = 320 * 1024 * 1024;
const MAX_SOURCE_CLIP_BYTES = 250 * 1024 * 1024;
const MAX_CAMERA_CLIP_BYTES = 100 * 1024 * 1024;
// Exact hostnames clips may be fetched from; empty means URL inputs are off.
const FETCH_HOSTS = new Set(
  (process.env.MEDIA_FETCH_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);
const FITS = new Set(["cover", "contain", "fill", "inside", "outside"]);
const FORMATS = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, "body too large");
    chunks.push(chunk);
  }
  if (size === 0) throw new HttpError(400, "empty body");
  return Buffer.concat(chunks);
}

function dimension(value, name) {
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1 || n > 8192) throw new HttpError(400, `${name} must be 1..8192`);
  return n;
}

function quality(value, fallback) {
  if (value === null) return fallback;
  const q = Number.parseFloat(value);
  if (!(q > 0 && q <= 1)) throw new HttpError(400, "quality must be in (0, 1]");
  return q;
}

function outputFormat(value, fallback) {
  const format = value ?? fallback;
  if (!Object.hasOwn(FORMATS, format)) throw new HttpError(400, "unsupported format");
  return format;
}

async function heic(body, params) {
  const format = outputFormat(params.get("format"), "jpeg");
  if (format === "webp") throw new HttpError(400, "unsupported format");
  let out;
  try {
    out = await heicConvert({
      buffer: body,
      format: format === "png" ? "PNG" : "JPEG",
      quality: quality(params.get("quality"), 0.9),
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(415, `not a decodable HEIF image: ${error.message}`);
  }
  return { type: FORMATS[format], bytes: Buffer.from(out) };
}

async function resize(body, params) {
  const width = dimension(params.get("width"), "width");
  const height = dimension(params.get("height"), "height");
  if (!width && !height) throw new HttpError(400, "width or height is required");
  const fit = params.get("fit") ?? "cover";
  if (!FITS.has(fit)) throw new HttpError(400, "unsupported fit");
  const format = outputFormat(params.get("format"), "jpeg");
  const q = Math.max(1, Math.round(quality(params.get("quality"), 0.85) * 100));
  try {
    const pipeline = sharp(body).rotate().resize({ width, height, fit, withoutEnlargement: true });
    const bytes = await (format === "png" ? pipeline.png() : pipeline[format]({ quality: q })).toBuffer();
    return { type: FORMATS[format], bytes };
  } catch (error) {
    throw new HttpError(415, `not a decodable image: ${error.message}`);
  }
}

async function ffprobe(file) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
    { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout);
  return {
    durationSeconds: parsed.format?.duration === undefined ? undefined : Number(parsed.format.duration),
    formatName: parsed.format?.format_name,
    streams: (parsed.streams ?? []).map((s) => ({
      type: s.codec_type,
      codec: s.codec_name,
      width: s.width,
      height: s.height,
      frameRate: s.avg_frame_rate,
      durationSeconds: s.duration === undefined ? undefined : Number(s.duration),
    })),
  };
}

const unreadable = (error) =>
  new HttpError(415, `not a readable media file: ${String(error.stderr ?? error.message).trim().slice(0, 300)}`);

async function withTempDir(prefix, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function probe(body) {
  return withTempDir("probe-", async (dir) => {
    const file = path.join(dir, "input");
    await writeFile(file, body);
    const info = await ffprobe(file).catch((error) => {
      throw unreadable(error);
    });
    return { type: "application/json", bytes: Buffer.from(JSON.stringify({ ...info, sizeBytes: body.length })) };
  });
}

function seconds(params, name) {
  const raw = params.get(name)?.trim();
  const n = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${name} must be seconds >= 0`);
  return n;
}

async function clipPart(form, name) {
  const part = form.get(name);
  if (!part || typeof part === "string" || part.size === 0) throw new HttpError(400, `${name} clip is required`);
  return Buffer.from(await part.arrayBuffer());
}

async function download(rawUrl, name, file, limit) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(400, `${name}Url is required`);
  }
  if (url.protocol !== "https:" || !FETCH_HOSTS.has(url.hostname)) {
    throw new HttpError(400, `${name}Url host is not allowed`);
  }
  let res;
  try {
    // Redirects are refused so an allowed host cannot point the fetch elsewhere.
    res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(120_000) });
  } catch (error) {
    throw new HttpError(502, `${name} download failed: ${error.cause?.message ?? error.message}`);
  }
  if (!res.ok || !res.body) throw new HttpError(502, `${name} download failed: HTTP ${res.status}`);
  let size = 0;
  const cap = new Transform({
    transform(chunk, _encoding, done) {
      size += chunk.length;
      done(size > limit ? new HttpError(413, `${name} clip is too large`) : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(res.body), cap, createWriteStream(file));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, `${name} download failed: ${error.message}`);
  }
  if (size === 0) throw new HttpError(502, `${name} download was empty`);
}

async function stageClips(body, contentType, srcPath, camPath) {
  if ((contentType ?? "").toLowerCase().startsWith("application/json")) {
    let input;
    try {
      input = JSON.parse(body.toString("utf8"));
    } catch {
      throw new HttpError(400, "body must be JSON");
    }
    await Promise.all([
      download(input?.sourceUrl, "source", srcPath, MAX_SOURCE_CLIP_BYTES),
      download(input?.cameraUrl, "camera", camPath, MAX_CAMERA_CLIP_BYTES),
    ]);
    return;
  }
  let form;
  try {
    form = await new Response(body, { headers: { "content-type": contentType ?? "" } }).formData();
  } catch {
    throw new HttpError(400, "body must be multipart/form-data or JSON");
  }
  const [source, camera] = await Promise.all([clipPart(form, "source"), clipPart(form, "camera")]);
  await Promise.all([writeFile(srcPath, source), writeFile(camPath, camera)]);
}

async function freezeStitch(body, params, contentType) {
  const clipIn = seconds(params, "clipIn");
  const freezeAt = seconds(params, "freezeAt");
  let clipOut = seconds(params, "clipOut");

  return withTempDir("stitch-", async (dir) => {
    const srcPath = path.join(dir, "src");
    const camPath = path.join(dir, "cam");
    const outPath = path.join(dir, "out.mp4");
    await stageClips(body, contentType, srcPath, camPath);
    const [src, cam] = await Promise.all([ffprobe(srcPath), ffprobe(camPath)]).catch((error) => {
      throw unreadable(error);
    });
    const srcVideo = src.streams.find((s) => s.type === "video");
    const camVideo = cam.streams.find((s) => s.type === "video");
    if (!srcVideo) throw new HttpError(415, "source has no video stream");
    if (!camVideo?.width || !camVideo.height || !(cam.durationSeconds > 0)) {
      throw new HttpError(415, "camera has no readable video stream");
    }
    // A file shorter than the remembered window just runs out.
    if (src.durationSeconds > 0) clipOut = Math.min(clipOut, src.durationSeconds);
    if (clipOut - clipIn < 0.1) throw new HttpError(422, "clip window is shorter than 0.1s");

    const hasAudioStream = (info) => info.streams.some((s) => s.type === "audio");
    const { graph, hasAudio } = buildFreezeEditGraph(
      camVideo.width,
      camVideo.height,
      { clipIn, clipOut, freezeAt },
      cam.durationSeconds,
      hasAudioStream(src),
      hasAudioStream(cam),
    );
    try {
      await execFileAsync(
        "ffmpeg",
        [
          "-y", "-hide_banner", "-loglevel", "error",
          "-i", srcPath,
          "-i", camPath,
          "-filter_complex", graph,
          "-map", "[v]",
          ...(hasAudio ? ["-map", "[a]", "-c:a", "aac", "-b:a", "128k"] : []),
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
          "-movflags", "+faststart",
          outPath,
        ],
        { timeout: 300_000, maxBuffer: 8 * 1024 * 1024 },
      );
    } catch (error) {
      console.error("freeze stitch failed", String(error.stderr ?? error.message).slice(0, 2000));
      throw new HttpError(422, `stitch failed: ${String(error.stderr ?? error.message).trim().slice(0, 300)}`);
    }
    return { type: "video/mp4", bytes: await readFile(outPath) };
  });
}

const ROUTES = {
  "/v1/heic": heic,
  "/v1/image/resize": resize,
  "/v1/video/probe": probe,
  "/v1/video/freeze-stitch": freezeStitch,
};

function send(res, status, type, bytes) {
  res.writeHead(status, { "content-type": type, "content-length": bytes.length });
  res.end(bytes);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://media");
  try {
    if (url.pathname === "/healthz") return send(res, 200, "application/json", Buffer.from('{"ok":true}'));
    const handler = ROUTES[url.pathname];
    if (!handler) throw new HttpError(404, "not found");
    if (req.method !== "POST") throw new HttpError(405, "POST only");
    const limit = handler === freezeStitch ? MAX_STITCH_BODY_BYTES : MAX_BODY_BYTES;
    const out = await handler(await readBody(req, limit), url.searchParams, req.headers["content-type"]);
    send(res, 200, out.type, out.bytes);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error("media op failed", url.pathname, error);
    send(res, status, "application/json", Buffer.from(JSON.stringify({ error: status === 500 ? "internal error" : error.message })));
  }
});

server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
