/**
 * /freeze studio client — bundled to public/creator-os/freeze-studio.js by
 * scripts/build-freeze-studio.mjs and mounted onto #freeze-studio inside
 * the mini-app shell (same-origin under script-src 'self').
 *
 * Three stages:
 *   source — take a photo (raw HEIC goes up as a File and converts to PNG
 *            server-side), upload one, or sketch + prompt through the
 *            Flare lanes; the delivered sketch becomes the source still
 *   camera — a 2D-canvas orbit editor (the lite surface forbids WebGL):
 *            the photo billboard sits center stage, the trajectory ribbon
 *            sweeps an orbit ring around it, and the camera glyph rides the
 *            scrubbed time; a keyframe strip below + preset rail on top
 *   result — delivered renders with a send-to-iMessage action
 *
 * All state lives in React or server-side on freeze_sessions +
 * creative_jobs — the mini-app contract (C17) forbids browser storage.
 */
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { FREEZE_MAX_KEYFRAMES } from "../freezeRecipe";

/* ------------------------------------------------------------ protocol */

interface CameraKeyframe {
  time: number;
  azimuth: number;
  elevation: number;
  distance: number;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  duration: number;
  returnsToStart: boolean;
  trajectory: readonly CameraKeyframe[];
}

interface FreezeJob {
  jobId: string;
  kind: "sketch" | "render";
  state: string;
  error: string | null;
  outputAssetId: string | null;
  outputUrl: string | null;
  createdAt: string;
}

interface ActiveJob {
  id: string;
  status: string;
  error: string | null;
}

interface Payload {
  sessionId: string;
  expiresAt: string;
  /** lite (card) surfaces skip the WebGL stage entirely */
  lite?: boolean;
  latest: number;
  activeJob: ActiveJob | null;
  latestJobId: string | null;
  sourceAssetId: string | null;
  sourceUrl: string | null;
  sketches: FreezeJob[];
  renders: FreezeJob[];
  presets: Preset[];
  /** present on action responses */
  ok?: boolean;
  jobId?: string;
  status?: string;
  assetId?: string;
  deliveryUrl?: string;
  sent?: boolean;
  downloadUrl?: string;
  error?: string;
  line?: string;
}

async function postAction(
  fields: Record<string, string> | FormData
): Promise<Payload | null> {
  const form = fields instanceof FormData ? fields : new FormData();
  if (!(fields instanceof FormData)) {
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
  }
  form.set("format", "json");
  try {
    const res = await fetch(window.location.pathname, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    return (await res.json()) as Payload;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- trajectory math */

const DEG = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** The pose the camera holds at normalized clip time t. */
function poseAt(frames: CameraKeyframe[], t: number): CameraKeyframe {
  if (t <= frames[0]!.time) return frames[0]!;
  const last = frames[frames.length - 1]!;
  if (t >= last.time) return last;
  let i = 1;
  while (frames[i]!.time < t) i++;
  const a = frames[i - 1]!;
  const b = frames[i]!;
  const span = Math.max(1e-6, b.time - a.time);
  const k = (t - a.time) / span;
  const ease = k * k * (3 - 2 * k);
  // Interpolate azimuth along the short arc so a 350°→10° leg sweeps 20°,
  // not 340° backwards.
  let d = b.azimuth - a.azimuth;
  d = ((((d % 360) + 540) % 360) + 360) % 360 - 180;
  return {
    time: t,
    azimuth: a.azimuth + d * ease,
    elevation: a.elevation + (b.elevation - a.elevation) * ease,
    distance: a.distance + (b.distance - a.distance) * ease,
  };
}

const START_KEYFRAME: CameraKeyframe = {
  time: 0,
  azimuth: 0,
  elevation: 0,
  distance: 1,
};
const END_KEYFRAME: CameraKeyframe = { ...START_KEYFRAME, time: 1 };

/* --------------------------------------------------------- sketch canvas */

const SKETCH_SIZE = 1024;
const PALETTE = ["#f8fbff", "#ffd166", "#ff5d8f", "#4db0ff", "#39d98a"];
const SKETCH_MODES: { id: string; label: string }[] = [
  { id: "fast", label: "Flare Fast" },
  { id: "detailed", label: "Flare Detailed" },
  { id: "turbo", label: "Turbo" },
  { id: "hq", label: "Sunburst HQ" },
];

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  erase: boolean;
}

function SketchPad(props: {
  busy: boolean;
  onGenerate: (canvasPng: Blob | null, prompt: string, mode: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [color, setColor] = useState(PALETTE[0]!);
  const [width, setWidth] = useState(14);
  const [erase, setErase] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("fast");
  const [, bump] = useState(0);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#0a1120";
    ctx.fillRect(0, 0, SKETCH_SIZE, SKETCH_SIZE);
    for (const stroke of strokesRef.current) {
      ctx.save();
      ctx.globalCompositeOperation = stroke.erase
        ? "destination-out"
        : "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const [first, ...rest] = stroke.points;
      if (!first) {
        ctx.restore();
        continue;
      }
      ctx.beginPath();
      ctx.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (const point of rest) ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  useEffect(() => repaint(), [repaint]);

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = SKETCH_SIZE / Math.max(1, Math.min(rect.width, rect.height));
    return {
      x: (e.clientX - rect.left) * scale,
      y: (e.clientY - rect.top) * scale,
    };
  };

  const empty = strokesRef.current.length === 0;

  return (
    <div className="fz-sketch">
      <canvas
        ref={canvasRef}
        className="fz-sketch-canvas"
        width={SKETCH_SIZE}
        height={SKETCH_SIZE}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawingRef.current = true;
          strokesRef.current.push({
            points: [toLocal(e)],
            color,
            width,
            erase,
          });
          repaint();
        }}
        onPointerMove={(e) => {
          if (!drawingRef.current) return;
          strokesRef.current[strokesRef.current.length - 1]?.points.push(
            toLocal(e)
          );
          repaint();
        }}
        onPointerUp={() => {
          drawingRef.current = false;
          bump((n) => n + 1);
        }}
      />
      <div className="fz-tools">
        {PALETTE.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={`fz-swatch${!erase && color === swatch ? " selected" : ""}`}
            style={{ background: swatch }}
            aria-label={`paint ${swatch}`}
            onClick={() => {
              setColor(swatch);
              setErase(false);
            }}
          />
        ))}
        <button
          type="button"
          className={`fz-ghost${erase ? " selected" : ""}`}
          onClick={() => setErase((v) => !v)}
        >
          erase
        </button>
        <input
          className="fz-size"
          type="range"
          min={4}
          max={60}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          aria-label="brush size"
        />
        <button
          type="button"
          className="fz-ghost"
          disabled={empty}
          onClick={() => {
            strokesRef.current = [];
            repaint();
            bump((n) => n + 1);
          }}
        >
          clear
        </button>
      </div>
      <textarea
        className="fz-prompt"
        placeholder="describe the scene — 'two friends at a diner, neon light'"
        value={prompt}
        maxLength={2000}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="fz-modes">
        {SKETCH_MODES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={mode === entry.id ? "active" : ""}
            onClick={() => setMode(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="fz-primary"
        disabled={props.busy || !prompt.trim()}
        onClick={() => {
          const canvas = canvasRef.current;
          const hasInk = strokesRef.current.length > 0;
          if (hasInk && canvas) {
            canvas.toBlob(
              (blob) => props.onGenerate(blob, prompt.trim(), mode),
              "image/png"
            );
          } else {
            props.onGenerate(null, prompt.trim(), mode);
          }
        }}
      >
        {props.busy ? "generating…" : "generate the still"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------ video → frame */

/** Scrub step — the reference editor steps in 1/30-second increments. */
const FRAME_STEP = 1 / 30;
/** Room under the 12MB upload cap for the extracted JPEG. */
const MAX_FRAME_BYTES = 10 * 1024 * 1024;

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2) {
      resolve();
      return;
    }
    const timer = window.setTimeout(() => {
      video.removeEventListener("seeked", done);
      reject(new Error("couldn't read that frame"));
    }, 10000);
    function done() {
      window.clearTimeout(timer);
      resolve();
    }
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = time;
  });
}

function drawFrame(video: HTMLVideoElement, width: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(width, video.videoWidth);
  canvas.height = Math.round(
    (canvas.width * video.videoHeight) / Math.max(1, video.videoWidth)
  );
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function thumbAt(
  video: HTMLVideoElement,
  at: number
): Promise<string | null> {
  try {
    await seekTo(video, at);
    const canvas = drawFrame(video, 160);
    return canvas ? canvas.toDataURL("image/jpeg", 0.8) : null;
  } catch {
    return null;
  }
}

function VideoFramePick(props: {
  busy: boolean;
  onFrame: (file: File) => void;
}) {
  const { busy, onFrame } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const urlRef = useRef<string | null>(null);
  // Set on every scrub until the element's "seeked" lands — capture must
  // not drawImage while a seek is still decoding (it paints the old frame).
  const pendingSeekRef = useRef(false);
  // Monotonic generation per clip pick: a slower read must not revoke or
  // overwrite the state of a clip selected after it.
  const pickGenRef = useRef(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [thumbs, setThumbs] = useState<{ src: string; time: number }[]>([]);
  const [reading, setReading] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const onPick = useCallback(async (file: File | null) => {
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith("video/")) {
      setErr("choose a video — mp4, mov, or webm");
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      setErr("choose a clip under 150mb");
      return;
    }
    setReading(true);
    const gen = ++pickGenRef.current;
    const url = URL.createObjectURL(file);
    const stale = () => pickGenRef.current !== gen;
    try {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error("that clip took too long to read")),
          20000
        );
        video.onloadeddata = () => {
          window.clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error("can't decode that video — try an h.264 mp4"));
        };
        video.src = url;
      });
      if (
        !Number.isFinite(video.duration) ||
        video.duration <= 0 ||
        video.duration > 120
      ) {
        throw new Error("choose a clip under two minutes");
      }
      if (stale()) {
        URL.revokeObjectURL(url);
        return;
      }
      // Filmstrip — ten evenly spaced frames for quick orientation, each
      // tagged with its own timestamp so a dropped frame can't shift the
      // seek targets of the ones that remain. Bounded overall: a slow
      // decode shouldn't hold the picker past the strip deadline.
      const strip: { src: string; time: number }[] = [];
      const stripDeadline = Date.now() + 15_000;
      for (let i = 0; i < 10 && !stale() && Date.now() < stripDeadline; i++) {
        const at = Math.max(
          0,
          Math.min(video.duration - 0.05, (video.duration * i) / 10)
        );
        const thumb = await thumbAt(video, at);
        if (thumb) strip.push({ src: thumb, time: at });
      }
      if (stale()) {
        URL.revokeObjectURL(url);
        return;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setVideoUrl(url);
      setDuration(video.duration);
      setTime(video.duration / 2);
      setThumbs(strip);
      video.removeAttribute("src");
      video.load();
    } catch (e) {
      URL.revokeObjectURL(url);
      // A superseded read neither reports its error nor stands the
      // "different clip" button down — the newer pick owns both.
      if (!stale()) {
        setErr(e instanceof Error ? e.message : "that video didn't load");
      }
    } finally {
      if (!stale()) setReading(false);
    }
  }, []);

  const scrubTo = useCallback(
    (t: number) => {
      setTime(t);
      const video = videoRef.current;
      if (video) {
        video.pause();
        pendingSeekRef.current = true;
        video.currentTime = t;
      }
    },
    []
  );

  const snap = useCallback(async () => {
    const video = videoRef.current;
    if (!video || snapping || busy) return;
    setSnapping(true);
    try {
      // Land the exact timestamp before capture — drawImage on an
      // un-decoded time paints the previous frame. A scrub already in
      // flight counts: wait out its "seeked" rather than re-seeking.
      if (
        pendingSeekRef.current ||
        video.readyState < 2 ||
        Math.abs(video.currentTime - time) > 0.001
      ) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            video.removeEventListener("seeked", done);
            reject(new Error("couldn't read that frame"));
          }, 10000);
          const done = () => {
            window.clearTimeout(timer);
            resolve();
          };
          video.addEventListener("seeked", done, { once: true });
          if (!pendingSeekRef.current) video.currentTime = time;
        });
      }
      let width = Math.min(1920, video.videoWidth);
      let blob: Blob | null = null;
      while (width > 0) {
        const canvas = drawFrame(video, width);
        if (!canvas) throw new Error("frame capture isn't available");
        blob = await new Promise<Blob | null>((r) =>
          canvas.toBlob((b) => r(b), "image/jpeg", 0.94)
        );
        if (!blob) throw new Error("frame capture isn't available");
        if (blob.size <= MAX_FRAME_BYTES || width <= 320) break;
        width = Math.floor(width * 0.75);
      }
      if (!blob || blob.size > MAX_FRAME_BYTES) {
        throw new Error("that frame is too large — try a smaller clip");
      }
      onFrame(new File([blob], "freeze-frame.jpg", { type: "image/jpeg" }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "couldn't capture the frame");
    } finally {
      setSnapping(false);
    }
  }, [time, snapping, busy, onFrame]);

  return (
    <div className="fz-framepick">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
      />
      {!videoUrl ? (
        <div className="fz-video-empty">
          <p className="fz-sub">
            pick the clip — then scrub to the moment to freeze
          </p>
          <button
            type="button"
            className="fz-primary"
            disabled={reading}
            onClick={() => inputRef.current?.click()}
          >
            {reading ? "reading the clip…" : "choose a video"}
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="fz-video"
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            onLoadedData={(e) => {
              // First decode lands on frame 0 — the selection starts
              // mid-clip.
              pendingSeekRef.current = true;
              e.currentTarget.currentTime = time;
            }}
            onSeeked={() => {
              pendingSeekRef.current = false;
            }}
          />
          {thumbs.length > 0 && (
            <div className="fz-strip">
              {thumbs.map((t, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- jpeg data URLs, not optimizable
                <img
                  key={i}
                  src={t.src}
                  alt=""
                  onClick={() => scrubTo(t.time)}
                />
              ))}
            </div>
          )}
          <input
            type="range"
            className="fz-scrub"
            min={0}
            max={Math.max(FRAME_STEP, duration)}
            step={FRAME_STEP}
            value={time}
            onChange={(e) => scrubTo(Number(e.target.value))}
            aria-label="pick the frame"
          />
          <div className="fz-row">
            <button
              type="button"
              className="fz-ghost"
              disabled={reading}
              onClick={() => inputRef.current?.click()}
            >
              different clip
            </button>
            <button
              type="button"
              className="fz-primary"
              disabled={snapping || busy}
              onClick={() => void snap()}
            >
              {snapping ? "capturing…" : `freeze at ${time.toFixed(2)}s`}
            </button>
          </div>
        </>
      )}
      {err && <p className="fz-err">{err}</p>}
    </div>
  );
}

/* ---------------------------------------------------------- stage canvas */

/**
 * The orbit editor's camera model: azimuth sweeps the ellipse ring around
 * the photo billboard, elevation lifts the glyph off the ring, distance
 * scales the ring. cos(azimuth) < 0 is behind the photo — drawn dimmer.
 */
function project(
  pose: CameraKeyframe,
  w: number,
  h: number
): { x: number; y: number; depth: number } {
  const cx = w / 2;
  const cy = h * 0.46;
  const rx = w * 0.36 * pose.distance;
  const ry = h * 0.11 * pose.distance;
  const a = pose.azimuth * DEG;
  return {
    x: cx + Math.sin(a) * rx,
    y: cy + h * 0.16 + Math.cos(a) * ry - Math.sin(pose.elevation * DEG) * h * 0.3,
    depth: Math.cos(a),
  };
}

/* ---------------------------------------------------------- 3D viewport */

/**
 * The studio viewport is a real 3D scene (the reference editor's look): the
 * photo stands as a plane at the origin over a floor grid, the trajectory
 * sweeps around it as a tube, and the shot camera glyph rides the scrub
 * time. `poseToWorld` maps the render contract's spherical pose — azimuth
 * around Y, elevation off the horizon, distance as a radius multiplier —
 * into editor space. Fallback below is the original flat projection when
 * WebGL isn't available.
 */
const SUBJECT_Y = 0.95;
const ORBIT_RADIUS = 2.3;

function poseToWorld(
  pose: CameraKeyframe,
  out: THREE.Vector3
): THREE.Vector3 {
  const az = pose.azimuth * DEG;
  const el = pose.elevation * DEG;
  const d = ORBIT_RADIUS * pose.distance;
  out.set(
    Math.sin(az) * Math.cos(el) * d,
    SUBJECT_Y + Math.sin(el) * d,
    Math.cos(az) * Math.cos(el) * d
  );
  return out;
}

interface ThreeStage {
  setImage(img: HTMLImageElement | null): void;
  update(
    frames: CameraKeyframe[],
    scrubT: number,
    selected: number | null
  ): void;
  pick(x: number, y: number): number | null;
  dispose(): void;
}

/** Flat MeshBasicMaterial everywhere — no lights, matches the pixel shell. */
function createThreeStage(host: HTMLDivElement): ThreeStage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  host.appendChild(renderer.domElement);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
  camera.position.set(3.15, 2.05, 3.55);
  camera.lookAt(0, 0.85, 0);

  const grid = track(new THREE.GridHelper(14, 28, 0x2c4a6e, 0x16263e));
  scene.add(grid);

  // photo billboard: backing plate + image plane + border edge
  const photoW = 1.7;
  const photoH = photoW * 0.72;
  const frame = new THREE.Mesh(
    track(new THREE.PlaneGeometry(photoW * 1.07, photoH * 1.1)),
    track(new THREE.MeshBasicMaterial({ color: 0x0e1a30 }))
  );
  frame.position.set(0, SUBJECT_Y, 0);
  const photoMat = track(
    new THREE.MeshBasicMaterial({ color: 0x44598a })
  );
  const photoGeo = track(new THREE.PlaneGeometry(photoW, photoH));
  const photo = new THREE.Mesh(photoGeo, photoMat);
  photo.position.set(0, SUBJECT_Y, 0.001);
  const border = new THREE.LineSegments(
    track(new THREE.EdgesGeometry(photoGeo)),
    track(new THREE.LineBasicMaterial({ color: 0x7dbeff }))
  );
  border.position.copy(photo.position);
  scene.add(frame, photo, border);

  const tubeMat = track(
    new THREE.MeshBasicMaterial({ color: 0x60dcff })
  );
  let tube: THREE.Mesh | null = null;

  const kfGroup = new THREE.Group();
  scene.add(kfGroup);
  const kfGeo = track(new THREE.SphereGeometry(0.05, 16, 12));
  const kfMat = track(new THREE.MeshBasicMaterial({ color: 0x60dcff }));
  const kfSelMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));

  // shot-camera glyph: gold body + nose cone aimed at the subject
  const glyphMat = track(
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true })
  );
  const glyph = new THREE.Group();
  glyph.add(
    new THREE.Mesh(track(new THREE.SphereGeometry(0.075, 18, 14)), glyphMat)
  );
  const nose = new THREE.Mesh(
    track(new THREE.ConeGeometry(0.048, 0.17, 12)),
    glyphMat
  );
  nose.rotation.x = Math.PI / 2; // cone axis +Y → +Z so lookAt aims the tip
  nose.position.z = 0.14;
  glyph.add(nose);
  scene.add(glyph);

  const sightGeo = track(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, SUBJECT_Y, 0),
    ])
  );
  const sight = new THREE.Line(
    sightGeo,
    track(
      new THREE.LineDashedMaterial({
        color: 0xffd166,
        dashSize: 0.09,
        gapSize: 0.09,
        transparent: true,
        opacity: 0.45,
      })
    )
  );
  sight.computeLineDistances();
  scene.add(sight);

  const tmp = new THREE.Vector3();
  const subject = new THREE.Vector3(0, SUBJECT_Y, 0);
  let lastFrames: CameraKeyframe[] = [];

  const render = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    const size = new THREE.Vector2();
    renderer.getSize(size);
    if (size.x !== w || size.y !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  };

  const observer = new ResizeObserver(render);
  observer.observe(host);

  let photoTex: THREE.Texture | null = null;

  return {
    setImage(img) {
      // A re-signed URL re-uploads the same still — dispose the previous
      // texture or a polling render leaks GPU memory until the WebView OOMs.
      photoTex?.dispose();
      if (img) {
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        photoTex = tex;
        photoMat.map = tex;
        photoMat.color.set(0xffffff);
      } else {
        photoTex = null;
        photoMat.map = null;
        photoMat.color.set(0x44598a);
      }
      photoMat.needsUpdate = true;
      render();
    },
    update(frames, scrubT, selected) {
      lastFrames = frames;
      if (frames.length >= 2) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 96; i++) {
          pts.push(poseToWorld(poseAt(frames, i / 96), new THREE.Vector3()));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(curve, 120, 0.018, 8, false);
        const next = new THREE.Mesh(geo, tubeMat);
        if (tube) {
          scene.remove(tube);
          tube.geometry.dispose();
        }
        tube = next;
        scene.add(tube);
      } else if (tube) {
        scene.remove(tube);
        tube.geometry.dispose();
        tube = null;
      }
      kfGroup.clear();
      frames.forEach((kf, i) => {
        const dot = new THREE.Mesh(kfGeo, i === selected ? kfSelMat : kfMat);
        dot.position.copy(poseToWorld(kf, tmp));
        if (i === selected) dot.scale.setScalar(1.3);
        dot.userData["index"] = i;
        kfGroup.add(dot);
      });
      const camPose = poseAt(frames, scrubT);
      glyph.position.copy(poseToWorld(camPose, tmp));
      glyph.lookAt(subject);
      // behind the photo (back hemisphere) the glyph dims, same as 2D depth
      glyphMat.opacity = Math.cos(camPose.azimuth * DEG) < -0.05 ? 0.45 : 1;
      sightGeo.setFromPoints([glyph.position.clone(), subject.clone()]);
      sight.computeLineDistances();
      render();
    },
    pick(x, y) {
      const w = host.clientWidth;
      const h = host.clientHeight;
      let best: number | null = null;
      let bestD = 30;
      lastFrames.forEach((kf, i) => {
        poseToWorld(kf, tmp).project(camera);
        const sx = (tmp.x * 0.5 + 0.5) * w;
        const sy = (-tmp.y * 0.5 + 0.5) * h;
        const d = Math.hypot(sx - x, sy - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    },
    dispose() {
      observer.disconnect();
      photoTex?.dispose();
      disposables.forEach((d) => d.dispose());
      tube?.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

interface StageProps {
  image: HTMLImageElement | null;
  keyframes: CameraKeyframe[];
  scrubT: number;
  selected: number | null;
  /** lite (card) surfaces don't get WebGL — render the 2D editor directly */
  lite: boolean | undefined;
  onDragPose: (azimuth: number, elevation: number) => void;
  onPick: (index: number | null) => void;
}

function StageCanvas(props: StageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<ThreeStage | null>(null);
  const [glReady, setGlReady] = useState(false);
  const dragRef = useRef<{ moved: boolean; picked: number | null } | null>(
    null
  );
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || propsRef.current.lite) return;
    let stage: ThreeStage | null = null;
    try {
      stage = createThreeStage(host);
    } catch {
      return; // no WebGL — the 2D canvas below keeps editing working
    }
    stageRef.current = stage;
    setGlReady(true);
    return () => {
      stageRef.current = null;
      stage.dispose();
    };
  }, []);

  useEffect(() => {
    stageRef.current?.setImage(props.image);
  }, [glReady, props.image]);

  useEffect(() => {
    stageRef.current?.update(props.keyframes, props.scrubT, props.selected);
  });

  return (
    <div
      ref={hostRef}
      className="fz-stage-canvas"
      onPointerDown={(e) => {
        if (!glReady) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const hit =
          stageRef.current?.pick(
            e.clientX - rect.left,
            e.clientY - rect.top
          ) ?? null;
        if (hit !== null) propsRef.current.onPick(hit);
        dragRef.current = { moved: false, picked: hit };
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || !glReady) return;
        const dx = e.movementX;
        const dy = e.movementY;
        if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
        drag.moved = true;
        propsRef.current.onDragPose(dx * 0.6, -dy * 0.4);
      }}
      onPointerUp={() => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag || drag.moved || !glReady) return;
        propsRef.current.onPick(drag.picked);
      }}
    >
      {!glReady && <StageCanvas2D {...props} />}
    </div>
  );
}

/** No-WebGL fallback: the original flat orbit-ellipse projection. */
function StageCanvas2D(props: StageProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const draw = useCallback(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // floor grid
    ctx.strokeStyle = "rgba(120,170,255,0.10)";
    ctx.lineWidth = 1;
    const horizon = h * 0.62;
    for (let i = 0; i <= 12; i++) {
      const yy = horizon + Math.pow(i / 12, 1.6) * (h - horizon);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * w * 0.07, horizon);
      ctx.lineTo(w / 2 + i * w * 0.22, h);
      ctx.stroke();
    }

    const cx = w / 2;
    const cy = h * 0.46;
    // orbit ring
    const rx = w * 0.36;
    const ry = h * 0.11;
    ctx.strokeStyle = "rgba(125,190,255,0.22)";
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.16, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // trajectory ribbon
    const path = props.keyframes;
    if (path.length >= 2) {
      ctx.strokeStyle = "rgba(96,220,255,0.9)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      const STEPS = 96;
      for (let i = 0; i <= STEPS; i++) {
        const p = project(poseAt(path, i / STEPS), w, h);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // photo billboard
    const pw = Math.min(w * 0.4, h * 0.4 * (4 / 3));
    const ph = pw * 0.72;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#0e1a30";
    ctx.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
    ctx.restore();
    if (props.image) {
      const img = props.image;
      const scale = Math.min(pw / img.width, ph / img.height);
      const iw = img.width * scale;
      const ih = img.height * scale;
      ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
    } else {
      ctx.fillStyle = "rgba(219,232,255,0.5)";
      ctx.font = "13px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("no photo", cx, cy);
    }
    ctx.strokeStyle = "rgba(125,190,255,0.5)";
    ctx.strokeRect(cx - pw / 2, cy - ph / 2, pw, ph);

    // keyframe dots
    path.forEach((kf, i) => {
      const p = project(kf, w, h);
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === props.selected ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === props.selected ? "#ffffff" : "#60dcff";
      ctx.fill();
      if (i === props.selected) {
        ctx.strokeStyle = "rgba(96,220,255,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // camera glyph at scrub time
    const cam = poseAt(path, props.scrubT);
    const p = project(cam, w, h);
    const behind = p.depth < -0.05;
    ctx.globalAlpha = behind ? 0.45 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd166";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#0a1120";
    ctx.fill();
    // sightline to the photo
    ctx.strokeStyle = "rgba(255,209,102,0.35)";
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }, [props.image, props.keyframes, props.scrubT, props.selected]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  return (
    <canvas
      ref={ref}
      className="fz-stage-canvas"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // pick a nearby keyframe dot first
        const hit = props.keyframes.findIndex((kf) => {
          const p = project(kf, rect.width, rect.height);
          return Math.hypot(p.x - x, p.y - y) < 20;
        });
        if (hit >= 0) props.onPick(hit);
        dragRef.current = { x, y, moved: false };
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = e.movementX ?? e.clientX - drag.x;
        const dy = e.movementY ?? e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
        drag.moved = true;
        drag.x = e.clientX;
        drag.y = e.clientY;
        props.onDragPose(dx * 0.6, -dy * 0.4);
      }}
      onPointerUp={(e) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (drag && !drag.moved) {
          const rect = e.currentTarget.getBoundingClientRect();
          const hit = props.keyframes.findIndex((kf) => {
            const p = project(kf, rect.width, rect.height);
            return (
              Math.hypot(p.x - (e.clientX - rect.left), p.y - (e.clientY - rect.top)) <
              20
            );
          });
          props.onPick(hit >= 0 ? hit : null);
        }
      }}
    />
  );
}

/* -------------------------------------------------------------- studio */

type Stage = "source" | "camera" | "result";

function Studio(props: { initial: Payload }) {
  const [stage, setStage] = useState<Stage>(
    props.initial.sourceAssetId ? "camera" : "source"
  );
  const [sourceUrl, setSourceUrl] = useState<string | null>(
    props.initial.sourceUrl
  );
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(
    props.initial.sourceAssetId
  );
  const [renders, setRenders] = useState<FreezeJob[]>(props.initial.renders);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(
    props.initial.activeJob
  );
  const [latest, setLatest] = useState(props.initial.latest);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [showSketch, setShowSketch] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  // The job this page admitted — the action returns at admit-time and the
  // poll resolves it, so cancel stays reachable through the whole render.
  const [watchJob, setWatchJob] = useState<{
    id: string;
    kind: "sketch" | "render";
  } | null>(null);

  const [keyframes, setKeyframes] = useState<CameraKeyframe[]>([
    START_KEYFRAME,
    { time: 0.5, azimuth: 65, elevation: 8, distance: 1 },
    END_KEYFRAME,
  ]);
  const [scrubT, setScrubT] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [duration, setDuration] = useState<5 | 6>(5);
  const [resolution, setResolution] = useState("768P");
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000));

  const imageRef = useRef<HTMLImageElement | null>(null);
  const [, imageBump] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const lastMediaRefresh = useRef(0);
  const sourceAssetRef = useRef(props.initial.sourceAssetId);
  // Object URL minted for the instant camera-stage preview — revoked once a
  // signed URL (or another preview) replaces it.
  const objectUrlRef = useRef<string | null>(null);

  const applySourceUrl = useCallback((url: string) => {
    const prev = objectUrlRef.current;
    if (prev && prev !== url) {
      URL.revokeObjectURL(prev);
      objectUrlRef.current = null;
    }
    if (url.startsWith("blob:")) objectUrlRef.current = url;
    setSourceUrl(url);
  }, []);

  const clearSourceUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSourceUrl(null);
  }, []);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  const adopt = useCallback(
    (payload: Payload, forceSource = false) => {
      if (typeof payload.latest === "number") setLatest(payload.latest);
      setActiveJob(payload.activeJob ?? null);
      // The expired-status stub carries a line instead of job rows — the
      // poll stood itself down, so the note is all the client shows.
      if (payload.line) setLine(payload.line);
      // The poll re-mints the source URL every round trip — only take a new
      // one when the asset changed (or a media error forced a re-sign), so
      // the stage doesn't re-upload the same still to the GPU each poll.
      if (
        payload.sourceUrl &&
        (forceSource || payload.sourceAssetId !== sourceAssetRef.current)
      ) {
        applySourceUrl(payload.sourceUrl);
      }
      if (payload.sourceAssetId) {
        sourceAssetRef.current = payload.sourceAssetId;
        setSourceAssetId(payload.sourceAssetId);
      }
      if (payload.renders) setRenders(payload.renders);
      // Resolve a watched job once its slot frees: the deliver outcome
      // advances the stage, the failure surfaces its line.
      if (watchJob && !payload.activeJob) {
        const list =
          watchJob.kind === "render" ? payload.renders : payload.sketches;
        const entry = list?.find((r) => r.jobId === watchJob.id);
        if (entry && (entry.state === "delivered" || entry.state === "failed")) {
          setWatchJob(null);
          if (entry.state === "delivered") {
            if (watchJob.kind === "render") {
              setLine(null);
              setStage("result");
            } else {
              setShowSketch(false);
              setLine("still delivered — set the camera move");
              setStage("camera");
            }
          } else {
            setLine(entry.error ?? "that didn't come out — try again?");
          }
        }
      }
    },
    [watchJob, applySourceUrl]
  );

  // Sequence guard: status pulls are detached and can land out of order —
  // a stale response must not restore an older source over a newer upload.
  const statusSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++statusSeqRef.current;
    const payload = await postAction({ action: "status", after: String(latest) });
    if (!payload || seq !== statusSeqRef.current) return;
    adopt(payload);
    return payload;
  }, [latest, adopt]);

  // An accepted upload without a signed URL and without a local preview
  // (e.g. HEIC whose inline sign failed) gets a bounded wait for the
  // converted URL — the editor stays cleared rather than showing the
  // previous still.
  const waitForSignedSource = useCallback(
    async (assetId: string) => {
      for (let i = 0; i < 10; i++) {
        // A newer accepted upload ends this loop — it must never write the
        // line or force-adopt after being superseded.
        if (sourceAssetRef.current !== assetId) return;
        const payload = await refresh();
        if (sourceAssetRef.current !== assetId) return;
        if (payload && payload.sourceAssetId === assetId) {
          // adopt skips URL swaps for an already-known asset — the known
          // asset is exactly what we're waiting on, so force it.
          adopt(payload, true);
          if (payload.sourceUrl) {
            setLine(null);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (sourceAssetRef.current === assetId) {
        setLine("still converting — back out and re-upload if it stalls");
      }
    },
    [refresh, adopt]
  );

  // Signed media URLs lapse after the delivery TTL; a media element that
  // errors on an open surface pulls fresh signatures — throttled so a
  // genuinely-gone asset doesn't loop forever.
  const refreshMedia = useCallback(() => {
    const now = Date.now();
    if (now - lastMediaRefresh.current < 30_000) return;
    lastMediaRefresh.current = now;
    void refresh().then((payload) => {
      if (payload) adopt(payload, true);
    });
  }, [refresh, adopt]);

  // Load generation: consecutive uploads start decodes that can finish out
  // of order — only the current generation may write imageRef.
  const imgGenRef = useRef(0);

  useEffect(() => {
    const gen = ++imgGenRef.current;
    if (!sourceUrl) {
      imageRef.current = null;
      // A cleared source still has to reach the stage — without the bump the
      // last image stays textured until some unrelated re-render.
      imageBump((n) => n + 1);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (gen !== imgGenRef.current) return;
      imageRef.current = img;
      imageBump((n) => n + 1);
    };
    img.onerror = () => {
      if (gen === imgGenRef.current) refreshMedia();
    };
    img.src = sourceUrl;
  }, [sourceUrl, refreshMedia]);

  // While a job is in flight (this device started it or a reload found it)
  // poll so the stage flips when it lands. Serialized: a pull slower than
  // the interval must not be superseded by its own successor — the seq
  // guard exists for cross-call ordering (uploads, retries), not to starve
  // the poll itself.
  useEffect(() => {
    if (!activeJob) return;
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void refresh().finally(() => {
        inFlight = false;
      });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [activeJob, refresh]);

  const fail = (payload: Payload | null, fallback: string) =>
    setLine(payload?.line ?? fallback);

  /* ------------------------------- source stage */

  const onFile = useCallback(
    async (file: File | null) => {
      if (!file || busy) return;
      setBusy(true);
      setLine("reading the photo…");
      // Mint the preview up front — the camera stage shows the still the
      // instant the upload is accepted instead of waiting on a status pull.
      // HEIC/HEIF can't render in <img> — those wait for the server's
      // converted PNG (delivered by the same trailing status pull).
      const previewable =
        file.type.startsWith("image/") && !/hei[cf]/i.test(file.type);
      const previewUrl = previewable ? URL.createObjectURL(file) : null;
      const form = new FormData();
      form.set("action", "source");
      form.set("file", file);
      const payload = await postAction(form);
      setBusy(false);
      if (!payload || payload.error || payload.sourceAssetId === undefined) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        fail(payload, "that photo didn't come through — try another.");
        return;
      }
      setLine(null);
      setSourceAssetId(payload.sourceAssetId);
      setShowSketch(false);
      setShowVideo(false);
      // Mark the accepted asset before the trailing status pull: its adopt
      // must swap in the fresh URL (or leave a same-asset blob preview).
      sourceAssetRef.current = payload.sourceAssetId;
      if (payload.sourceUrl) {
        // The upload response signs the stored still — HEIC included, since
        // conversion already happened server-side. The minted preview is
        // unused on this path; release it now.
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        applySourceUrl(payload.sourceUrl);
      } else if (previewUrl) {
        applySourceUrl(previewUrl);
      } else {
        // Never show the previous still while the new source is enabled.
        clearSourceUrl();
        setLine("converting the photo…");
      }
      setStage("camera");
      void refresh();
      if (!payload.sourceUrl && !previewUrl && payload.sourceAssetId) {
        void waitForSignedSource(payload.sourceAssetId);
      }
    },
    [busy, refresh, applySourceUrl, clearSourceUrl, waitForSignedSource]
  );

  const onSketch = useCallback(
    async (canvas: Blob | null, prompt: string, mode: string) => {
      if (busy) return;
      setBusy(true);
      setLine("generating the still — about a minute");
      const form = new FormData();
      form.set("action", "source");
      form.set("kind", "sketch");
      form.set("prompt", prompt);
      form.set("mode", mode);
      if (canvas) form.set("canvas", canvas, "sketch.png");
      const payload = await postAction(form);
      setBusy(false);
      if (!payload || payload.error || !payload.jobId) {
        fail(payload, "that didn't work — try again?");
        return;
      }
      // The job keeps running after this response — watch it through the
      // status poll; the still lands in the payload's source fields.
      setWatchJob({ id: payload.jobId, kind: "sketch" });
      adopt(payload);
      setLine("generating the still — about a minute");
    },
    [busy, adopt]
  );

  /* ------------------------------- camera stage */

  const applyPreset = useCallback((entry: Preset) => {
    setPreset(entry.id);
    setDuration(entry.duration === 6 ? 6 : 5);
    setKeyframes(entry.trajectory.map((kf) => ({ ...kf })));
    setSelected(null);
    setScrubT(0);
  }, []);

  const addKeyframe = useCallback(() => {
    setKeyframes((frames) => {
      if (frames.length >= FREEZE_MAX_KEYFRAMES) return frames;
      const t = clamp(scrubT, 0.02, 0.98);
      if (frames.some((f) => Math.abs(f.time - t) < 0.01)) return frames;
      const pose = poseAt(frames, t);
      const next = [...frames, { ...pose, time: t }]
        .sort((a, b) => a.time - b.time)
        .map((f) => ({ ...f }));
      return next;
    });
    setPreset(null);
  }, [scrubT]);

  const removeKeyframe = useCallback(() => {
    setKeyframes((frames) => {
      if (selected === null || frames.length <= 2) return frames;
      const kf = frames[selected];
      if (!kf || kf.time === 0 || kf.time === 1) return frames;
      return frames.filter((_, i) => i !== selected);
    });
    setSelected(null);
    setPreset(null);
  }, [selected]);

  const onDragPose = useCallback(
    (dAzimuth: number, dElevation: number) => {
      setPreset(null);
      setKeyframes((frames) => {
        // Dragging edits the selected keyframe — with nothing selected it
        // edits whichever keyframe sits nearest the scrub time, so the
        // "move the camera to change it" gesture always lands somewhere.
        let index = selected;
        if (index === null) {
          let best = Infinity;
          frames.forEach((kf, i) => {
            const d = Math.abs(kf.time - scrubT);
            if (d < best) {
              best = d;
              index = i;
            }
          });
        }
        if (index === null) return frames;
        const kf = frames[index];
        // Endpoints are pinned to the reference framing — the prompt
        // instructs the render to begin (and often end) on the source
        // image's exact composition.
        if (!kf || kf.time === 0 || kf.time === 1) return frames;
        const next = frames.map((frame, i) =>
          i === index
            ? {
                ...frame,
                azimuth: clamp(frame.azimuth + dAzimuth, -360, 360),
                elevation: clamp(frame.elevation + dElevation, -90, 90),
              }
            : frame
        );
        setSelected(index);
        return next;
      });
    },
    [selected, scrubT]
  );

  const onRender = useCallback(async () => {
    if (busy || !sourceAssetId || !sourceUrl) return;
    setBusy(true);
    setLine("rendering the freeze — a few minutes");
    const fields: Record<string, string> = {
      action: "render",
      duration: String(duration),
      resolution,
      seed: String(seed),
    };
    // A preset is a named trajectory — the chosen duration still applies
    // on top of the preset's default.
    if (preset) {
      fields["preset"] = preset;
    } else {
      fields["trajectory"] = JSON.stringify(keyframes);
    }
    const payload = await postAction(fields);
    setBusy(false);
    if (!payload || payload.error || !payload.jobId) {
      fail(payload, "that render didn't start — try again?");
      return;
    }
    setWatchJob({ id: payload.jobId, kind: "render" });
    adopt(payload);
    setLine("freezing — a few minutes");
  }, [busy, sourceAssetId, sourceUrl, preset, resolution, seed, keyframes, duration, adopt]);

  const onSave = useCallback(
    async (jobId: string) => {
      if (busy) return;
      setBusy(true);
      setLine("sending to iMessage…");
      const payload = await postAction({ action: "save", job: jobId });
      setBusy(false);
      if (!payload || payload.error) {
        fail(payload, "couldn't send it — try again");
        return;
      }
      if (payload.downloadUrl) {
        window.open(payload.downloadUrl, "_blank", "noopener");
        setLine("sent the link — it's only good for a little while");
      } else {
        setLine("sent to iMessage");
      }
    },
    [busy]
  );

  const onCancel = useCallback(async () => {
    await postAction({ action: "cancel" });
    setWatchJob(null);
    setLine(null);
    await refresh();
  }, [refresh]);

  const rendersReady = useMemo(
    () => renders.filter((r) => r.state === "delivered" && r.outputUrl),
    [renders]
  );
  const latestRender = rendersReady[rendersReady.length - 1];

  /* ------------------------------- render */

  return (
    <div className="fz">
      <div className="fz-tabs">
        {(["source", "camera", "result"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={stage === tab ? "active" : ""}
            disabled={
              (tab === "camera" && !sourceAssetId) ||
              (tab === "result" && rendersReady.length === 0)
            }
            onClick={() => setStage(tab)}
          >
            {tab === "source" ? "1 · photo" : tab === "camera" ? "2 · camera" : "3 · freeze"}
          </button>
        ))}
      </div>
      {activeJob && (
        <button
          type="button"
          className="fz-ghost"
          onClick={() => void onCancel()}
        >
          cancel the running job
        </button>
      )}

      {stage === "source" && (
        <div className="fz-stage">
          {!showSketch && !showVideo ? (
            <>
              <div className="fz-hero">
                <p className="fz-title">freeze the scene</p>
                <p className="fz-sub">
                  pick the still — the camera moves, the moment doesn&rsquo;t
                </p>
              </div>
              <div className="fz-source-grid">
                <button
                  type="button"
                  className="fz-card"
                  disabled={busy}
                  onClick={() => cameraRef.current?.click()}
                >
                  <span className="fz-card-icon">◉</span>
                  take a photo
                </button>
                <button
                  type="button"
                  className="fz-card"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <span className="fz-card-icon">▤</span>
                  upload a photo
                </button>
                <button
                  type="button"
                  className="fz-card"
                  disabled={busy}
                  onClick={() => setShowSketch(true)}
                >
                  <span className="fz-card-icon">✎</span>
                  sketch + generate
                </button>
                <button
                  type="button"
                  className="fz-card"
                  disabled={busy}
                  onClick={() => setShowVideo(true)}
                >
                  <span className="fz-card-icon">▶</span>
                  video → freeze a frame
                </button>
              </div>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                hidden
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.heic,.heif"
                hidden
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              {rendersReady.length > 0 && (
                <button
                  type="button"
                  className="fz-ghost"
                  onClick={() => setStage("result")}
                >
                  see your freezes →
                </button>
              )}
            </>
          ) : showSketch ? (
            <>
              <button
                type="button"
                className="fz-ghost"
                onClick={() => setShowSketch(false)}
              >
                ← back
              </button>
              <SketchPad
                busy={busy || watchJob?.kind === "sketch"}
                onGenerate={onSketch}
              />
            </>
          ) : (
            <>
              <button
                type="button"
                className="fz-ghost"
                onClick={() => setShowVideo(false)}
              >
                ← back
              </button>
              <VideoFramePick busy={busy} onFrame={(f) => void onFile(f)} />
            </>
          )}
        </div>
      )}

      {stage === "camera" && (
        <div className="fz-stage">
          <div className="fz-stage-wrap">
            <StageCanvas
              image={imageRef.current}
              keyframes={keyframes}
              scrubT={scrubT}
              selected={selected}
              lite={props.initial.lite}
              onDragPose={onDragPose}
              onPick={setSelected}
            />
          </div>

          <div className="fz-presets">
            {props.initial.presets.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`fz-chip${preset === entry.id ? " active" : ""}`}
                title={entry.description}
                onClick={() => applyPreset(entry)}
              >
                {entry.name}
              </button>
            ))}
          </div>

          <div className="fz-timeline">
            <div
              className="fz-track"
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setScrubT(clamp((e.clientX - rect.left) / rect.width, 0, 1));
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setScrubT(clamp((e.clientX - rect.left) / rect.width, 0, 1));
              }}
            >
              <div className="fz-track-line" />
              {keyframes.map((kf, i) => (
                <button
                  key={i}
                  type="button"
                  className={`fz-kf${selected === i ? " selected" : ""}`}
                  style={{ left: `${kf.time * 100}%` }}
                  // Stop propagation on pointerdown: the track captures the
                  // pointer there, and a captured pointer retargets every
                  // later event (incl. click) to the track — the dot's own
                  // click never lands without this.
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelected(i);
                    setScrubT(kf.time);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`keyframe ${i + 1} at ${Math.round(kf.time * 100)}%`}
                />
              ))}
              <div className="fz-head" style={{ left: `${scrubT * 100}%` }} />
            </div>
            <div className="fz-timeline-row">
              <span className="fz-meta">
                {keyframes.length} keyframes · {duration}s
                {selected !== null
                  ? ` · keyframe ${selected + 1}: ${
                      keyframes[selected]!.time === 0 || keyframes[selected]!.time === 1
                        ? "endpoints stay"
                        : "drag the stage to change it"
                    }`
                  : " · tap a dot, drag the stage"}
              </span>
              <div className="fz-timeline-actions">
                <button
                  type="button"
                  className="fz-ghost"
                  disabled={keyframes.length >= FREEZE_MAX_KEYFRAMES}
                  onClick={addKeyframe}
                >
                  + keyframe
                </button>
                <button
                  type="button"
                  className="fz-ghost"
                  disabled={
                    selected === null ||
                    keyframes[selected]?.time === 0 ||
                    keyframes[selected]?.time === 1
                  }
                  onClick={removeKeyframe}
                >
                  − remove
                </button>
              </div>
            </div>
          </div>

          <div className="fz-render-row">
            <div className="fz-seg">
              {[5, 6].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={duration === s ? "active" : ""}
                  onClick={() => setDuration(s as 5 | 6)}
                >
                  {s}s
                </button>
              ))}
            </div>
            <div className="fz-seg">
              {["480P", "768P", "1080P"].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={resolution === r ? "active" : ""}
                  onClick={() => setResolution(r)}
                >
                  {r === "480P" ? "480" : r === "768P" ? "720" : "1080"}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="fz-primary"
              disabled={busy || !sourceAssetId || !sourceUrl || watchJob !== null}
              onClick={() => void onRender()}
            >
              {watchJob?.kind === "render" || busy ? "freezing…" : "freeze it"}
            </button>
          </div>
        </div>
      )}

      {stage === "result" && (
        <div className="fz-stage">
          {latestRender ? (
            <div className="fz-result">
              <video
                className="fz-video"
                src={latestRender.outputUrl ?? undefined}
                controls
                playsInline
                loop
                autoPlay
                muted
                onError={refreshMedia}
              />
              <div className="fz-actions">
                <button
                  type="button"
                  className="fz-primary"
                  disabled={busy}
                  onClick={() => void onSave(latestRender.jobId)}
                >
                  send to iMessage
                </button>
                <button
                  type="button"
                  className="fz-ghost"
                  onClick={() => setStage("camera")}
                >
                  new camera move
                </button>
              </div>
            </div>
          ) : activeJob ? (
            <p className="fz-sub">rendering — this takes a few minutes</p>
          ) : (
            <p className="fz-sub">nothing rendered yet</p>
          )}
          {rendersReady.length > 1 && (
            <div className="fz-history">
              {rendersReady.slice(0, -1).reverse().map((job) => (
                <div key={job.jobId} className="fz-history-row">
                  <video
                    className="fz-thumb"
                    src={job.outputUrl ?? undefined}
                    muted
                    playsInline
                    preload="metadata"
                    onError={refreshMedia}
                  />
                  <button
                    type="button"
                    className="fz-ghost"
                    onClick={() => void onSave(job.jobId)}
                  >
                    send
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="fz-line">{line ?? ""}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- css */

const CSS = `
.fz{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;font-family:var(--font-ui,ui-monospace,monospace)}
.fz-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:#070a12;border-radius:12px;padding:3px}
.fz-tabs button{min-height:40px;border:0;border-radius:9px;background:transparent;color:#7d94bb;font-weight:750;font-size:0.72rem;letter-spacing:0.04em;text-transform:uppercase}
.fz-tabs button.active{background:#123d72c7;color:#9dd8ff;box-shadow:inset 0 0 0 1px #4db0ff55}
.fz-tabs button:disabled{opacity:0.35}
.fz-stage{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0}
.fz-hero{text-align:center;padding:14px 8px 4px}
.fz-title{margin:0;color:#f8fbff;font-size:1.5rem;font-weight:850;letter-spacing:-0.02em}
.fz-sub{margin:6px 0 0;color:#7d94bb;font-size:0.8rem}
.fz-source-grid{display:grid;grid-template-columns:1fr;gap:10px;padding:10px 4px}
.fz-card{display:flex;align-items:center;gap:14px;min-height:84px;padding:16px;border:1px solid #75baff44;border-radius:16px;background:linear-gradient(135deg,#111d35d9,#080d1ae8);color:#f8fbff;font-size:1rem;font-weight:750;text-align:left;box-shadow:inset 0 1px #e6f4ff1c,0 14px 34px #0006}
.fz-card-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:#123d72c7;color:#9dd8ff;font-size:1.3rem;flex:0 0 46px}
.fz-card:active{transform:translateY(1px)}
.fz-card:disabled{opacity:0.5}
.fz-sketch{display:flex;flex-direction:column;gap:8px}
.fz-sketch-canvas{width:100%;aspect-ratio:1;border-radius:14px;background:#0a1120;border:1px solid #75baff44;touch-action:none}
.fz-tools{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.fz-swatch{display:block;width:32px;min-height:32px;padding:0;border:2px solid #f8fbff33;border-radius:50%;flex:0 0 32px}
.fz-swatch.selected{border-color:#f8fbff;outline:2px solid #4db0ff;outline-offset:2px}
.fz-size{flex:1;min-width:70px;accent-color:#3ca7ff}
.fz-prompt{width:100%;min-height:3rem;max-height:6rem;font-size:1rem;padding:10px 12px;background:#12213a9c;border:1px solid #7dbfff55;border-radius:10px;color:#f8fbff;font-family:inherit;resize:vertical}
.fz-prompt::placeholder{color:#5d739a}
.fz-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:#070a12;border-radius:12px;padding:3px}
.fz-modes button{display:grid;place-items:center;min-height:44px;border:0;border-radius:9px;background:transparent;color:#7d94bb;font-size:0.66rem;font-weight:700;padding:4px}
.fz-modes button.active{background:#123d72c7;color:#9dd8ff;box-shadow:inset 0 0 0 1px #4db0ff55}
.fz-stage-wrap{position:relative;flex:1;min-height:240px;border-radius:16px;overflow:hidden;background:radial-gradient(120% 90% at 50% 10%,#101d36 0%,#070b15 70%);border:1px solid #75baff33}
.fz-stage-canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.fz-presets{display:flex;gap:6px;overflow-x:auto;padding:2px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.fz-presets::-webkit-scrollbar{display:none}
.fz-chip{flex:0 0 auto;min-height:36px;padding:6px 13px;border:1px solid #6facf144;border-radius:999px;background:#0b1425c9;color:#dbe8ff;font-size:0.72rem;font-weight:700;white-space:nowrap}
.fz-chip.active{background:#123d72c7;color:#9dd8ff;border-color:#4db0ff;box-shadow:0 0 0 1px #3ca7ff55,0 0 14px #3ca7ff44}
.fz-timeline{display:flex;flex-direction:column;gap:4px;padding:0 2px}
.fz-track{position:relative;height:44px;touch-action:none;cursor:pointer}
.fz-track-line{position:absolute;left:0;right:0;top:50%;height:2px;background:#2a4a78;border-radius:2px}
.fz-kf{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;padding:0;border:2px solid #60dcff;border-radius:50%;background:#0a1120}
.fz-kf.selected{background:#ffd166;border-color:#ffd166}
.fz-head{position:absolute;top:6px;bottom:6px;width:2px;margin-left:-1px;background:#ffd166;border-radius:2px;pointer-events:none}
.fz-timeline-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.fz-meta{color:#7d94bb;font-size:0.66rem}
.fz-timeline-actions{display:flex;gap:6px}
.fz-render-row{display:flex;align-items:center;gap:8px}
.fz-seg{display:flex;background:#070a12;border-radius:10px;padding:2px}
.fz-seg button{min-width:44px;min-height:38px;border:0;border-radius:8px;background:transparent;color:#7d94bb;font-size:0.7rem;font-weight:750}
.fz-seg button.active{background:#123d72c7;color:#9dd8ff}
.fz-primary{flex:1;min-height:46px;border:0;border-radius:12px;background:linear-gradient(135deg,#2f8be8,#1760c8);color:#f8fbff;font-weight:850;font-size:0.9rem;letter-spacing:0.02em;box-shadow:inset 0 1px #eff9ff4a,0 10px 22px #0a52b64c}
.fz-primary:disabled{opacity:0.5}
.fz-ghost{min-height:38px;padding:8px 12px;border:1px solid #6facf144;border-radius:10px;background:#183354aa;color:#f8fbff;font-weight:700;font-size:0.7rem;letter-spacing:0.04em;text-transform:uppercase}
.fz-ghost:disabled{opacity:0.35}
.fz-ghost.selected{border-color:#4db0ff;color:#9dd8ff}
.fz-result{display:flex;flex-direction:column;gap:10px}
.fz-video{width:100%;border-radius:14px;background:#000;max-height:56vh}
.fz-framepick{display:flex;flex-direction:column;gap:8px}
.fz-video-empty{display:flex;flex-direction:column;gap:10px;align-items:center;padding:18px 8px}
.fz-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.fz-strip img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;border:1px solid #75baff33;display:block}
.fz-scrub{width:100%;min-height:36px;accent-color:#3ca7ff;touch-action:pan-x}
.fz-row{display:flex;gap:8px;align-items:center}
.fz-err{margin:0;text-align:center;font-size:0.72rem;color:#ff9d9d}
.fz-actions{display:flex;gap:8px}
.fz-history{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.fz-history-row{display:flex;align-items:center;gap:10px}
.fz-thumb{width:88px;border-radius:8px;background:#000}
.fz-line{margin:0;min-height:1rem;text-align:center;font-size:0.72rem;color:#dbe8ff}
@media(prefers-reduced-motion:reduce){.fz-card,.fz-primary{transition:none}}
`;

const mountEl = document.getElementById("freeze-studio");
if (mountEl) {
  let initial: Payload | null = null;
  try {
    initial = JSON.parse(mountEl.dataset["payload"] ?? "") as Payload;
  } catch {
    initial = null;
  }
  if (initial) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    createRoot(mountEl).render(
      <StrictMode>
        <Studio initial={initial} />
      </StrictMode>
    );
  }
}
