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

function StageCanvas(props: {
  image: HTMLImageElement | null;
  keyframes: CameraKeyframe[];
  scrubT: number;
  selected: number | null;
  onDragPose: (azimuth: number, elevation: number) => void;
  onPick: (index: number | null) => void;
}) {
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

  useEffect(() => {
    if (!sourceUrl) {
      imageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      imageBump((n) => n + 1);
    };
    img.src = sourceUrl;
  }, [sourceUrl]);

  const refresh = useCallback(async () => {
    const payload = await postAction({ action: "status", after: String(latest) });
    if (!payload) return;
    setLatest(payload.latest ?? latest);
    setActiveJob(payload.activeJob ?? null);
    if (payload.sourceUrl) setSourceUrl(payload.sourceUrl);
    if (payload.sourceAssetId) setSourceAssetId(payload.sourceAssetId);
    if (payload.renders) setRenders(payload.renders);
    return payload;
  }, [latest]);

  // While a job is in flight (this device started it or a reload found it)
  // poll so the stage flips when it lands.
  useEffect(() => {
    if (!activeJob) return;
    const timer = window.setInterval(() => {
      void refresh();
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
      const form = new FormData();
      form.set("action", "source");
      form.set("file", file);
      const payload = await postAction(form);
      setBusy(false);
      if (!payload || payload.error || payload.sourceAssetId === undefined) {
        fail(payload, "that photo didn't come through — try another.");
        return;
      }
      setLine(null);
      // a fresh status pull picks up the signed preview + source pointer
      await refresh();
      setStage("camera");
    },
    [busy, refresh]
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
      setLine("still delivered — set the camera move");
      await refresh();
      setStage("camera");
    },
    [busy, refresh]
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
    if (busy || !sourceAssetId) return;
    setBusy(true);
    setLine("rendering the freeze — a few minutes");
    const fields: Record<string, string> = { action: "render" };
    if (preset) {
      fields["preset"] = preset;
      fields["resolution"] = resolution;
      fields["seed"] = String(seed);
    } else {
      fields["trajectory"] = JSON.stringify(keyframes);
      fields["duration"] = String(duration);
      fields["resolution"] = resolution;
      fields["seed"] = String(seed);
    }
    const payload = await postAction(fields);
    setBusy(false);
    if (!payload || payload.error || !payload.jobId) {
      fail(payload, "that render didn't start — try again?");
      return;
    }
    setLine(null);
    await refresh();
    setStage("result");
  }, [busy, sourceAssetId, preset, resolution, seed, keyframes, duration, refresh]);

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

      {stage === "source" && (
        <div className="fz-stage">
          {!showSketch ? (
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
          ) : (
            <>
              <button
                type="button"
                className="fz-ghost"
                onClick={() => setShowSketch(false)}
              >
                ← back
              </button>
              <SketchPad busy={busy} onGenerate={onSketch} />
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
                <button type="button" className="fz-ghost" onClick={addKeyframe}>
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
              disabled={busy || !sourceAssetId}
              onClick={() => void onRender()}
            >
              {busy ? "freezing…" : "freeze it"}
            </button>
          </div>
          {activeJob && (
            <button type="button" className="fz-ghost" onClick={() => void onCancel()}>
              cancel the running job
            </button>
          )}
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
