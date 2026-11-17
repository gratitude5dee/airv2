// HTTP front for the media operations workerd cannot run. The Worker in
// ../src authenticates callers; this server only listens inside the
// container and trusts what reaches it.
//
//   GET  /healthz
//   POST /v1/heic?format=jpeg|png&quality=0..1      body: HEIF bytes   -> image bytes
//   POST /v1/image/resize?width=&height=&fit=&format=&quality=         -> image bytes
//   POST /v1/video/probe                            body: media bytes  -> JSON
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import heicConvert from "heic-convert";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const MAX_BODY_BYTES = 200 * 1024 * 1024;
const FITS = new Set(["cover", "contain", "fill", "inside", "outside"]);
const FORMATS = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "body too large");
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
  const q = Math.round(quality(params.get("quality"), 0.85) * 100);
  try {
    const pipeline = sharp(body).rotate().resize({ width, height, fit, withoutEnlargement: true });
    const bytes = await (format === "png" ? pipeline.png() : pipeline[format]({ quality: q })).toBuffer();
    return { type: FORMATS[format], bytes };
  } catch (error) {
    throw new HttpError(415, `not a decodable image: ${error.message}`);
  }
}

async function probe(body) {
  const dir = await mkdtemp(path.join(tmpdir(), "probe-"));
  try {
    const file = path.join(dir, "input");
    await writeFile(file, body);
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
      { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout);
    const streams = (parsed.streams ?? []).map((s) => ({
      type: s.codec_type,
      codec: s.codec_name,
      width: s.width,
      height: s.height,
      frameRate: s.avg_frame_rate,
      durationSeconds: s.duration === undefined ? undefined : Number(s.duration),
    }));
    const body_ = {
      durationSeconds: parsed.format?.duration === undefined ? undefined : Number(parsed.format.duration),
      formatName: parsed.format?.format_name,
      sizeBytes: body.length,
      streams,
    };
    return { type: "application/json", bytes: Buffer.from(JSON.stringify(body_)) };
  } catch (error) {
    throw new HttpError(415, `not a readable media file: ${String(error.stderr ?? error.message).trim().slice(0, 300)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const ROUTES = { "/v1/heic": heic, "/v1/image/resize": resize, "/v1/video/probe": probe };

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
    const out = await handler(await readBody(req), url.searchParams);
    send(res, 200, out.type, out.bytes);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error("media op failed", url.pathname, error);
    send(res, status, "application/json", Buffer.from(JSON.stringify({ error: status === 500 ? "internal error" : error.message })));
  }
});

server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
