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
 * All studio state lives in React or server-side on draw_sessions +
 * creative_jobs — the mini-app contract (C17) forbids browser storage.
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
  /** the latest delivered zap job — animations aren't draw revisions, so
   * the server projects them separately or a reload loses the video. */
  latestAnimation?:
    | { jobId: string; url: string; createdAt?: string }
    | null;
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
  // Clamp to the pad: a finger sliding off the edge mid-stroke must not
  // paint (or measure) beyond the 1024 canvas.
  return {
    x: Math.max(0, Math.min(CANVAS_SIZE, (clientX - rect.left) * scale)),
    y: Math.max(0, Math.min(CANVAS_SIZE, (clientY - rect.top) * scale)),
  };
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

const COLORS = ["#0d1017", "#2f6fd0", "#ef3340", "#26b4ed", "#ffffff"];
const MODES = ["fast", "detailed", "turbo", "hq"] as const;
type Mode = (typeof MODES)[number];
const MODE_LABELS: Record<Mode, string> = {
  fast: "Flare Fast",
  detailed: "Flare Detailed",
  turbo: "Turbo",
  hq: "Sunburst HQ",
};

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** mayor-coast stroke icons: bolt / sliders / rocket / sunburst. */
function ModeIcon({ mode }: { mode: Mode }): React.ReactElement {
  if (mode === "fast") {
    return (
      <svg {...ICON_PROPS}>
        <path d="m13.2 2.5-8.1 11.1h6.1l-1 7.9 8.6-11.5h-6.3l.7-7.5Z" />
      </svg>
    );
  }
  if (mode === "detailed") {
    return (
      <svg {...ICON_PROPS}>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <path d="M8 4v4M16 10v4M11 16v4" />
        <circle cx="8" cy="6" r="1.35" />
        <circle cx="16" cy="12" r="1.35" />
        <circle cx="11" cy="18" r="1.35" />
      </svg>
    );
  }
  if (mode === "turbo") {
    return (
      <svg {...ICON_PROPS}>
        <path d="M14.5 3.2c3.3.1 5.4 1.6 6.1 2.4-.9 4.3-3.2 7.5-7 9.6l-4.8-4.8c2.1-3.8 5.3-6.1 5.7-7.2Z" />
        <path d="m9 10.2-3.8.8-1.5 3.2 3.4.4M13.8 15.2l-.8 3.8-3.2 1.5-.4-3.4M16.3 7.7h.01" />
        <path d="m8.2 16.8-2 3.1M6.4 15l-2.7.5" />
      </svg>
    );
  }
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3.35" />
      <path d="M12 2.5v2.1M12 19.4v2.1M21.5 12h-2.1M4.6 12H2.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5M18.7 18.7l-1.5-1.5M6.8 6.8 5.3 5.3" />
    </svg>
  );
}

/** Canvas-rail tool icons (undo / redo / clear / import). */
function ToolIcon({
  tool,
}: {
  tool: "undo" | "redo" | "clear" | "import";
}): React.ReactElement {
  if (tool === "undo") {
    return (
      <svg {...ICON_PROPS}>
        <path d="M9 7 4.5 11.5 9 16" />
        <path d="M5 11.5h8.1a5.4 5.4 0 0 1 5.4 5.4" />
      </svg>
    );
  }
  if (tool === "redo") {
    return (
      <svg {...ICON_PROPS}>
        <path d="m15 7 4.5 4.5-4.5 4.5" />
        <path d="M19 11.5h-8.1a5.4 5.4 0 0 0-5.4 5.4" />
      </svg>
    );
  }
  if (tool === "clear") {
    return (
      <svg {...ICON_PROPS}>
        <path d="m7.5 8.5 6.8-3.9 4.2 7.3-6.8 3.9z" />
        <path d="m6.2 15 2.2 3.8h9.3" />
      </svg>
    );
  }
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 15V3.5" />
      <path d="m7.7 7.8L12 3.5l4.3 4.3" />
      <path d="M5 14.5v4.2c0 .9.7 1.6 1.6 1.6h10.8c.9 0 1.6-.7 1.6-1.6v-4.2" />
    </svg>
  );
}

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
  // The shown asset starts from the same source as the Send target. The
  // animation only wins when it's the newest delivered media — a still
  // generated after animating must not resurrect the older video on reload.
  const initialNewestRev = initial.revisions
    .filter((r) => r.outputUrl)
    .at(-1);
  const anim = initial.latestAnimation;
  const initialAnimation =
    anim?.url &&
    anim.jobId &&
    (!anim.createdAt ||
      !initialNewestRev?.createdAt ||
      Date.parse(anim.createdAt) >= Date.parse(initialNewestRev.createdAt))
      ? anim
      : null;
  const initialPreview = initialAnimation
    ? { jobId: initialAnimation.jobId, url: initialAnimation.url }
    : {
        jobId: initialNewestRev?.jobId ?? null,
        url: initialNewestRev?.outputUrl ?? null,
      };
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialPreview.url
  );
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    null
  );
  // The preview only paints once its image actually decoded — a blind tab
  // flip shows a torn frame in a constrained webview (mayor-coast parity).
  const [decodedPreviewUrl, setDecodedPreviewUrl] = useState<string | null>(
    null
  );
  // Which job the preview shows, plus the freshest signed URL seen for it.
  // Signatures rotate every poll and expire after 30 min, while sessions
  // live 24h — so the rendered src stays stable per asset, images quietly
  // swap to a decoded re-signed URL at most once a minute, and video keeps
  // its src (a swap would restart playback) with freshUrl for error retry.
  const previewAsset = useRef<{
    jobId: string | null;
    url: string | null;
    freshUrl: string | null;
    refreshedAt: number;
  }>({
    jobId: initialPreview.jobId,
    url: initialPreview.url,
    freshUrl: null,
    refreshedAt: 0,
  });
  const showAsset = useCallback(
    (jobId: string | null, url: string | null): void => {
      const shown = previewAsset.current;
      if (url && jobId && shown.jobId === jobId) {
        shown.freshUrl = url;
        if (url === shown.url) return;
        if (/\.(mp4|mov)(\?|$)/i.test(url)) return;
        if (Date.now() - shown.refreshedAt < 60_000) return;
        shown.refreshedAt = Date.now();
        const image = new Image();
        image.onload = () => {
          if (previewAsset.current.jobId === jobId) {
            previewAsset.current.url = url;
            setPreviewUrl(url);
            setDecodedPreviewUrl(url);
          }
        };
        image.src = url;
        return;
      }
      previewAsset.current = { jobId, url, freshUrl: null, refreshedAt: 0 };
      setPreviewUrl(url);
    },
    []
  );
  // Expired media src → swap to the freshest signed URL the polls recorded.
  const retryFreshUrl = useCallback((): void => {
    const shown = previewAsset.current;
    if (shown.freshUrl && shown.freshUrl !== shown.url) {
      previewAsset.current = { ...shown, url: shown.freshUrl, freshUrl: null };
      setDecodedPreviewUrl(null);
      setPreviewUrl(shown.freshUrl);
    }
  }, []);
  // A job submitted this session may flip itself to Preview exactly once;
  // an explicit tab choice by the user cancels that (explicit view wins).
  // Reopening a card mid-render arms it too — the user came back to watch
  // that job finish.
  const autoRevealJob = useRef<string | null>(
    initial.activeJob && ACTIVE_STATUSES.includes(initial.activeJob.status)
      ? initial.activeJob.id
      : null
  );
  // Bumped on every explicit tab pick — a response that lands after the
  // user chose a view during the request must not re-arm the reveal.
  const viewVersion = useRef(0);
  // The job whose reveal the user cancelled. null alone can't distinguish
  // "never armed" from "cancelled", so the poll must not re-arm it.
  const dismissedReveal = useRef<string | null>(null);
  // The media the preview/save target: a delivered zap job isn't a draw
  // revision, so it carries its own pointer until the user picks a revision.
  const [animatedJobId, setAnimatedJobId] = useState<string | null>(
    initialAnimation?.jobId ?? null
  );
  // While set, the revision poll must not restore a still over the video.
  const [animatedPreviewUrl, setAnimatedPreviewUrl] = useState<string | null>(
    initialAnimation?.url ?? null
  );
  // An animation the user navigated away from must not be resurrected by
  // the next poll — a NEW animation (different job id) still adopts.
  const dismissedAnimation = useRef<string | null>(null);
  const clearAnimation = useCallback((): void => {
    dismissedAnimation.current = animatedJobId;
    setAnimatedJobId(null);
    setAnimatedPreviewUrl(null);
  }, [animatedJobId]);

  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasZoneRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const livePoints = useRef<Point[]>([]);
  // Identifier of the touch that owns the current draw gesture — a second
  // finger ending must not release the sheet-gesture lock mid-stroke.
  const drawTouchId = useRef<number | null>(null);
  const [inkTick, forceInk] = useState(0);

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
    // inkTick in deps: livePoints mutate via ref mid-drag, so the counter
    // forces this repaint on every pointermove batch.
  }, [strokes, color, size, eraser, inkTick]);

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

  /* -------------------------------------------------- gesture pinning */

  // Messages WebViews sometimes ignore touch-action during a sheet gesture.
  // This narrowly-scoped non-passive fallback only owns a gesture that began
  // on the drawing surface, so rail and sheet controls still work normally.
  useEffect(() => {
    const zone = canvasZoneRef.current;
    if (!zone) return;
    const startTouch = (event: TouchEvent): void => {
      const target = event.target as Element | null;
      // Only the drawing surface owns the gesture — touches on the preview
      // media (video controls, image) and the rail must behave natively.
      if (
        target &&
        viewportRef.current?.contains(target) &&
        !target.closest(".ds-rail, .ds-preview")
      ) {
        if (drawTouchId.current === null) {
          drawTouchId.current = event.changedTouches[0]?.identifier ?? null;
        }
        event.preventDefault();
      }
    };
    const moveTouch = (event: TouchEvent): void => {
      if (drawTouchId.current !== null) event.preventDefault();
    };
    const endTouch = (event: TouchEvent): void => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === drawTouchId.current) {
          drawTouchId.current = null;
        }
      }
    };
    zone.addEventListener("touchstart", startTouch, { passive: false });
    zone.addEventListener("touchmove", moveTouch, { passive: false });
    zone.addEventListener("touchend", endTouch, { passive: true });
    zone.addEventListener("touchcancel", endTouch, { passive: true });
    return () => {
      zone.removeEventListener("touchstart", startTouch);
      zone.removeEventListener("touchmove", moveTouch);
      zone.removeEventListener("touchend", endTouch);
      zone.removeEventListener("touchcancel", endTouch);
    };
  }, []);

  // The iOS keyboard shrinks the visual viewport; tracking it lets the
  // pinned frame shrink too instead of the document sliding under a finger.
  useEffect(() => {
    const update = (): void => {
      document.documentElement.style.setProperty(
        "--ds-vvh",
        `${window.visualViewport?.height ?? window.innerHeight}px`
      );
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Size the square to the space the canvas zone actually gets — the sheet
  // is capped, so the zone shrinks first and the pad follows it.
  useEffect(() => {
    const zone = canvasZoneRef.current;
    if (!zone || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const sizeCanvas = (): void => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const bounds = zone.getBoundingClientRect();
      const edge = Math.floor(Math.min(bounds.width, bounds.height, 720));
      if (edge > 0)
        viewport.style.setProperty("--ds-canvas-edge", `${edge}px`);
    };
    const observer = new ResizeObserver(sizeCanvas);
    observer.observe(zone);
    frame = requestAnimationFrame(sizeCanvas);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

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
      // Secondary buttons (context-click, pen barrel) don't start a stroke.
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
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
      event.stopPropagation();
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
    // A job we watched go active here (mount or a POST whose response was
    // lost) still earns its reveal when the poll reports it delivered — as
    // long as nothing else already claimed the reveal.
    const stillActive =
      payload.activeJob && ACTIVE_STATUSES.includes(payload.activeJob.status);
    if (
      activeJob?.id &&
      !stillActive &&
      autoRevealJob.current === null &&
      dismissedReveal.current !== activeJob.id
    ) {
      const finished = payload.revisions.find(
        (r) => r.jobId === activeJob.id && r.state === "delivered" && r.outputUrl
      );
      if (finished) autoRevealJob.current = activeJob.id;
    }
    setLatest(payload.latest);
    setActiveJob(payload.activeJob);
    setRevisions(payload.revisions);
    const newest = payload.revisions.filter((r) => r.outputUrl).at(-1);
    // A delivered animation isn't a revision — don't swap it for the still,
    // and never stomp an explicitly selected revision.
    if (newest?.outputUrl && !animatedPreviewUrl && !selectedRevisionId) {
      showAsset(newest.jobId, newest.outputUrl);
    }
    // An animation that finished while the page was closed/mid-poll lands
    // only here — adopt it unless it's the one the user dismissed.
    const next = payload.latestAnimation;
    if (next?.url && next.jobId !== dismissedAnimation.current) {
      if (next.jobId !== animatedJobId) {
        dismissedAnimation.current = null;
        setAnimatedJobId(next.jobId);
      } else if (next.url !== animatedPreviewUrl) {
        // Same animation, re-signed URL — keep it fresh for save/reveal.
        setAnimatedPreviewUrl(next.url);
      }
      // Same job too: showAsset only records freshUrl for video, so the
      // playing preview never restarts but an expired src can retry.
      showAsset(next.jobId, next.url);
    }
  }, [
    latest,
    activeJob,
    animatedPreviewUrl,
    animatedJobId,
    selectedRevisionId,
    showAsset,
  ]);

  useEffect(() => {
    // ~2.5s cadence: the render lane has no preview stream, so the strip
    // updates when a 'completed' event lands in the poll payload.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    // A delivered animation isn't a revision — keep it on screen until the
    // user picks a revision or generates again.
    if (animatedPreviewUrl) return;
    const rev =
      (targetRevision?.outputUrl ? targetRevision : null) ??
      revisions.filter((r) => r.outputUrl).at(-1) ??
      null;
    showAsset(rev?.jobId ?? null, rev?.outputUrl ?? null);
  }, [targetRevision, revisions, animatedPreviewUrl, showAsset]);

  /* -------------------------------------------- preview decode + reveal */

  const previewIsVideo = /\.(mp4|mov)(\?|$)/i.test(previewUrl ?? "");

  useEffect(() => {
    if (!previewUrl || previewIsVideo) {
      setDecodedPreviewUrl(null);
      return;
    }
    // A superseded load finishing late must not un-decode the preview that
    // is actually selected — drop callbacks from stale image instances.
    let current = true;
    const image = new Image();
    image.onload = () => {
      if (current) setDecodedPreviewUrl(previewUrl);
    };
    image.onerror = () => {
      if (current)
        setMessage("the image is ready, but its preview couldn't load — reopen the card");
    };
    image.src = previewUrl;
    return () => {
      current = false;
    };
  }, [previewUrl, previewIsVideo]);

  const showPreview = Boolean(
    tab === "preview" &&
      previewUrl &&
      (previewIsVideo || decodedPreviewUrl === previewUrl)
  );

  useEffect(() => {
    const jobId = autoRevealJob.current;
    if (!jobId) return;
    const url =
      revisions.find((r) => r.jobId === jobId)?.outputUrl ??
      (animatedJobId === jobId ? animatedPreviewUrl : null);
    if (!url) return;
    // Adopt the job's media first — the tab flip still waits on decode.
    // The shown URL is stable per job, so compare by identity below.
    showAsset(jobId, url);
    const video = /\.(mp4|mov)(\?|$)/i.test(previewUrl ?? url);
    if (
      !video &&
      !(previewAsset.current.jobId === jobId && decodedPreviewUrl === previewUrl)
    ) {
      return;
    }
    autoRevealJob.current = null;
    setTab("preview");
  }, [
    revisions,
    decodedPreviewUrl,
    previewUrl,
    animatedJobId,
    animatedPreviewUrl,
    showAsset,
  ]);

  /* --------------------------------------------------------- keyboard */

  const selectView = useCallback((next: "sketch" | "preview"): void => {
    viewVersion.current += 1;
    // Record only an armed reveal — a second pick would otherwise overwrite
    // the remembered dismissal with null and let the poll re-arm it.
    if (autoRevealJob.current !== null) {
      dismissedReveal.current = autoRevealJob.current;
      autoRevealJob.current = null;
    }
    setTab(next);
  }, []);

  const viewKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>): void => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const next =
        event.key === "Home" || event.key === "ArrowLeft"
          ? "sketch"
          : "preview";
      if (next === "preview" && !previewUrl) return;
      selectView(next);
      (
        event.currentTarget.parentElement?.querySelector(
          `[data-draw-view="${next}"]`
        ) as HTMLButtonElement | null
      )?.focus();
    },
    [previewUrl, selectView]
  );

  const modeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, currentMode: Mode): void => {
      const horizontal =
        event.key === "ArrowRight" || event.key === "ArrowLeft";
      if (!horizontal && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const index = MODES.indexOf(currentMode);
      const next =
        event.key === "Home"
          ? MODES[0]!
          : event.key === "End"
            ? MODES.at(-1)!
            : MODES[
                (index + (event.key === "ArrowRight" ? 1 : -1) + MODES.length) %
                  MODES.length
              ]!;
      setMode(next);
      (
        event.currentTarget.parentElement?.querySelector(
          `[data-mode="${next}"]`
        ) as HTMLButtonElement | null
      )?.focus();
    },
    []
  );

  /* ----------------------------------------------------------- actions */

  const inkPresent = useCallback((): boolean => {
    const ctx = strokeCanvasRef.current?.getContext("2d");
    if (!ctx) return false;
    return hasVisibleInk(
      ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data
    );
  }, []);

  const flatten = useCallback(
    (includeBackground: boolean): string | null => {
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
      if (includeBackground) ctx.drawImage(bg, 0, 0);
      ctx.drawImage(ink, 0, 0);
      try {
        return out.toDataURL("image/png");
      } catch {
        return null;
      }
    },
    []
  );

  const importImage = useCallback((file: File | undefined): void => {
    if (!file) return;
    // Browsers can't decode HEIC to a canvas — an iPhone photo reaches the
    // studio by texting it with /draw (the iMessage lane transcodes it).
    if (
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      /\.hei[cf]$/i.test(file.name)
    ) {
      setMessage("HEIC photo — text it to me with /draw instead");
      return;
    }
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
    // A context reset breaks the chain entirely: no parent link and the
    // last result must not bleed back in through the flattened upload.
    const parentJobId =
      !resetContext && refining ? targetRevision!.jobId : undefined;
    const includeBackground = Boolean(
      backgroundUrl && !(resetContext && backgroundKind === "result")
    );
    if (!prompt.trim() && !ink && !includeBackground) {
      setMessage("sketch something, import an image, or write a prompt first");
      return;
    }
    // No fresh pixels → the parent's stored output is the edit source; no
    // upload needed (mayor-coast's reuseParentArtifact).
    const reuseParent = Boolean(parentJobId && !ink && !backgroundUrl);
    setBusy("generate");
    setMessage("preparing…");
    // If the user picks a view while this blocking request is in flight,
    // that choice must win — the response won't arm the reveal then.
    const startViewVersion = viewVersion.current;
    try {
      let inputAssetId: string | undefined;
      if (!reuseParent && (ink || includeBackground)) {
        const flattened = flatten(includeBackground);
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
      if (viewVersion.current === startViewVersion) {
        autoRevealJob.current = payload.jobId ?? null;
      }
      setActiveJob(payload.activeJob);
      setLatest(payload.latest);
      setRevisions(payload.revisions);
      setMessage(
        payload.status === "delivered"
          ? (payload.line ?? "image ready")
          : (payload.line ?? null)
      );
      // The tab flips via the auto-reveal effect once the preview decodes.
      if (payload.deliveryUrl) {
        showAsset(payload.jobId ?? null, payload.deliveryUrl);
      }
      if (payload.status === "delivered") {
        setStrokes([]);
        setRedoStack([]);
        // The just-generated asset becomes what the preview follows again.
        setSelectedRevisionId(null);
        clearAnimation();
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
    backgroundKind,
    refining,
    targetRevision,
    inkPresent,
    flatten,
    clearAnimation,
    showAsset,
  ]);

  const animate = useCallback(async (): Promise<void> => {
    if (busy || !targetRevision) return;
    setBusy("animate");
    setMessage("animating…");
    const startViewVersion = viewVersion.current;
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
      if (payload.status === "delivered") {
        dismissedAnimation.current = null;
        setAnimatedJobId(payload.jobId ?? null);
        setAnimatedPreviewUrl(payload.deliveryUrl ?? null);
      }
      if (payload.deliveryUrl) {
        if (viewVersion.current === startViewVersion) {
          autoRevealJob.current = payload.jobId ?? null;
        }
        showAsset(payload.jobId ?? null, payload.deliveryUrl);
      }
    } finally {
      setBusy(null);
    }
  }, [busy, targetRevision, prompt, showAsset]);

  const save = useCallback(async (): Promise<void> => {
    // Save whatever the preview shows — an animation when one just
    // delivered, otherwise the selected revision.
    const jobId = animatedJobId ?? targetRevision?.jobId;
    if (busy || !jobId) return;
    setBusy("save");
    try {
      const payload = await postAction({
        action: "save",
        jobId,
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
  }, [busy, targetRevision, animatedJobId]);

  const cancel = useCallback(async (): Promise<void> => {
    await postAction({ action: "cancel" });
    setActiveJob(null);
    setMessage("cancelled");
  }, []);

  const refine = useCallback((): void => {
    if (!targetRevision?.outputUrl) return;
    setAnimatedJobId(null);
    setAnimatedPreviewUrl(null);
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
    setAnimatedJobId(null);
    setAnimatedPreviewUrl(null);
    setMessage(null);
  }, []);

  const selectRevision = useCallback(
    (revision: DrawRevision): void => {
      setSelectedRevisionId(revision.jobId);
      clearAnimation();
      if (revision.outputUrl) {
        showAsset(revision.jobId, revision.outputUrl);
        setTab("preview");
      }
    },
    [clearAnimation, showAsset]
  );

  /* ------------------------------------------------------------ render */

  const hasInk =
    strokes.length > 0 || livePoints.current.length > 0;
  const sketchEditable = tab === "sketch" && !jobActive;
  const saveTarget = animatedJobId ?? targetRevision?.jobId ?? null;

  const undo = (): void => {
    setStrokes((value) => {
      const next = [...value];
      const popped = next.pop();
      if (popped) setRedoStack((r) => [...r, popped]);
      return next;
    });
  };
  const redo = (): void => {
    setRedoStack((value) => {
      const next = [...value];
      const popped = next.pop();
      if (popped) setStrokes((s) => [...s, popped]);
      return next;
    });
  };

  return (
    <div className="ds-root">
      <div className="ds-top">
        <div
          className="ds-view-toggle"
          data-view={tab}
          role="tablist"
          aria-label="Canvas view"
        >
          <span className="ds-view-thumb" aria-hidden="true" />
          <button
            type="button"
            role="tab"
            data-draw-view="sketch"
            aria-selected={tab === "sketch"}
            aria-controls="ds-canvas-panel"
            tabIndex={tab === "sketch" ? 0 : -1}
            className={tab === "sketch" ? "active" : ""}
            onClick={() => selectView("sketch")}
            onKeyDown={viewKeyDown}
          >
            Sketch
          </button>
          <button
            type="button"
            role="tab"
            data-draw-view="preview"
            aria-selected={tab === "preview"}
            aria-controls="ds-canvas-panel"
            tabIndex={tab === "preview" ? 0 : -1}
            className={tab === "preview" ? "active" : ""}
            disabled={!previewUrl}
            onClick={() => selectView("preview")}
            onKeyDown={viewKeyDown}
          >
            Preview
          </button>
        </div>
        <span className="ds-status" aria-live="polite">
          {jobActive && activeJob
            ? jobLabel(activeJob.status)
            : busy === "animate"
              ? "Animating…"
              : ""}
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

      <div className="ds-canvas-zone" ref={canvasZoneRef} id="ds-canvas-panel">
        <div
          className="ds-viewport"
          ref={viewportRef}
          data-testid="draw-canvas-viewport"
        >
          <canvas ref={bgCanvasRef} className="ds-layer" />
          <canvas
            ref={strokeCanvasRef}
            className={`ds-layer ds-ink${tab !== "sketch" || jobActive ? " is-faded" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={onPointerUp}
            onContextMenu={(event) => event.preventDefault()}
            aria-label="Drawing canvas"
            data-testid="draw-canvas"
          />
          {showPreview && previewUrl ? (
            previewIsVideo ? (
              <video
                className="ds-preview is-visible"
                src={previewUrl}
                controls
                playsInline
                onError={retryFreshUrl}
              />
            ) : (
              <img
                className="ds-preview is-visible"
                src={previewUrl}
                alt="Generated"
                onError={retryFreshUrl}
              />
            )
          ) : null}
          {tab === "sketch" && !hasInk && !backgroundUrl ? (
            <span className="ds-hint">draw here</span>
          ) : null}
          <div className="ds-rail" aria-label="Canvas actions">
            <button
              type="button"
              className="ds-rail-button"
              aria-label="Undo"
              title="Undo"
              disabled={!sketchEditable || !strokes.length}
              onClick={undo}
            >
              <ToolIcon tool="undo" />
            </button>
            <button
              type="button"
              className="ds-rail-button"
              aria-label="Redo"
              title="Redo"
              disabled={!sketchEditable || !redoStack.length}
              onClick={redo}
            >
              <ToolIcon tool="redo" />
            </button>
            <button
              type="button"
              className="ds-rail-button"
              aria-label="Clear sketch"
              title="Clear sketch"
              disabled={!sketchEditable}
              onClick={discard}
            >
              <ToolIcon tool="clear" />
            </button>
            <label
              className={`ds-rail-button ds-import${sketchEditable ? "" : " disabled"}`}
              aria-label="Import image"
              title="Import image"
            >
              <ToolIcon tool="import" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!sketchEditable}
                onChange={(event) => importImage(event.target.files?.[0])}
              />
            </label>
          </div>
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
              disabled={!sketchEditable}
              onClick={() => {
                setColor(swatch);
                setEraser(false);
              }}
            />
          ))}
        </div>
        <label className="ds-size">
          Size
          <input
            type="range"
            min={4}
            max={64}
            value={size}
            disabled={!sketchEditable}
            aria-label="Brush size"
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          className={`ds-eraser${eraser ? " selected" : ""}`}
          aria-pressed={eraser}
          disabled={!sketchEditable}
          onClick={() => setEraser((v) => !v)}
        >
          Eraser
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
              data-mode={item}
              aria-checked={mode === item}
              aria-label={MODE_LABELS[item]}
              title={MODE_LABELS[item]}
              tabIndex={mode === item ? 0 : -1}
              className={mode === item ? "active" : ""}
              onClick={() => setMode(item)}
              onKeyDown={(event) => modeKeyDown(event, item)}
            >
              <ModeIcon mode={item} />
            </button>
          ))}
        </div>
        <div className="ds-mode-caption" aria-live="polite">
          {MODE_LABELS[mode]}
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
              disabled={busy !== null || tab === "preview"}
              onClick={() => void generate()}
            >
              {busy === "generate" ? "Generating…" : refining ? "Refine" : "Generate"}
            </button>
          )}
        </div>
        {saveTarget ? (
          <div className="ds-actions ds-actions-secondary">
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
          </div>
        ) : null}
        <p className="ds-tagline">
          Sketch it, describe it, then make it real.
        </p>
        <p className="ds-message" aria-live="polite">
          {message}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ css */

/* Midnight-navy glass skin (mayor-coast draw parity) on the shared shell. */
const CSS = `
/* Pin the studio to the visual viewport: the document must never scroll —
   a vertical stroke is a draw gesture, not a page pan. The sheet and rail
   get their own internal scroll instead. */
html,body{height:100%;overscroll-behavior:none}
body{overflow:hidden}
.frame{height:var(--ds-vvh,100dvh);min-height:0;overflow:hidden}
main.app{min-height:0}
#draw-studio{min-height:0}
.ds-root{display:flex;flex-direction:column;gap:0.5rem;width:min(100%,45rem);margin:0 auto;min-height:0;flex:1;height:100%;color:#f8fbff}
.ds-top{display:flex;align-items:center;gap:0.6rem}
.ds-view-toggle{position:relative;display:flex;flex:1;max-width:28rem;margin:0 auto;padding:3px;background:#0c1426d9;border:1px solid #5c99e433;border-radius:14px}
.ds-view-thumb{position:absolute;top:3px;left:3px;width:calc(50% - 4px);height:calc(100% - 6px);border-radius:11px;background:linear-gradient(135deg,#1d4b8f,#16345f);box-shadow:inset 0 0 0 1px #4db0ff66;transition:transform .22s ease;pointer-events:none}
.ds-view-toggle[data-view="preview"] .ds-view-thumb{transform:translateX(100%)}
.ds-view-toggle button{position:relative;z-index:1;flex:1;background:transparent;color:#9db8e2;border:0;min-height:44px;border-radius:11px;font-weight:800;font-size:0.8rem;letter-spacing:0.04em;box-shadow:none;text-transform:none}
.ds-view-toggle button.active{color:#fff}
.ds-view-toggle button:disabled{opacity:0.4}
.ds-status{font-size:0.72rem;color:#7cc4ff;letter-spacing:0.04em;min-height:1rem;text-align:right;font-family:var(--font-ui)}
.ds-revisions{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:0.15rem}
.ds-revisions button{display:flex;flex-direction:column;gap:2px;min-width:4.8rem;padding:6px 8px;text-align:left;color:#f8fbff;border:1px solid #6dadf044;border-radius:10px;background:#0b111ebd;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);min-height:3.2rem;box-shadow:none}
.ds-revisions button.selected{background:#123d72c7;border-color:#4db0ff}
.ds-revisions button:disabled{opacity:0.45}
.ds-revisions img{width:3.2rem;height:2rem;object-fit:cover;border-radius:5px;pointer-events:none}
.ds-rev-empty{width:3.2rem;height:2rem;border-radius:5px;background:#12213a}
.ds-revisions small,.ds-revisions em{font-size:0.55rem;font-style:normal;color:#dbe8ff;white-space:nowrap;font-family:var(--font-ui)}
.ds-revisions em{color:#9dd8ff}
.ds-canvas-zone{flex:1;min-height:0;display:grid;place-items:center;overscroll-behavior:contain;touch-action:none}
.ds-viewport{position:relative;width:min(100%,var(--ds-canvas-edge,26rem));aspect-ratio:1;max-height:100%;background:#fff;border-radius:14px;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;box-shadow:0 8px 30px #0003}
.ds-layer{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.ds-ink{transition:opacity 0.2s ease}
.ds-ink.is-faded{opacity:0.25;pointer-events:none}
.ds-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:3}
.ds-hint{position:absolute;right:0.7rem;bottom:0.55rem;color:#625d6c;font-size:0.62rem;z-index:4;pointer-events:none}
.ds-rail{position:absolute;top:8px;left:8px;z-index:7;display:flex;gap:5px;padding:4px;border:1px solid #6facf155;border-radius:16px;background:linear-gradient(135deg,#17345ad9,#0a1427e8);box-shadow:inset 0 1px #eff8ff24,0 8px 20px #0005;backdrop-filter:blur(18px) saturate(135%);-webkit-backdrop-filter:blur(18px) saturate(135%)}
.ds-rail-button{position:relative;display:grid;place-items:center;width:44px;min-height:44px;padding:0;border:0;border-radius:11px;background:#1f4d7d8a;color:#dbeeff;box-shadow:inset 0 1px #eff8ff20;cursor:pointer}
.ds-rail-button svg{width:21px;height:21px}
.ds-rail-button:disabled,.ds-rail-button.disabled{opacity:0.35;cursor:default}
.ds-rail-button:focus-visible,.ds-rail-button:focus-within{outline:2px solid #6bc0ff;outline-offset:2px}
.ds-import input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.ds-import.disabled{pointer-events:none}
.ds-ink-controls{display:flex;align-items:center;gap:7px;min-height:56px;padding:6px 8px;overflow-x:auto;scrollbar-width:none;border:1px solid #5c99e433;border-radius:18px;background:linear-gradient(135deg,#17345a7a,#070d1be0);box-shadow:inset 0 1px #d4ecff18,0 10px 28px #0005;backdrop-filter:blur(20px) saturate(135%);-webkit-backdrop-filter:blur(20px) saturate(135%)}
.ds-palette{display:flex;gap:5px;flex:0 0 auto}
.ds-swatch{display:block;width:34px;min-height:34px;padding:0;border:2px solid #f8fbff;border-radius:50%;flex:0 0 34px;box-shadow:none}
.ds-swatch.selected{outline:2px solid #4db0ff;outline-offset:2px;box-shadow:0 0 0 1px #3ca7ff55,0 0 17px #3ca7ff77}
.ds-swatch:disabled{opacity:0.35}
.ds-size{display:flex;align-items:center;gap:5px;flex:0 0 auto;color:#dbe8ff;font-size:12px;white-space:nowrap;font-family:var(--font-ui)}
.ds-size input{width:70px;accent-color:#3ca7ff}
.ds-eraser{min-height:44px;padding:8px 12px;flex:0 0 auto;border:1px solid #6facf144;border-radius:12px;background:#183354aa;color:#f8fbff;font-weight:750;font-size:0.7rem;letter-spacing:0.05em;text-transform:uppercase;box-shadow:inset 0 1px #e8f5ff18}
.ds-eraser.selected{border-color:#4db0ff;box-shadow:inset 0 1px #eff8ff30,0 0 0 1px #3ca7ff55}
.ds-eraser:disabled{opacity:0.35}
.ds-sheet{display:flex;flex-direction:column;gap:7px;max-height:min(34dvh,250px);overflow:auto;overscroll-behavior:contain;border:1px solid #75baff44;border-radius:16px;background:linear-gradient(135deg,#111d35d9,#080d1ae8);box-shadow:inset 0 1px #e6f4ff1c,0 18px 42px #0007;backdrop-filter:blur(24px) saturate(135%);-webkit-backdrop-filter:blur(24px) saturate(135%);padding:8px}
.ds-sheet textarea{width:100%;min-height:3rem;max-height:6rem;font-size:1rem;background:#12213a9c;border-color:#7dbfff55;color:#f8fbff;box-shadow:inset 0 1px #eff8ff12;border-radius:10px}
.ds-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;background:#070a12;border-radius:12px;padding:3px}
.ds-modes button{display:grid;place-items:center;min-height:52px;border:0;border-radius:10px;background:transparent;color:#7d94bb;box-shadow:none;text-transform:none}
.ds-modes button.active{background:#123d72c7;color:#9dd8ff;box-shadow:inset 0 0 0 1px #4db0ff55}
.ds-mode-caption{height:18px;text-align:center;color:#9dd8ff;font-size:12px;font-weight:750;font-family:var(--font-ui)}
.ds-reset{min-height:34px;border:1px solid #5d9de455;border-radius:9px;background:#0b1425c9;color:#f8fbff;font-weight:700;font-size:0.68rem;letter-spacing:0.03em;box-shadow:none;text-transform:none}
.ds-reset.selected{border-color:#4db0ff;color:#9dd8ff}
.ds-actions{display:flex;gap:6px}
.ds-generate,.ds-save{background:linear-gradient(135deg,#2f8be8,#1760c8);color:#f8fbff;box-shadow:inset 0 1px #eff9ff4a,0 10px 22px #0a52b64c;text-transform:none;font-weight:850}
.ds-generate{flex:1;min-height:46px;font-size:0.9rem}
.ds-save{flex:1}
.ds-secondary{background:#183354aa;color:#f8fbff;border:1px solid #6facf144;box-shadow:inset 0 1px #e8f5ff18;text-transform:none;font-weight:700}
.ds-actions-secondary .ds-secondary,.ds-actions-secondary .ds-save{flex:1}
.ds-cancel{background:#183354aa;color:#f8fbff;border:1px solid #6facf144;flex:1}
.ds-actions button:disabled{opacity:0.5}
.ds-tagline{margin:0;text-align:center;font-size:0.68rem;color:#7d94bb;font-family:var(--font-ui)}
.ds-message{font-size:0.72rem;color:#dbe8ff;margin:0;min-height:0.9rem;text-align:center}
@media(prefers-reduced-motion:reduce){.ds-ink,.ds-view-thumb{transition:none}}
@media(max-height:680px){.ds-rail{top:6px;left:6px;gap:4px;padding:3px}.ds-rail-button{width:40px;min-height:40px}.ds-ink-controls{min-height:50px;padding-block:4px}.ds-modes button{min-height:46px}}
/* Messages sheet heights: yield chrome back to the canvas. */
@media(max-height:560px){.ds-tagline,.ds-mode-caption{display:none}.ds-sheet{max-height:min(30dvh,210px);gap:5px;padding:6px}.ds-sheet textarea{min-height:2.4rem}.ds-rail{flex-wrap:wrap;max-width:calc(100% - 8px)}}
@media(max-width:420px){.ds-ink-controls{gap:5px;padding:6px}.ds-swatch{width:30px;min-height:30px;flex:0 0 30px}.ds-size input{width:56px}.ds-eraser{padding:8px 10px;font-size:0.62rem}}
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
