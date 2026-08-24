/**
 * Photo-booth client for the onboarding selfies/twin slides. Bundled to
 * public/creator-os/identity-booth.js by scripts/build-identity-booth.mjs
 * and mounted onto #identity-booth — same-origin under script-src 'self',
 * no third-party JS.
 *
 * Photo mode: live camera preview, countdown shutter, captured shots review
 * in a depth carousel (reactbits DepthCarousel-style, first-party, no GSAP),
 * then a single "add to vault" finalization that posts each kept shot
 * through the existing upload_selfie action. Video mode: MediaRecorder
 * consent capture with playback review, posting through upload_consent.
 * Captures live only in browser memory (blob:) until the owner finalizes;
 * nothing is uploaded on capture.
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

interface Shot {
  id: number;
  blob: Blob;
  url: string;
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

/**
 * Depth carousel review strip — a first-party take on the reactbits
 * DepthCarousel: 3D ring of cards, drag/wheel/keyboard navigation, dot
 * indicators, honoring prefers-reduced-motion (snap instead of glide).
 */
function DepthCarousel({
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
      positionRef.current += delta * 0.18;
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
      // Capture only once a real drag starts, so plain taps/clicks still
      // reach the dots and Keep/Drop buttons.
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

  return (
    <div
      className="dcar"
      role="listbox"
      aria-label="captured photos"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={(event) => step(event.deltaY > 0 ? 1 : -1)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") step(1);
        if (event.key === "ArrowLeft") step(-1);
      }}
    >
      <div className="dcar-stage">
        {shots.map((shot, index) => {
          const offset = index - position;
          const abs = Math.abs(offset);
          const scale = Math.max(0.62, 1 - abs * 0.16);
          const style: React.CSSProperties = {
            transform:
              `translate(-50%, -50%) scale(${scale.toFixed(3)}) ` +
              `translateX(${(offset * 118).toFixed(1)}px) ` +
              `translateZ(${(-abs * 140).toFixed(1)}px) ` +
              `rotateY(${(-offset * 16).toFixed(2)}deg)`,
            opacity: abs > 2.5 ? 0 : 1 - abs * 0.22,
            zIndex: 100 - Math.round(abs * 10),
            pointerEvents: abs > 2.5 ? "none" : "auto",
          };
          return (
            <div
              key={shot.id}
              className={`dcar-card${shot.kept ? "" : " dropped"}${index === Math.round(position) ? " front" : ""}`}
              style={style}
              role="option"
              aria-selected={index === active}
              onClick={() => onSelect(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- in-memory blob: URL, not optimizable */}
              <img src={shot.url} alt={`shot ${index + 1}`} draggable={false} />
              <button
                type="button"
                className="dcar-toggle"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle(shot.id);
                }}
              >
                {shot.kept ? "Drop" : "Keep"}
              </button>
            </div>
          );
        })}
      </div>
      <div className="dcar-dots" role="presentation">
        {shots.map((shot, index) => (
          <button
            key={shot.id}
            type="button"
            className={`dcar-dot${index === active ? " on" : ""}`}
            aria-label={`go to shot ${index + 1}`}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>
    </div>
  );
}

function Booth({ mode }: { mode: BoothMode }): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(1);
  const [phase, setPhase] = useState<
    "idle" | "starting" | "live" | "counting" | "recording" | "review" | "saving" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [active, setActive] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);
  const [saved, setSaved] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopStream();
      shots.forEach((shot) => URL.revokeObjectURL(shot.url));
      if (clip) URL.revokeObjectURL(clip.url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
    []
  );

  const start = useCallback(async () => {
    setPhase("starting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: mode === "video",
      });
      streamRef.current = stream;
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
  }, [mode]);

  const captureFrame = useCallback((): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return Promise.resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    // Un-mirror: the preview is mirrored for a natural selfie feel, but the
    // stored photo should match reality.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92)
    );
  }, []);

  const shoot = useCallback(() => {
    if (shots.length >= MAX_SHOTS) return;
    setPhase("counting");
    let remaining = 3;
    setCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      clearInterval(timer);
      setCountdown(0);
      setFlash(true);
      setTimeout(() => setFlash(false), 220);
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
        setPhase("live");
      });
    }, 700);
  }, [captureFrame, shots.length]);

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
      window.location.reload();
      return;
    }
    setPhase("review");
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
  const cameraOn =
    phase === "live" || phase === "counting" || phase === "recording";

  return (
    <StrictMode>
      <div className={`booth booth-mode-${mode}`}>
        <div className={`booth-stage${cameraOn ? " on" : ""}`}>
          <video ref={videoRef} playsInline muted autoPlay className="booth-video" />
          {flash ? <div className="booth-flash" /> : null}
          {countdown > 0 ? (
            <div className="booth-count" aria-live="assertive">
              {countdown}
            </div>
          ) : null}
          {phase === "recording" ? <div className="booth-rec">● REC</div> : null}
          {!cameraOn && phase !== "saving" ? (
            <button type="button" className="booth-start" onClick={() => void start()}>
              {phase === "starting"
                ? "Starting camera…"
                : mode === "photo"
                  ? "Open photo booth"
                  : "Open camera"}
            </button>
          ) : null}
          {phase === "saving" ? (
            <div className="booth-saving" aria-live="polite">
              {mode === "photo" ? `Saving ${saved}/${keptCount}…` : "Uploading…"}
            </div>
          ) : null}
        </div>
        {error ? <p className="booth-error">{error}</p> : null}
        {mode === "photo" ? (
          <>
            {cameraOn ? (
              <div className="booth-controls">
                <button
                  type="button"
                  className="booth-shutter"
                  aria-label="take photo"
                  disabled={phase !== "live" || shots.length >= MAX_SHOTS}
                  onClick={shoot}
                />
                <span className="booth-hint">
                  {shots.length >= MAX_SHOTS
                    ? "Booth is full — review your shots"
                    : `${shots.length} shot${shots.length === 1 ? "" : "s"} · 3-2-1 countdown`}
                </span>
              </div>
            ) : null}
            {shots.length > 0 ? (
              <>
                <DepthCarousel
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
                    disabled={keptCount === 0 || phase === "saving"}
                    onClick={() => void finalizePhotos()}
                  >
                    Add {keptCount} photo{keptCount === 1 ? "" : "s"} to vault
                  </button>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            {cameraOn ? (
              <div className="booth-controls">
                {phase === "recording" ? (
                  <button type="button" onClick={stopRecording}>
                    Stop recording
                  </button>
                ) : (
                  <button type="button" onClick={record}>
                    Start recording
                  </button>
                )}
                <span className="booth-hint">up to 60 seconds</span>
              </div>
            ) : null}
            {clip && phase !== "recording" ? (
              <div className="booth-clip">
                <video src={clip.url} controls playsInline className="booth-playback" />
                <div className="booth-controls">
                  <button
                    type="button"
                    disabled={phase === "saving"}
                    onClick={() => void finalizeClip()}
                  >
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
          </>
        )}
      </div>
    </StrictMode>
  );
}

const mount = document.getElementById("identity-booth");
if (mount) {
  const mode: BoothMode =
    mount.getAttribute("data-mode") === "video" ? "video" : "photo";
  mount.replaceChildren();
  createRoot(mount).render(<Booth mode={mode} />);
}
