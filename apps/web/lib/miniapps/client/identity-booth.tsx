/**
 * Photo-booth client for the onboarding selfies/twin slides. Bundled to
 * public/creator-os/identity-booth.js by scripts/build-identity-booth.mjs
 * and mounted onto #identity-booth — same-origin under script-src 'self',
 * no third-party JS.
 *
 * The capture surface reads as an iPhone camera: black stage, rule-of-thirds
 * grid, a mode strip (PHOTO | VIDEO) above the shutter row, a ring shutter,
 * a flip-camera control, and a last-shot thumbnail. Each shutter press is
 * saved straight to the private vault; selecting the 1–6 generation photos
 * happens in the server-rendered Recent photos gallery below the booth.
 * Video mode records consent via MediaRecorder with playback review and a
 * green-check confirm, posting through upload_consent.
 */
import {
  StrictMode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

type BoothMode = "photo" | "video" | "audio";
type Facing = "user" | "environment";

const MAX_VIDEO_MS = 60_000;

function preferredVideoMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of ["video/mp4", "video/webm;codecs=vp9", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

/** Voice samples: Safari records audio/mp4, Chromium audio/webm (Opus). */
function preferredAudioMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) {
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
  filename: string,
  fields: Record<string, string> = {},
  expectJson = false
): Promise<boolean> {
  const form = new FormData();
  form.set("action", action);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set("file", new File([blob], filename, { type: blob.type }));
  try {
    const res = await fetch(window.location.href, {
      method: "POST",
      body: form,
      credentials: "same-origin",
      ...(expectJson ? { headers: { "X-Identity-Booth": "photo" } } : {}),
    });
    if (!res.ok) return false;
    if (!expectJson) return true;
    const body = (await res.json().catch(() => null)) as { ok?: unknown } | null;
    return body?.ok === true;
  } catch {
    return false;
  }
}

/** A live camera means a real video track and decodable pixels — never just
 * a successful getUserMedia promise. Exported to keep the failure contract
 * easy to exercise without a physical camera. */
export function isLiveVideo(video: HTMLVideoElement, stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0];
  const currentData =
    typeof HTMLMediaElement === "undefined"
      ? 2
      : HTMLMediaElement.HAVE_CURRENT_DATA;
  return Boolean(
    track &&
      track.readyState === "live" &&
      video.srcObject === stream &&
      video.readyState >= currentData &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
  );
}

export async function waitForLiveVideo(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
  video.srcObject = stream;
  await video.play();
  if (isLiveVideo(video, stream)) return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => finish(false), 6_000);
    const ready = (): void => {
      if (isLiveVideo(video, stream)) finish(true);
    };
    const finish = (ok: boolean): void => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("canplay", ready);
      if (ok) resolve();
      else reject(new Error("camera did not produce a video frame"));
    };
    video.addEventListener("loadeddata", ready);
    video.addEventListener("canplay", ready);
    ready();
  });
}

export function captureErrorMessage(error: unknown, mode: BoothMode): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name ?? "")
      : "";
  const source = mode === "audio" ? "Microphone" : "Camera";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return `${source} permission was blocked — allow it in Safari or Messages settings, or use the native option below.`;
  }
  if (name === "NotFoundError") {
    return `${source} not found on this device — use the native option below.`;
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return `${source} is busy in another app — close it there, then retry.`;
  }
  return `${source} did not start — retry, or use the native option below.`;
}

/** Green confirmation check — filled circle with a white tick. */
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
  const lastShotRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "starting" | "live" | "recording" | "review" | "saving" | "error"
  >("idle");
  const [facing, setFacing] = useState<Facing>("user");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [lastShot, setLastShot] = useState<string | null>(null);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopStream();
      if (clockRef.current) clearInterval(clockRef.current);
      if (lastShotRef.current) URL.revokeObjectURL(lastShotRef.current);
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
      let stream: MediaStream | null = null;
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("media devices unavailable");
        }
        stream = await navigator.mediaDevices.getUserMedia(
          mode === "audio"
            ? { audio: true }
            : {
                video: { facingMode: want, width: { ideal: 1280 } },
                audio: mode === "video",
              }
        );
        streamRef.current = stream;
        setFacing(want);
        const video = videoRef.current;
        if (mode === "audio") {
          if (!stream.getAudioTracks().some((track) => track.readyState === "live")) {
            throw new Error("microphone track unavailable");
          }
        } else {
          if (!video) throw new Error("camera preview unavailable");
          await waitForLiveVideo(video, stream);
        }
        setPhase("live");
      } catch (caught) {
        stream?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setPhase("error");
        setError(captureErrorMessage(caught, mode));
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

  const shoot = useCallback(async () => {
    if (phase !== "live") return;
    setError(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    const blob = await captureFrame();
    if (!blob) {
      setError("Camera did not produce a photo — retry or use Take photo below.");
      return;
    }
    setPhase("saving");
    const savedPhoto = await postCapture(
      "upload_selfie",
      blob,
      `booth-${nextIdRef.current++}.jpg`,
      { source: "booth" },
      true
    );
    if (!savedPhoto) {
      setPhase("live");
      setError("Photo couldn't be saved — retry or use the native option below.");
      return;
    }
    const preview = URL.createObjectURL(blob);
    if (lastShotRef.current) URL.revokeObjectURL(lastShotRef.current);
    lastShotRef.current = preview;
    setLastShot(preview);
    setSaved((count) => count + 1);
    setPhase("live");
  }, [captureFrame, phase]);

  const record = useCallback(() => {
    const stream = streamRef.current;
    const mime = mode === "audio" ? preferredAudioMime() : preferredVideoMime();
    if (!stream || !mime) {
      setError(
        mode === "audio"
          ? "Recording isn't supported in this browser — upload a sample below."
          : "Recording isn't supported in this browser — upload a video below."
      );
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
  }, [mode]);

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }, []);

  const finalizeClip = useCallback(async () => {
    if (!clip) return;
    setPhase("saving");
    const type = clip.blob.type;
    const ext =
      type === "video/mp4" ? "mp4" : type === "audio/mp4" ? "m4a" : "webm";
    const ok =
      mode === "audio"
        ? await postCapture("upload_media", clip.blob, `sample.${ext}`, {
            role: "voice_sample",
            source: "booth",
          })
        : await postCapture("upload_consent", clip.blob, `consent.${ext}`);
    if (ok) {
      window.location.reload();
      return;
    }
    setPhase("review");
    setError("Upload failed — try again, or use the form below.");
  }, [clip, mode]);

  const cameraOn = phase === "live" || phase === "recording";

  // When the other booth mode lives on a sibling pager pane, the mode strip
  // scrolls to it like the iPhone camera's mode dial; when the modes are
  // separate stepper panels the inactive label is inert chrome.
  const otherPane =
    typeof document !== "undefined" &&
    document.getElementById(mode === "photo" ? "pane-video" : "pane-photo")
      ? `#pane-${mode === "photo" ? "video" : "photo"}`
      : null;
  const inactive = (label: string): React.ReactElement =>
    otherPane ? (
      <a className="cam-mode" role="tab" aria-selected="false" href={otherPane}>
        {label}
      </a>
    ) : (
      <span className="cam-mode off" role="tab" aria-selected="false">
        {label}
      </span>
    );
  const modeStrip = (
    <div className="cam-modes" role="tablist" aria-label="camera mode">
      {mode === "photo" ? (
        <>
          <span className="cam-mode on" role="tab" aria-selected="true">
            PHOTO
          </span>
          {inactive("VIDEO")}
        </>
      ) : mode === "video" ? (
        <>
          {inactive("PHOTO")}
          <span className="cam-mode on" role="tab" aria-selected="true">
            VIDEO
          </span>
        </>
      ) : (
        <span className="cam-mode on" role="tab" aria-selected="true">
          AUDIO
        </span>
      )}
    </div>
  );
  const isAudio = mode === "audio";

  return (
    <StrictMode>
      <div className={`booth booth-mode-${mode}`}>
        <div className={`cam${cameraOn && !isAudio ? " on" : ""}${isAudio ? " audio" : ""}`}>
          <div className="cam-stage">
            {isAudio ? (
              <div className="cam-mic" aria-hidden="true">
                <span className={`cam-mic-ring${phase === "recording" ? " live" : ""}`} />
                <svg viewBox="0 0 24 24" width="30" height="30">
                  <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                  <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`cam-video${facing === "user" ? " mirror" : ""}`}
              />
            )}
            {cameraOn && !isAudio ? (
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
            {mode === "photo" && cameraOn && saved > 0 ? (
              <div className="cam-count">{saved} saved</div>
            ) : null}
            {!cameraOn && phase !== "saving" ? (
              <button
                type="button"
                className="cam-start"
                disabled={phase === "starting"}
                onClick={() => void start(facing)}
              >
                {phase === "starting"
                  ? isAudio
                    ? "Starting microphone…"
                    : "Starting camera…"
                  : mode === "photo"
                    ? "Open photo booth"
                    : isAudio
                      ? "Record a voice sample"
                      : "Open camera"}
              </button>
            ) : null}
            {phase === "saving" ? (
              <div className="cam-saving" aria-live="polite">
                {mode !== "photo"
                  ? "Uploading…"
                  : "Saving photo…"}
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
                    <img src={lastShot} alt="last saved shot" />
                  ) : null}
                </span>
                {mode === "photo" ? (
                  <button
                    type="button"
                    className="cam-shutter"
                    aria-label="take photo"
                    disabled={phase !== "live"}
                    onClick={() => void shoot()}
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
                {isAudio ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    className="cam-flip"
                    aria-label="flip camera"
                    disabled={phase !== "live"}
                    onClick={flip}
                  >
                    <FlipIcon />
                  </button>
                )}
              </div>
              {isAudio && phase === "live" ? (
                <p className="cam-hint">
                  Quiet room, natural pace — read a few sentences, up to a minute.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {error ? <p className="booth-error">{error}</p> : null}
        {mode === "photo" ? (
          saved > 0 ? (
            <div className="booth-controls">
              <button
                type="button"
                className="cam-confirm"
                disabled={phase === "saving"}
                onClick={() => window.location.reload()}
              >
                <CheckBadge on />
                Review {saved} saved photo{saved === 1 ? "" : "s"}
              </button>
            </div>
          ) : null
        ) : clip && phase !== "recording" ? (
          <div className="booth-clip">
            {isAudio ? (
              <audio src={clip.url} controls className="booth-playback audio" />
            ) : (
              <video src={clip.url} controls playsInline className="booth-playback" />
            )}
            <div className="booth-controls">
              <button
                type="button"
                className="cam-confirm"
                disabled={phase === "saving"}
                onClick={() => void finalizeClip()}
              >
                <CheckBadge on />
                {isAudio ? "Use as voice sample" : "Use as consent recording"}
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
if (typeof document !== "undefined") {
  for (const mount of document.querySelectorAll<HTMLElement>(
    "#identity-booth, .identity-booth"
  )) {
    const requested = mount.getAttribute("data-mode");
    const mode: BoothMode =
      requested === "video" ? "video" : requested === "audio" ? "audio" : "photo";
    mount.replaceChildren();
    createRoot(mount).render(<Booth mode={mode} />);
  }
}
