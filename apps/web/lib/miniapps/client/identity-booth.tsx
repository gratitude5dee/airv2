/**
 * Photo-booth client for the onboarding selfies/twin slides. Bundled to
 * public/creator-os/identity-booth.js by scripts/build-identity-booth.mjs
 * and mounted onto #identity-booth — same-origin under script-src 'self',
 * no third-party JS.
 *
 * The capture surface reads as an iPhone camera: black stage, rule-of-thirds
 * grid, a mode strip (PHOTO | VIDEO) above the shutter row, a ring shutter,
 * a flip-camera control, and a last-shot thumbnail. Review happens in a
 * circular gallery (reactbits CircularGallery-style, first-party, DOM
 * transforms instead of WebGL so taps hit real elements): cards curve along
 * an arc, drag/wheel/keyboard to scroll, tap a card to select or deselect
 * it (green check badge), then confirm with the green checkmark to post the
 * selected shots through upload_selfie and kick off the character sheet.
 * Video mode records consent via MediaRecorder with playback review and a
 * green-check confirm, posting through upload_consent. Captures live only
 * in browser memory (blob:) until the owner confirms; nothing is uploaded
 * on capture.
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

type BoothMode = "photo" | "video";
type Facing = "user" | "environment";

interface Shot {
  id: number;
  blob: Blob;
  url: string;
  /** Selected to send — toggled by tapping the card in the gallery. */
  kept: boolean;
}

const MAX_SHOTS = 8;
const MAX_VIDEO_MS = 60_000;

function preferredVideoMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of ["video/mp4", "video/webm;codecs=vp9", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

/** Container type of a recording (strip codec parameters for the server). */
function containerType(mime: string): string {
  return mime.split(";")[0] ?? mime;
}

/** Fire a plain (fileless) action post; the reload after it renders the result. */
async function postAction(action: string): Promise<void> {
  const form = new FormData();
  form.set("action", action);
  try {
    await fetch(window.location.href, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
  } catch {
    // Best effort — the slide still offers the manual generate button.
  }
}

async function postCapture(
  action: string,
  blob: Blob,
  filename: string
): Promise<boolean> {
  const form = new FormData();
  form.set("action", action);
  form.set("file", new File([blob], filename, { type: blob.type }));
  try {
    const res = await fetch(window.location.href, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Green selection check — filled circle with a white tick. */
function CheckBadge({ on }: { on: boolean }): React.ReactElement {
  return (
    <span className={`cgal-check${on ? " on" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Circular gallery review strip — a first-party take on the reactbits
 * CircularGallery: cards lie on a bent arc and rotate along it, with
 * drag/wheel/keyboard scrolling and momentum easing. Tapping a card toggles
 * its selection (green check); honoring prefers-reduced-motion (snap
 * instead of glide).
 */
function CircularGallery({
  shots,
  active,
  onSelect,
  onToggle,
}: {
  shots: Shot[];
  active: number;
  onSelect: (index: number) => void;
  onToggle: (id: number) => void;
}): React.ReactElement {
  const [position, setPosition] = useState(active);
  const positionRef = useRef(active);
  const frameRef = useRef(0);
  const dragRef = useRef<{
    startX: number;
    startPos: number;
    pointerId: number;
    captured: boolean;
  } | null>(null);
  const reduceMotion = useMemo(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    if (reduceMotion) {
      positionRef.current = active;
      setPosition(active);
      return;
    }
    cancelAnimationFrame(frameRef.current);
    const tick = (): void => {
      const delta = active - positionRef.current;
      if (Math.abs(delta) < 0.002) {
        positionRef.current = active;
        setPosition(active);
        return;
      }
      positionRef.current += delta * 0.16;
      setPosition(positionRef.current);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, reduceMotion]);

  const step = useCallback(
    (delta: number) => {
      const next = Math.min(shots.length - 1, Math.max(0, active + delta));
      if (next !== active) onSelect(next);
    },
    [active, onSelect, shots.length]
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = {
        startX: event.clientX,
        startPos: active,
        pointerId: event.pointerId,
        captured: false,
      };
    },
    [active]
  );
  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      // Capture only once a real drag starts, so plain taps still reach
      // the cards (tap = select) and the dots.
      if (!drag.captured) {
        if (Math.abs(drag.startX - event.clientX) < 8) return;
        event.currentTarget.setPointerCapture(drag.pointerId);
        drag.captured = true;
      }
      const moved = Math.round((drag.startX - event.clientX) / 90);
      const next = Math.min(
        shots.length - 1,
        Math.max(0, drag.startPos + moved)
      );
      if (next !== active) onSelect(next);
    },
    [active, onSelect, shots.length]
  );
  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // The arc: cards drop and tilt as they leave center, like a strip bent
  // around a circle of radius R (px).
  const RADIUS = 620;
  const SPACING = 116;

  return (
    <div
      className="cgal"
      role="listbox"
      aria-label="captured photos — tap to select"
      aria-multiselectable="true"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={(event) => step(event.deltaY > 0 ? 1 : -1)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") step(1);
        if (event.key === "ArrowLeft") step(-1);
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const shot = shots[active];
          if (shot) onToggle(shot.id);
        }
      }}
    >
      <div className="cgal-stage">
        {shots.map((shot, index) => {
          const offset = index - position;
          const abs = Math.abs(offset);
          const x = offset * SPACING;
          const y = (x * x) / (2 * RADIUS);
          const rot = (x / RADIUS) * (180 / Math.PI);
          const scale = Math.max(0.68, 1 - abs * 0.1);
          const style: React.CSSProperties = {
            transform:
              `translate(-50%, -50%) translateX(${x.toFixed(1)}px) ` +
              `translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) ` +
              `scale(${scale.toFixed(3)})`,
            opacity: abs > 2.6 ? 0 : 1 - abs * 0.18,
            zIndex: 100 - Math.round(abs * 10),
            pointerEvents: abs > 2.6 ? "none" : "auto",
          };
          return (
            <div
              key={shot.id}
              className={`cgal-card${shot.kept ? " picked" : ""}${index === Math.round(position) ? " front" : ""}`}
              style={style}
              role="option"
              aria-selected={shot.kept}
              onClick={() => {
                if (index === active) onToggle(shot.id);
                else onSelect(index);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- in-memory blob: URL, not optimizable */}
              <img src={shot.url} alt={`shot ${index + 1}`} draggable={false} />
              <CheckBadge on={shot.kept} />
            </div>
          );
        })}
      </div>
      <div className="cgal-dots" role="presentation">
        {shots.map((shot, index) => (
          <button
            key={shot.id}
            type="button"
            className={`cgal-dot${index === active ? " on" : ""}`}
            aria-label={`go to shot ${index + 1}`}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>
      <p className="cgal-hint">Tap a photo to select it — green check = sending</p>
    </div>
  );
}

/** Flip-camera glyph (two arrows around a lens). */
function FlipIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M4 8a8 8 0 0 1 14.9-2M20 16a8 8 0 0 1-14.9 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M19.5 2.5v4h-4M4.5 21.5v-4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Booth({ mode }: { mode: BoothMode }): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextIdRef = useRef(1);
  const [phase, setPhase] = useState<
    "idle" | "starting" | "live" | "recording" | "review" | "saving" | "error"
  >("idle");
  const [facing, setFacing] = useState<Facing>("user");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [active, setActive] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(0);
  const [generating, setGenerating] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopStream();
      if (clockRef.current) clearInterval(clockRef.current);
      shots.forEach((shot) => URL.revokeObjectURL(shot.url));
      if (clip) URL.revokeObjectURL(clip.url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
    []
  );

  const start = useCallback(
    async (want: Facing) => {
      setPhase("starting");
      setError(null);
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: want, width: { ideal: 1280 } },
          audio: mode === "video",
        });
        streamRef.current = stream;
        setFacing(want);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setPhase("live");
      } catch {
        setPhase("error");
        setError(
          "Camera unavailable — allow camera access, or use the upload form below."
        );
      }
    },
    [mode, stopStream]
  );

  const flip = useCallback(() => {
    if (phase !== "live") return;
    void start(facing === "user" ? "environment" : "user");
  }, [facing, phase, start]);

  const captureFrame = useCallback((): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return Promise.resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    // Un-mirror the selfie camera: the preview is mirrored for a natural
    // feel, but the stored photo should match reality. The rear camera is
    // not mirrored in either place.
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92)
    );
  }, [facing]);

  const shoot = useCallback(() => {
    if (phase !== "live" || shots.length >= MAX_SHOTS) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    void captureFrame().then((blob) => {
      if (blob) {
        setShots((prev) => {
          const shot: Shot = {
            id: nextIdRef.current++,
            blob,
            url: URL.createObjectURL(blob),
            kept: true,
          };
          setActive(prev.length);
          return [...prev, shot];
        });
      }
    });
  }, [captureFrame, phase, shots.length]);

  const record = useCallback(() => {
    const stream = streamRef.current;
    const mime = preferredVideoMime();
    if (!stream || !mime) {
      setError("Recording isn't supported in this browser — upload a video below.");
      return;
    }
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      if (clockRef.current) clearInterval(clockRef.current);
      const blob = new Blob(chunks, { type: containerType(mime) });
      setClip((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
      setPhase("review");
    };
    recorderRef.current = recorder;
    recorder.start();
    setPhase("recording");
    const startedAt = Date.now();
    setElapsed(0);
    clockRef.current = setInterval(
      () => setElapsed(Date.now() - startedAt),
      500
    );
    recordTimerRef.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, MAX_VIDEO_MS);
  }, []);

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }, []);

  const finalizePhotos = useCallback(async () => {
    const kept = shots.filter((shot) => shot.kept);
    if (kept.length === 0) return;
    setPhase("saving");
    let ok = 0;
    for (const shot of kept) {
      // Sequential: content-addressed ingestion dedupes per user, and slow
      // cellular links behave better without parallel multipart posts.
      if (await postCapture("upload_selfie", shot.blob, `booth-${shot.id}.jpg`)) {
        ok += 1;
        setSaved(ok);
      }
    }
    if (ok === kept.length) {
      // Confirming the shots kicks off the character-sheet draft right away
      // — the reload lands on the review step (save to vault or discard).
      setGenerating(true);
      await postAction("generate_character_sheet");
      window.location.reload();
      return;
    }
    setPhase("live");
    setError("Some photos didn't upload — try again.");
  }, [shots]);

  const finalizeClip = useCallback(async () => {
    if (!clip) return;
    setPhase("saving");
    const ext = clip.blob.type === "video/mp4" ? "mp4" : "webm";
    if (await postCapture("upload_consent", clip.blob, `consent.${ext}`)) {
      window.location.reload();
      return;
    }
    setPhase("review");
    setError("Upload failed — try again, or use the form below.");
  }, [clip]);

  const keptCount = shots.filter((shot) => shot.kept).length;
  const cameraOn = phase === "live" || phase === "recording";
  const lastShot = shots[shots.length - 1] ?? null;

  // The other booth mode lives on the sibling pager pane — the mode strip
  // scrolls to it like the iPhone camera's mode dial.
  const modeStrip = (
    <div className="cam-modes" role="tablist" aria-label="camera mode">
      {mode === "photo" ? (
        <>
          <span className="cam-mode on" role="tab" aria-selected="true">
            PHOTO
          </span>
          <a className="cam-mode" role="tab" aria-selected="false" href="#pane-video">
            VIDEO
          </a>
        </>
      ) : (
        <>
          <a className="cam-mode" role="tab" aria-selected="false" href="#pane-photo">
            PHOTO
          </a>
          <span className="cam-mode on" role="tab" aria-selected="true">
            VIDEO
          </span>
        </>
      )}
    </div>
  );

  return (
    <StrictMode>
      <div className={`booth booth-mode-${mode}`}>
        <div className={`cam${cameraOn ? " on" : ""}`}>
          <div className="cam-stage">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`cam-video${facing === "user" ? " mirror" : ""}`}
            />
            {cameraOn ? (
              <div className="cam-grid" aria-hidden="true">
                <i /><i /><i /><i />
              </div>
            ) : null}
            {flash ? <div className="cam-flash" /> : null}
            {phase === "recording" ? (
              <div className="cam-clock" aria-live="polite">
                <span className="cam-reddot" /> {formatClock(elapsed)}
              </div>
            ) : null}
            {mode === "photo" && cameraOn && shots.length > 0 ? (
              <div className="cam-count">{shots.length}/{MAX_SHOTS}</div>
            ) : null}
            {!cameraOn && phase !== "saving" ? (
              <button
                type="button"
                className="cam-start"
                onClick={() => void start(facing)}
              >
                {phase === "starting"
                  ? "Starting camera…"
                  : mode === "photo"
                    ? "Open photo booth"
                    : "Open camera"}
              </button>
            ) : null}
            {phase === "saving" ? (
              <div className="cam-saving" aria-live="polite">
                {mode !== "photo"
                  ? "Uploading…"
                  : generating
                    ? "Generating your character sheet…"
                    : `Saving ${saved}/${keptCount}…`}
              </div>
            ) : null}
          </div>
          {cameraOn ? (
            <div className="cam-deck">
              {modeStrip}
              <div className="cam-row">
                <span className="cam-thumb">
                  {lastShot ? (
                    // eslint-disable-next-line @next/next/no-img-element -- in-memory blob: URL
                    <img src={lastShot.url} alt="last shot" />
                  ) : null}
                </span>
                {mode === "photo" ? (
                  <button
                    type="button"
                    className="cam-shutter"
                    aria-label="take photo"
                    disabled={phase !== "live" || shots.length >= MAX_SHOTS}
                    onClick={shoot}
                  />
                ) : phase === "recording" ? (
                  <button
                    type="button"
                    className="cam-shutter rec on"
                    aria-label="stop recording"
                    onClick={stopRecording}
                  />
                ) : (
                  <button
                    type="button"
                    className="cam-shutter rec"
                    aria-label="start recording"
                    onClick={record}
                  />
                )}
                <button
                  type="button"
                  className="cam-flip"
                  aria-label="flip camera"
                  disabled={phase !== "live"}
                  onClick={flip}
                >
                  <FlipIcon />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {error ? <p className="booth-error">{error}</p> : null}
        {mode === "photo" ? (
          shots.length > 0 && phase !== "saving" ? (
            <>
              <CircularGallery
                shots={shots}
                active={active}
                onSelect={setActive}
                onToggle={(id) =>
                  setShots((prev) =>
                    prev.map((shot) =>
                      shot.id === id ? { ...shot, kept: !shot.kept } : shot
                    )
                  )
                }
              />
              <div className="booth-controls">
                <button
                  type="button"
                  className="cam-confirm"
                  disabled={keptCount === 0}
                  onClick={() => void finalizePhotos()}
                >
                  <CheckBadge on />
                  Use {keptCount} photo{keptCount === 1 ? "" : "s"}
                </button>
              </div>
            </>
          ) : null
        ) : clip && phase !== "recording" ? (
          <div className="booth-clip">
            <video src={clip.url} controls playsInline className="booth-playback" />
            <div className="booth-controls">
              <button
                type="button"
                className="cam-confirm"
                disabled={phase === "saving"}
                onClick={() => void finalizeClip()}
              >
                <CheckBadge on />
                Use as consent recording
              </button>
              <button
                type="button"
                className="ghost"
                disabled={phase === "saving"}
                onClick={() => {
                  URL.revokeObjectURL(clip.url);
                  setClip(null);
                  setPhase("live");
                }}
              >
                Retake
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </StrictMode>
  );
}

// A grouped slide can hold several booths (photo capture and the twin's
// consent recorder), so every mount point gets its own root.
for (const mount of document.querySelectorAll<HTMLElement>(
  "#identity-booth, .identity-booth"
)) {
  const mode: BoothMode =
    mount.getAttribute("data-mode") === "video" ? "video" : "photo";
  mount.replaceChildren();
  createRoot(mount).render(<Booth mode={mode} />);
}
