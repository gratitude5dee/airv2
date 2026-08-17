"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ArrowUp,
  Check,
  Gauge,
  Mic,
  Plus,
  Sparkles,
  Square,
} from "lucide-react";
import styles from "./PromptInput.module.css";

export interface SpeedTier {
  id: string;
  name: string;
  desc: string;
}

export const SPEED_TIERS: SpeedTier[] = [
  {
    id: "fast",
    name: "Fast",
    desc: "Snappy replies for quick questions and everyday tasks.",
  },
  {
    id: "balanced",
    name: "Balanced",
    desc: "A middle ground — thoughtful answers without the wait.",
  },
  {
    id: "deep",
    name: "Deep",
    desc: "Takes its time on complex, multi-step work.",
  },
];

/** M16 creative commands surfaced when the composer starts with "/". */
export const CREATIVE_COMMANDS = [
  { id: "/imagine", desc: "Make an image from your words." },
  { id: "/animate", desc: "Turn an idea into a short video." },
  { id: "/zap", desc: "A quick, kinetic video clip." },
] as const;

export interface PromptInputProps {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  busy?: boolean;
  placeholder?: string;
  tier: string;
  onTierChange: (tier: string) => void;
  /** Display-only model labels per tier id, server-supplied via /api/me. */
  tierModels?: Partial<Record<string, string>>;
  /** Fired when a transcription lands in the composer (voice-trigger tracking, M13). */
  onVoiceTranscript?: () => void;
}

/** Hard stop for a recording — mirrors the server's five-minute cap. */
const MAX_RECORDING_SECONDS = 300;

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

type VoiceState = "idle" | "recording" | "transcribing";

function formatElapsed(totalS: number): string {
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PromptInput({
  value,
  onChange,
  onSend,
  busy,
  placeholder = "Message your agent…",
  tier,
  onTierChange,
  tierModels,
  onVoiceTranscript,
}: PromptInputProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);
  const [paletteDismissed, setPaletteDismissed] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [elapsedS, setElapsedS] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const startingRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const sendActive = value.trim().length > 0 && !busy;

  // Command palette: typing "/" at the start of the composer lists the
  // creative commands; anything past the first word closes it.
  const paletteMatches = /^\/[a-z]*$/i.test(value)
    ? CREATIVE_COMMANDS.filter((c) =>
        c.id.startsWith(value.toLowerCase())
      )
    : [];
  const paletteOpen = !paletteDismissed && paletteMatches.length > 0;

  useEffect(() => {
    if (!/^\/[a-z]*$/i.test(value)) setPaletteDismissed(false);
  }, [value]);

  // Auto-grow the textarea up to its CSS max-height.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = Math.min(field.scrollHeight, 160) + "px";
  }, [value]);

  // Dismiss the "+" menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!plusRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) setHoveredTier(null);
  }, [menuOpen]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (paletteOpen && e.key === "Escape") {
      e.preventDefault();
      setPaletteDismissed(true);
      return;
    }
    const first = paletteMatches[0];
    if (paletteOpen && first && (e.key === "Tab" || e.key === "Enter")) {
      e.preventDefault();
      onChange(`${first.id} `);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (sendActive) onSend();
    }
  };

  // Voice input is feature-detected: no MediaRecorder/getUserMedia, no button.
  useEffect(() => {
    setVoiceSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function" &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  const transcribe = useCallback(
    async (audio: Blob, durationS: number) => {
      setVoiceState("transcribing");
      try {
        const baseMime = (audio.type || "audio/webm").split(";")[0];
        const ext =
          baseMime === "audio/mp4"
            ? "mp4"
            : baseMime === "audio/wav"
              ? "wav"
              : "webm";
        const form = new FormData();
        form.append("audio", audio, `clip.${ext}`);
        form.append("duration_s", String(durationS));
        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          setVoiceError(
            res.status === 429
              ? "Voice limit reached — try again in an hour."
              : res.status === 413
                ? "That recording was too long — try a shorter one."
                : "Couldn't transcribe — try again."
          );
          return;
        }
        const parsed = (await res.json()) as { text?: string };
        const text = (parsed.text ?? "").trim();
        if (text) {
          const current = valueRef.current;
          onChange(current.trim() ? `${current.replace(/\s+$/, "")} ${text}` : text);
          onVoiceTranscript?.();
          fieldRef.current?.focus();
        }
      } catch {
        setVoiceError("Couldn't transcribe — try again.");
      } finally {
        setVoiceState("idle");
      }
    },
    [onChange, onVoiceTranscript]
  );

  const stopRecording = useCallback((discard: boolean) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    discardRef.current = discard;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      setVoiceState("idle");
    }
  }, []);

  const startRecording = useCallback(async () => {
    // Guards re-entry while getUserMedia's permission prompt is pending; a
    // second start would orphan the first stream and leave the mic live.
    if (startingRef.current) return;
    startingRef.current = true;
    setVoiceError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceError(
        "Microphone is blocked — allow it in your browser's site settings."
      );
      startingRef.current = false;
      return;
    }
    const mimeType = RECORDER_MIME_CANDIDATES.find((c) =>
      MediaRecorder.isTypeSupported(c)
    );
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setVoiceError("Recording isn't supported in this browser.");
      startingRef.current = false;
      return;
    }
    chunksRef.current = [];
    discardRef.current = false;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const chunks = chunksRef.current;
      chunksRef.current = [];
      if (discardRef.current) {
        setVoiceState("idle");
        return;
      }
      const durationS = Math.min(
        MAX_RECORDING_SECONDS,
        Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      );
      const type = recorder.mimeType || mimeType || "audio/webm";
      void transcribe(new Blob(chunks, { type }), durationS);
    };
    recorderRef.current = recorder;
    streamRef.current = stream;
    startedAtRef.current = Date.now();
    setElapsedS(0);
    setVoiceState("recording");
    recorder.start();
    timerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedS(Math.min(s, MAX_RECORDING_SECONDS));
      if (s >= MAX_RECORDING_SECONDS) stopRecording(false);
    }, 250);
    startingRef.current = false;
  }, [stopRecording, transcribe]);

  // Escape cancels and discards an in-progress recording.
  useEffect(() => {
    if (voiceState !== "recording") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopRecording(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [voiceState, stopRecording]);

  // Unmount: stop the recorder and release the microphone.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <div
        className={styles.frame}
        data-busy={busy || voiceState === "transcribing" || undefined}
      >
        {paletteOpen && (
          <div className={styles.palette} role="menu" aria-label="Commands">
            <div className={styles.menuLabel}>
              <Sparkles size={12} aria-hidden />
              Create
            </div>
            {paletteMatches.map((c) => (
              <button
                key={c.id}
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  onChange(`${c.id} `);
                  fieldRef.current?.focus();
                }}
              >
                <span className={styles.menuName}>{c.id}</span>
                <span className={styles.paletteDesc}>{c.desc}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={fieldRef}
          className={styles.field}
          rows={1}
          placeholder={placeholder}
          aria-label={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
        />

        <div className={styles.row}>
          <div className={styles.plusWrap} ref={plusRef}>
            <button
              type="button"
              className={[styles.iconBtn, styles.plus].join(" ")}
              data-open={menuOpen || undefined}
              aria-label="Choose speed"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className={styles.plusIcon}>
                <Plus size={14} />
              </span>
            </button>

            {menuOpen && (
              <div className={styles.menu} role="menu">
                <div className={styles.menuLabel}>
                  <Gauge size={12} aria-hidden />
                  Speed &amp; intelligence
                </div>
                {SPEED_TIERS.map((t) => (
                  <div
                    key={t.id}
                    className={styles.menuSub}
                    onMouseEnter={() => setHoveredTier(t.id)}
                    onMouseLeave={() => setHoveredTier(null)}
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={tier === t.id}
                      className={styles.menuItem}
                      onClick={() => {
                        onTierChange(t.id);
                        setMenuOpen(false);
                      }}
                    >
                      <span className={styles.menuName}>{t.name}</span>
                      {tier === t.id && (
                        <span className={styles.menuCheck}>
                          <Check size={14} />
                        </span>
                      )}
                    </button>
                    {hoveredTier === t.id && (
                      <div className={styles.menuPopover} role="tooltip">
                        <div className={styles.popoverTitle}>{t.name}</div>
                        <p className={styles.popoverDesc}>{t.desc}</p>
                        {tierModels?.[t.id] && (
                          <p className={styles.popoverModel}>{tierModels[t.id]}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.actions}>
            {voiceSupported && (
              <button
                type="button"
                className={[
                  styles.iconBtn,
                  voiceState === "recording" ? styles.micActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={
                  voiceState === "recording"
                    ? "Stop recording"
                    : "Record voice input"
                }
                aria-pressed={voiceState === "recording"}
                disabled={busy || voiceState === "transcribing"}
                onClick={() => {
                  if (voiceState === "recording") stopRecording(false);
                  else if (voiceState === "idle") void startRecording();
                }}
              >
                {voiceState === "recording" ? (
                  <Square size={12} />
                ) : (
                  <Mic size={14} />
                )}
              </button>
            )}
            <button
              type="button"
              className={[styles.iconBtn, styles.send, sendActive ? styles.sendActive : ""]
                .filter(Boolean)
                .join(" ")}
              aria-label="Send"
              disabled={!sendActive}
              onClick={onSend}
            >
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className={styles.voiceStatus} aria-live="polite">
        {voiceError ? (
          <span className={styles.voiceError}>{voiceError}</span>
        ) : voiceState === "recording" ? (
          `Recording… ${formatElapsed(elapsedS)}`
        ) : voiceState === "transcribing" ? (
          "Transcribing…"
        ) : null}
      </div>
    </div>
  );
}
