/**
 * Voice transcription (M13). Audio is transient (C18): a clip travels
 * browser → route → the STT provider → text, and is never written to
 * Postgres, Supabase Storage, or a box. Only rate/cost metadata lands in
 * cost_events (kind: 'stt').
 */
import { env } from "../env";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 300;
export const STT_HOURLY_LIMIT = 20;

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

/** Base MIME (codec parameters stripped) → filename extension, or null if unsupported. */
export function audioExtension(mime: string): string | null {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return EXT_BY_MIME[base] ?? null;
}

/** Ledger amount for a clip: per-minute rate, ceil'd, never below one cent. */
export function sttCostCents(durationS: number): number {
  const minutes = Math.max(durationS, 1) / 60;
  return Math.max(1, Math.ceil(minutes * env.sttCostCentsPerMin()));
}

export class TranscriptionError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`stt provider responded ${status}`);
    this.status = status;
  }
}

export async function transcribeAudio(audio: Blob, ext: string): Promise<string> {
  const base = env.sttBaseUrl().replace(/\/+$/, "");
  const form = new FormData();
  form.append("file", audio, `clip.${ext}`);
  form.append("model", env.sttModel());
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.sttApiKey()}` },
    body: form,
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new TranscriptionError(res.status);
  }
  const parsed = (await res.json()) as { text?: unknown };
  return typeof parsed.text === "string" ? parsed.text.trim() : "";
}
