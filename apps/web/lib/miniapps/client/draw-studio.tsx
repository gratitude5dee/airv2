/**
 * /draw studio client — bundled to public/creator-os/draw-studio.js by
 * scripts/build-draw-studio.mjs and mounted onto #draw-studio inside the
 * mini-app shell (same-origin under script-src 'self'). Ported from
 * mayor-coast's draw-studio.tsx: dual 1024 canvases (white background layer
 * + stroke layer), a five-color palette, an eraser via destination-out,
 * Sketch/Preview tabs, a revision strip, and Generate / Animate / Send
 * actions over the mini-app's format=json action lane.
 *
 * Progress is a ~2.5s status poll against the same route — GMI delivers
 * the finished render only, so there is no preview stream to wire (the
 * plan's documented divergence from mayor-coast's live partial_images).
 * sessionStorage holds only ephemeral UI state (selected revision); the
 * content of the studio lives server-side on draw_sessions + creative_jobs.
 */
import {
  StrictMode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

/* ------------------------------------------------------------ protocol */

interface DrawRevision {
  jobId: string;
  parentJobId: string | null;
  rootJobId: string;
  revisionNumber: number;
  mode: string | null;
  state: string;
  outputAssetId: string | null;
  outputUrl: string | null;
  inputUrl: string | null;
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
  initialAssetUrl: string | null;
  revisions: DrawRevision[];
  /** present on action responses */
  jobId?: string;
  status?: string;
  line?: string;
  assetId?: string;
  deliveryUrl?: string;
  sent?: boolean;
  downloadUrl?: string;
  error?: string;
}

async function postAction(
  fields: Record<string, string>
): Promise<Payload | null> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
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

/* -------------------------------------------------- canvas (mayor-coast) */

const CANVAS_SIZE = 1024;
const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  erase: boolean;
}

function canvasPoint(clientX: number, clientY: number, rect: DOMRect): Point {
  const scale = CANVAS_SIZE / Math.max(1, Math.min(rect.width, rect.height));
  return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
}

/** Contain-fit a source rect into the square canvas (mayor-coast parity). */
function containImage(
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(CANVAS_SIZE / width, CANVAS_SIZE / height);
  const w = width * scale;
  const h = height * scale;
  return { x: (CANVAS_SIZE - w) / 2, y: (CANVAS_SIZE - h) / 2, width: w, height: h };
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (!stroke.points.length) return;
  ctx.save();
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const [first, ...rest] = stroke.points;
  if (!first) {
    ctx.restore();
    return;
  }
  if (!rest.length) {
    ctx.beginPath();
    ctx.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const point of rest) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.restore();
}

function hasVisibleInk(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! > 16) return true;
  }
  return false;
}

/* ---------------------------------------------------------------- model */

const COLORS = ["#070a12", "#286dde", "#ef3340", "#26b4ed", "#ffffff"];
const SIZES = [8, 16, 28, 44, 64];
const MODES = ["fast", "detailed", "turbo", "hq"] as const;
type Mode = (typeof MODES)[number];
const MODE_LABELS: Record<Mode, string> = {
  fast: "Flare Fast",
  detailed: "Flare Detailed",
  turbo: "Turbo",
  hq: "Sunburst HQ",
};

const ACTIVE_STATUSES = ["routing", "submitted", "polling", "submit_unknown"];

function jobLabel(status: string): string {
  switch (status) {
    case "routing":
    case "submitted":
      return "Preparing…";
    case "polling":
      return "Generating…";
    case "submit_unknown":
      return "Confirming…";
    case "delivered":
      return "Image ready";
    case "failed":
      return "Failed";
    case "refused":
      return "Refused";
    default:
      return status;
  }
}

type BackgroundKind = "none" | "import" | "result";

const ERROR_LINES: Record<string, string> = {
  JOB_ALREADY_ACTIVE: "Another image is still generating.",
  SESSION_EXPIRED: "This draw session has ended — send /draw for a fresh card.",
  PARENT_UNAVAILABLE: "That result is no longer available — try a fresh sketch.",
  JOB_NOT_READY: "That image isn't ready yet.",
  EMPTY: "Sketch something or describe it first.",
};

function errorLine(payload: Payload | null): string {
  if (!payload) return "that didn't work — try again?";
  if (payload.line) return payload.line;
  if (payload.error && ERROR_LINES[payload.error]) return ERROR_LINES[payload.error]!;
  return "that didn't work — try again?";
}

/* ----------------------------------------------------------------- app */

function Studio({ initial }: { initial: Payload }): React.ReactElement {
  const [tab, setTab] = useState<"sketch" | "preview">("sketch");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[1]!);
  const [size, setSize] = useState(28);
  const [eraser, setEraser] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(
    initial.initialAssetUrl
  );
  const [backgroundKind, setBackgroundKind] = useState<BackgroundKind>(
    initial.initialAssetUrl ? "import" : "none"
  );
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("fast");
  const [resetContext, setResetContext] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<DrawRevision[]>(initial.revisions);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(
    initial.activeJob
  );
  const [latest, setLatest] = useState(initial.latest);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial.revisions.filter((r) => r.outputUrl).at(-1)?.outputUrl ?? null
  );
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    () => {
      try {
        return sessionStorage.getItem(
          `air-draw-revision:${initial.sessionId}`
        );
      } catch {
        return null;
      }
    }
  );

  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const pointerId = useRef<number | null>(null);
  const livePoints = useRef<Point[]>([]);
  const [, forceInk] = useState(0);

  const delivered = revisions.filter((r) => r.state === "delivered");
  const targetRevision =
    delivered.find((r) => r.jobId === selectedRevisionId) ??
    delivered.at(-1) ??
    null;
  const refining =
    backgroundKind === "result" && targetRevision !== null;
  const jobActive =
    activeJob !== null && ACTIVE_STATUSES.includes(activeJob.status);

  /* ---------------------------------------------------------- painting */

  useEffect(() => {
    const canvas = strokeCanvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    for (const stroke of strokes) paintStroke(ctx, stroke);
    if (livePoints.current.length > 1) {
      paintStroke(ctx, {
        points: livePoints.current,
        color,
        width: size,
        erase: eraser,
      });
    }
  }, [strokes, color, size, eraser]);

  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (!backgroundUrl) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
      const fit = containImage(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(image, fit.x, fit.y, fit.width, fit.height);
    };
    image.onerror = () => setMessage("the background image couldn't load");
    image.src = backgroundUrl;
  }, [backgroundUrl]);

  const eventPoint = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
      const canvas = strokeCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return canvasPoint(event.clientX, event.clientY, rect);
    },
    []
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): void => {
      if (tab !== "sketch" || jobActive) return;
      event.preventDefault();
      const point = eventPoint(event);
      if (!point) return;
      pointerId.current = event.pointerId;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* constrained webview fallback */
      }
      livePoints.current = [point];
      forceInk((n) => n + 1);
    },
    [tab, jobActive, eventPoint]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): void => {
      if (pointerId.current !== event.pointerId) return;
      event.preventDefault();
      const point = eventPoint(event);
      if (point && livePoints.current.length < 4096) {
        livePoints.current.push(point);
        forceInk((n) => n + 1);
      }
    },
    [eventPoint]
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): void => {
      if (pointerId.current !== event.pointerId) return;
      pointerId.current = null;
      const points = livePoints.current;
      livePoints.current = [];
      if (points.length) {
        const stroke: Stroke = {
          points,
          color,
          width: size,
          erase: eraser,
        };
        setStrokes((value) => [...value, stroke]);
        setRedoStack([]);
      }
      forceInk((n) => n + 1);
    },
    [color, size, eraser]
  );

  /* ----------------------------------------------------------- polling */

  const poll = useCallback(async (): Promise<void> => {
    const payload = await postAction({ action: "status", after: String(latest) });
    if (!payload || payload.error) return;
    setLatest(payload.latest);
    setActiveJob(payload.activeJob);
    setRevisions(payload.revisions);
    const newest = payload.revisions.filter((r) => r.outputUrl).at(-1);
    if (newest?.outputUrl) setPreviewUrl(newest.outputUrl);
  }, [latest]);

  useEffect(() => {
    // ~2.5s cadence: the render lane has no preview stream, so the strip
    // updates when a 'completed' event lands in the poll payload.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    setPreviewUrl(
      targetRevision?.outputUrl ??
        revisions.filter((r) => r.outputUrl).at(-1)?.outputUrl ??
        null
    );
  }, [targetRevision?.outputUrl, revisions]);

  /* ----------------------------------------------------------- actions */

  const inkPresent = useCallback((): boolean => {
    const ctx = strokeCanvasRef.current?.getContext("2d");
    if (!ctx) return false;
    return hasVisibleInk(
      ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data
    );
  }, []);

  const flatten = useCallback((): string | null => {
    const bg = bgCanvasRef.current;
    const ink = strokeCanvasRef.current;
    if (!bg || !ink) return null;
    const out = document.createElement("canvas");
    out.width = CANVAS_SIZE;
    out.height = CANVAS_SIZE;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(ink, 0, 0);
    try {
      return out.toDataURL("image/png");
    } catch {
      return null;
    }
  }, []);

  const importImage = useCallback((file: File | undefined): void => {
    if (!file) return;
    if (
      file.size > IMPORT_MAX_BYTES ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setMessage("choose a JPEG, PNG, or WebP under 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBackgroundUrl(reader.result);
        setBackgroundKind("import");
        setStrokes([]);
        setRedoStack([]);
        setTab("sketch");
        setMessage("image imported — draw over it or describe the change");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const generate = useCallback(async (): Promise<void> => {
    if (busy || jobActive) return;
    const ink = inkPresent();
    if (!prompt.trim() && !ink && !backgroundUrl) {
      setMessage("sketch something, import an image, or write a prompt first");
      return;
    }
    const parentJobId = refining ? targetRevision!.jobId : undefined;
    // No fresh pixels → the parent's stored output is the edit source; no
    // upload needed (mayor-coast's reuseParentArtifact).
    const reuseParent = Boolean(parentJobId && !ink && !backgroundUrl);
    setBusy("generate");
    setMessage("preparing…");
    try {
      let inputAssetId: string | undefined;
      if (!reuseParent && (ink || backgroundUrl)) {
        const flattened = flatten();
        if (!flattened) {
          setMessage("couldn't read the canvas — try again");
          return;
        }
        const uploaded = await postAction({
          action: "upload",
          image: flattened,
        });
        if (!uploaded?.assetId) {
          setMessage(errorLine(uploaded));
          return;
        }
        inputAssetId = uploaded.assetId;
      }
      const fields: Record<string, string> = {
        action: "generate",
        prompt: prompt.trim(),
        mode,
      };
      if (inputAssetId) fields["inputAssetId"] = inputAssetId;
      if (parentJobId) fields["parentJobId"] = parentJobId;
      if (resetContext) fields["resetContext"] = "1";
      const payload = await postAction(fields);
      if (!payload) {
        setMessage("the render didn't answer — pull to retry");
        return;
      }
      if (payload.error) {
        setMessage(errorLine(payload));
        return;
      }
      setActiveJob(payload.activeJob);
      setLatest(payload.latest);
      setRevisions(payload.revisions);
      setMessage(
        payload.status === "delivered"
          ? (payload.line ?? "image ready")
          : (payload.line ?? null)
      );
      if (payload.deliveryUrl) {
        setPreviewUrl(payload.deliveryUrl);
        setTab("preview");
      }
      if (payload.status === "delivered") {
        setStrokes([]);
        setRedoStack([]);
      }
    } finally {
      setBusy(null);
    }
  }, [
    busy,
    jobActive,
    prompt,
    mode,
    resetContext,
    backgroundUrl,
    refining,
    targetRevision,
    inkPresent,
    flatten,
  ]);

  const animate = useCallback(async (): Promise<void> => {
    if (busy || !targetRevision) return;
    setBusy("animate");
    setMessage("animating…");
    try {
      const fields: Record<string, string> = {
        action: "animate",
        jobId: targetRevision.jobId,
      };
      if (prompt.trim()) fields["motionPrompt"] = prompt.trim();
      const payload = await postAction(fields);
      if (!payload || payload.error) {
        setMessage(errorLine(payload));
        return;
      }
      setMessage(
        payload.status === "delivered"
          ? "video ready — check iMessage for the clip or tap save"
          : (payload.line ?? null)
      );
      if (payload.deliveryUrl) setPreviewUrl(payload.deliveryUrl);
    } finally {
      setBusy(null);
    }
  }, [busy, targetRevision, prompt]);

  const save = useCallback(async (): Promise<void> => {
    if (busy || !targetRevision) return;
    setBusy("save");
    try {
      const payload = await postAction({
        action: "save",
        jobId: targetRevision.jobId,
      });
      if (payload?.sent) {
        setMessage("sent to iMessage");
      } else if (payload?.downloadUrl) {
        window.open(payload.downloadUrl, "_blank", "noopener");
        setMessage("couldn't attach it — opened a download link instead");
      } else {
        setMessage(errorLine(payload));
      }
    } finally {
      setBusy(null);
    }
  }, [busy, targetRevision]);

  const cancel = useCallback(async (): Promise<void> => {
    await postAction({ action: "cancel" });
    setActiveJob(null);
    setMessage("cancelled");
  }, []);

  const refine = useCallback((): void => {
    if (!targetRevision?.outputUrl) return;
    setBackgroundUrl(targetRevision.outputUrl);
    setBackgroundKind("result");
    setStrokes([]);
    setRedoStack([]);
    setTab("sketch");
    setMessage("refining that image — draw over it or describe the change");
  }, [targetRevision]);

  const discard = useCallback((): void => {
    setStrokes([]);
    setRedoStack([]);
    setBackgroundUrl(null);
    setBackgroundKind("none");
    setMessage(null);
  }, []);

  const selectRevision = useCallback(
    (revision: DrawRevision): void => {
      setSelectedRevisionId(revision.jobId);
      try {
        sessionStorage.setItem(
          `air-draw-revision:${initial.sessionId}`,
          revision.jobId
        );
      } catch {
        /* private mode */
      }
      if (revision.outputUrl) {
        setPreviewUrl(revision.outputUrl);
        setTab("preview");
      }
    },
    [initial.sessionId]
  );

  /* ------------------------------------------------------------ render */

  const hasInk =
    strokes.length > 0 || livePoints.current.length > 0;

  return (
    <div className="ds-root">
      <div className="ds-top">
        <div className="ds-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sketch"}
            className={tab === "sketch" ? "active" : ""}
            onClick={() => setTab("sketch")}
          >
            Sketch
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={tab === "preview" ? "active" : ""}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
        </div>
        <span className="ds-status" aria-live="polite">
          {jobActive && activeJob
            ? jobLabel(activeJob.status)
            : busy === "animate"
              ? "Animating…"
              : message ?? ""}
        </span>
      </div>

      {revisions.length > 0 ? (
        <div className="ds-revisions" aria-label="Revisions">
          {revisions.map((revision) => (
            <button
              key={revision.jobId}
              type="button"
              className={
                revision.jobId === targetRevision?.jobId ? "selected" : ""
              }
              onClick={() => selectRevision(revision)}
              disabled={!revision.outputUrl}
            >
              {revision.outputUrl ? (
                <img src={revision.outputUrl} alt="" />
              ) : (
                <span className="ds-rev-empty" />
              )}
              <small>
                r{revision.revisionNumber}
                {revision.mode ? ` · ${MODE_LABELS[revision.mode as Mode] ?? revision.mode}` : ""}
              </small>
              {ACTIVE_STATUSES.includes(revision.state) ? (
                <em>{jobLabel(revision.state)}</em>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="ds-canvas-zone">
        <div className="ds-viewport">
          <canvas ref={bgCanvasRef} className="ds-layer" />
          <canvas
            ref={strokeCanvasRef}
            className={`ds-layer ds-ink${tab !== "sketch" || jobActive ? " is-faded" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {tab === "preview" && previewUrl ? (
            /\.(mp4|mov)(\?|$)/i.test(previewUrl) ? (
              <video
                className="ds-preview is-visible"
                src={previewUrl}
                controls
                playsInline
              />
            ) : (
              <img className="ds-preview is-visible" src={previewUrl} alt="Generated" />
            )
          ) : null}
          {tab === "sketch" && !hasInk && !backgroundUrl ? (
            <span className="ds-hint">draw here</span>
          ) : null}
        </div>
      </div>

      <div className="ds-ink-controls">
        <div className="ds-palette">
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`ds-swatch${color === swatch && !eraser ? " selected" : ""}`}
              style={{ background: swatch }}
              aria-label={`color ${swatch}`}
              onClick={() => {
                setColor(swatch);
                setEraser(false);
              }}
            />
          ))}
        </div>
        <div className="ds-size">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={size === s ? "selected" : ""}
              onClick={() => setSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`ds-tool${eraser ? " selected" : ""}`}
          onClick={() => setEraser((v) => !v)}
        >
          Eraser
        </button>
        <button
          type="button"
          className="ds-tool"
          disabled={!strokes.length}
          onClick={() => {
            setStrokes((value) => {
              const next = [...value];
              const popped = next.pop();
              if (popped) setRedoStack((r) => [...r, popped]);
              return next;
            });
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className="ds-tool"
          disabled={!redoStack.length}
          onClick={() => {
            setRedoStack((value) => {
              const next = [...value];
              const popped = next.pop();
              if (popped) setStrokes((s) => [...s, popped]);
              return next;
            });
          }}
        >
          Redo
        </button>
        <label className="ds-tool ds-import">
          Import
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => importImage(event.target.files?.[0])}
          />
        </label>
        <button type="button" className="ds-tool" onClick={discard}>
          Clear
        </button>
      </div>

      <div className="ds-sheet">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            refining
              ? "follow-up instruction — e.g. make the sky sunset"
              : "describe the image (optional)"
          }
          aria-label="Prompt"
        />
        <div className="ds-modes" role="radiogroup" aria-label="Generation mode">
          {MODES.map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={mode === item}
              className={mode === item ? "active" : ""}
              onClick={() => setMode(item)}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>
        {refining ? (
          <button
            type="button"
            className={`ds-reset${resetContext ? " selected" : ""}`}
            onClick={() => setResetContext((v) => !v)}
          >
            {resetContext
              ? "new context — previous image ignored"
              : "refining selected result — tap to start fresh"}
          </button>
        ) : null}
        <div className="ds-actions">
          {jobActive ? (
            <button type="button" className="ds-cancel" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="ds-generate"
              disabled={busy !== null}
              onClick={() => void generate()}
            >
              {busy === "generate" ? "Generating…" : refining ? "Refine" : "Generate"}
            </button>
          )}
          {targetRevision ? (
            <>
              <button
                type="button"
                className="ds-secondary"
                disabled={busy !== null || jobActive}
                onClick={() => void animate()}
              >
                {busy === "animate" ? "Animating…" : "Animate"}
              </button>
              <button
                type="button"
                className="ds-secondary"
                disabled={busy !== null}
                onClick={refine}
              >
                Draw over
              </button>
              <button
                type="button"
                className="ds-save"
                disabled={busy !== null}
                onClick={() => void save()}
              >
                {busy === "save" ? "Sending…" : "Send to iMessage"}
              </button>
            </>
          ) : null}
        </div>
        {message ? <p className="ds-message">{message}</p> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ css */

const CSS = `
.ds-root{display:flex;flex-direction:column;gap:0.55rem;width:min(100%,44rem);min-height:0;flex:1}
.ds-top{display:flex;justify-content:space-between;align-items:center;gap:0.6rem}
.ds-tabs{display:flex;gap:0.3rem}
.ds-tabs button{background:transparent;color:var(--ink-muted);border:0;border-radius:var(--radius-well);padding:0.45rem 0.9rem;min-height:2.4rem;font-weight:600;box-shadow:none}
.ds-tabs button.active{background:var(--well-bg);color:var(--ink);border:1px solid var(--ring)}
.ds-status{font-size:0.72rem;color:var(--accent);letter-spacing:0.04em;min-height:1rem;text-align:right}
.ds-revisions{display:flex;gap:0.4rem;overflow-x:auto;scrollbar-width:none;padding-bottom:0.15rem}
.ds-revisions button{display:flex;flex-direction:column;gap:0.15rem;min-width:4.8rem;padding:0.4rem;text-align:left;color:var(--ink);border:1px solid var(--ring);border-radius:var(--radius-well);background:var(--panel-bg);min-height:3.2rem;box-shadow:none}
.ds-revisions button.selected{border-color:var(--accent)}
.ds-revisions button:disabled{opacity:0.45}
.ds-revisions img{width:3.2rem;height:2rem;object-fit:cover;border-radius:0.35rem;pointer-events:none}
.ds-rev-empty{width:3.2rem;height:2rem;border-radius:0.35rem;background:var(--well-bg)}
.ds-revisions small,.ds-revisions em{font-size:0.55rem;font-style:normal;color:var(--ink-muted);white-space:nowrap;font-family:var(--font-ui)}
.ds-revisions em{color:var(--accent)}
.ds-canvas-zone{flex:1;min-height:0;display:grid;place-items:center}
.ds-viewport{position:relative;width:min(100%,26rem);aspect-ratio:1;background:#fff;border-radius:var(--radius-panel);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;box-shadow:var(--shadow)}
.ds-layer{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.ds-ink{transition:opacity 0.2s ease}
.ds-ink.is-faded{opacity:0.25;pointer-events:none}
.ds-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:3}
.ds-hint{position:absolute;right:0.7rem;bottom:0.55rem;color:#8a8a95;font-size:0.62rem;z-index:4;pointer-events:none}
.ds-ink-controls{display:flex;align-items:center;gap:0.45rem;overflow-x:auto;scrollbar-width:none;padding:0.45rem 0.5rem;border:1px solid var(--ring);border-radius:var(--radius-panel);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur)}
.ds-palette{display:flex;gap:0.3rem;flex:0 0 auto}
.ds-swatch{display:block;width:2rem;min-height:2rem;padding:0;border:2px solid var(--ring);border-radius:50%;flex:0 0 2rem;box-shadow:none}
.ds-swatch.selected{outline:2px solid var(--accent);outline-offset:2px}
.ds-size{display:flex;align-items:center;gap:0.25rem;flex:0 0 auto}
.ds-size button{min-width:2rem;min-height:2rem;padding:0 0.3rem;border:1px solid var(--ring);border-radius:0.5rem;background:var(--well-bg);color:var(--ink-muted);font-size:0.6rem;box-shadow:none}
.ds-size button.selected{border-color:var(--accent);color:var(--ink)}
.ds-tool{min-height:2rem;padding:0.3rem 0.7rem;flex:0 0 auto;border:1px solid var(--ring);border-radius:0.55rem;background:var(--well-bg);color:var(--ink);font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;box-shadow:none}
.ds-tool.selected{border-color:var(--accent)}
.ds-tool:disabled{opacity:0.35}
.ds-import{position:relative;display:inline-flex;align-items:center;cursor:pointer;overflow:hidden}
.ds-import input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.ds-sheet{display:flex;flex-direction:column;gap:0.45rem;border:1px solid var(--ring);border-radius:var(--radius-panel);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);padding:0.6rem}
.ds-sheet textarea{width:100%;min-height:3rem;max-height:6rem;font-size:0.9rem}
.ds-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:0.3rem}
.ds-modes button{min-height:2.4rem;border:1px solid var(--ring);border-radius:0.55rem;background:var(--well-bg);color:var(--ink-muted);font-size:0.58rem;letter-spacing:0.04em;text-transform:uppercase;box-shadow:none;padding:0 0.2rem}
.ds-modes button.active{border-color:var(--accent);color:var(--on-accent);background:var(--accent)}
.ds-reset{min-height:2rem;border:1px solid var(--ring);border-radius:0.55rem;background:var(--well-bg);color:var(--ink-muted);font-size:0.62rem;letter-spacing:0.04em;box-shadow:none}
.ds-reset.selected{border-color:var(--accent);color:var(--accent)}
.ds-actions{display:flex;gap:0.4rem}
.ds-generate,.ds-save{flex:1;background:var(--accent);color:var(--on-accent)}
.ds-secondary{background:var(--well-bg);color:var(--ink);border:1px solid var(--ring)}
.ds-cancel{background:var(--well-bg);color:var(--ink);border:1px solid var(--ring);flex:1}
.ds-actions button:disabled{opacity:0.5}
.ds-message{font-size:0.68rem;color:var(--ink-muted);margin:0;min-height:0.9rem}
@media(prefers-reduced-motion:reduce){.ds-ink{transition:none}}
`;

const mountEl = document.getElementById("draw-studio");
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
