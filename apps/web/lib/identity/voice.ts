/**
 * ElevenLabs client for the digital twin: Instant Voice Clone (IVC), voice
 * deletion, and speech synthesis with the cloned voice. Control-plane only —
 * ELEVENLABS_API_KEY lives in Vercel env and never reaches a box or a
 * browser (C2). Thin fetch client in the lib/identity/heygen.ts style; the
 * endpoint contract mirrors @elevenlabs/elevenlabs-js 2.68 (`voices.ivc.create`
 * → POST v1/voices/add multipart; `voices.delete` → DELETE v1/voices/{id};
 * `textToSpeech.convert` → POST v1/text-to-speech/{id}?output_format=…).
 *
 * Nothing here decides *whether* a voice may be cloned — lib/identity/
 * voiceClone.ts checks consent, idempotency and lifecycle before calling in.
 * Provider error messages are surfaced trimmed (they carry quota/moderation
 * reasons, never a credential); request bodies are never logged.
 */
import { env } from "../env";
import { CreativeUnconfiguredError } from "../creative/groq";
import { asRecord } from "../records";

export const ELEVENLABS_IVC_PATH = "v1/voices/add";
export const elevenlabsVoicePath = (voiceId: string): string =>
  `v1/voices/${encodeURIComponent(voiceId)}`;
export const elevenlabsTtsPath = (voiceId: string): string =>
  `v1/text-to-speech/${encodeURIComponent(voiceId)}`;

/** MP3 44.1 kHz 128 kbps — accepted by every downstream consumer here. */
export const TTS_OUTPUT_FORMAT = "mp3_44100_128";
export const TTS_MIME_TYPE = "audio/mpeg";
/** Longest script a single /twin say turn will synthesize. */
export const TTS_MAX_CHARS = 1_000;
/** Cap on a synthesized clip we are willing to buffer (≈ 10 min of mp3). */
export const TTS_MAX_BYTES = 25 * 1024 * 1024;

const REQUEST_TIMEOUT_MS = 90_000;

export const elevenlabsAvailable = (): boolean =>
  env.elevenlabsApiKey() !== null;

export interface VoiceSampleFile {
  bytes: Buffer;
  mimeType: string;
  filename: string;
}

export interface CreatedVoice {
  voiceId: string;
  /** Some accounts must verify a clone in the ElevenLabs dashboard first. */
  requiresVerification: boolean;
}

export interface SynthesizedSpeech {
  bytes: Buffer;
  mimeType: string;
}

export class ElevenLabsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

export interface ElevenLabsOptions {
  /** Injected in tests; production uses global fetch. */
  fetch?: typeof fetch;
}

const keyOrThrow = (): string => {
  const key = env.elevenlabsApiKey();
  if (!key) throw new CreativeUnconfiguredError("ElevenLabs");
  return key;
};

const baseUrl = (): string => env.elevenlabsApiUrl().replace(/\/+$/, "");

/** A short, safe provider message: `detail.message` / `detail` / status. */
async function providerMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => undefined);
  const detail = asRecord(body)?.["detail"];
  const message =
    typeof detail === "string"
      ? detail
      : asRecord(detail)?.["message"];
  const text =
    typeof message === "string" && message.trim().length > 0
      ? message.trim()
      : `ElevenLabs responded ${response.status}`;
  return text.slice(0, 200);
}

/**
 * Create an Instant Voice Clone from the owner's approved samples. Returns
 * the provider voice id; the caller persists it. One un-retried request: a
 * transport failure is thrown as an ElevenLabsError(0) so the caller can
 * record `failed` and let the user retry under the same idempotency key.
 */
export async function createInstantVoiceClone(
  input: {
    name: string;
    files: readonly VoiceSampleFile[];
    description?: string | undefined;
    removeBackgroundNoise?: boolean | undefined;
    labels?: Record<string, string> | undefined;
  },
  options?: ElevenLabsOptions,
): Promise<CreatedVoice> {
  const key = keyOrThrow();
  if (input.files.length === 0) {
    throw new ElevenLabsError(400, "at least one voice sample is required");
  }
  const form = new FormData();
  form.set("name", input.name.slice(0, 100));
  for (const file of input.files) {
    form.append(
      "files",
      new File([new Uint8Array(file.bytes)], file.filename, {
        type: file.mimeType,
      }),
    );
  }
  if (input.removeBackgroundNoise !== undefined) {
    form.set("remove_background_noise", String(input.removeBackgroundNoise));
  }
  if (input.description) {
    form.set("description", input.description.slice(0, 500));
  }
  if (input.labels) {
    form.set("labels", JSON.stringify(input.labels));
  }
  const run = options?.fetch ?? fetch;
  let response: Response;
  try {
    response = await run(`${baseUrl()}/${ELEVENLABS_IVC_PATH}`, {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ElevenLabsError(0, "couldn't reach ElevenLabs");
  }
  if (!response.ok) {
    throw new ElevenLabsError(response.status, await providerMessage(response));
  }
  const body: unknown = await response.json().catch(() => undefined);
  const record = asRecord(body);
  const voiceId = record?.["voice_id"];
  if (typeof voiceId !== "string" || voiceId.length === 0) {
    throw new ElevenLabsError(502, "ElevenLabs returned no voice id");
  }
  return {
    voiceId,
    requiresVerification: record?.["requires_verification"] === true,
  };
}

/** Delete a cloned voice at the provider. A voice that is already gone
 * (404) counts as deleted so revocation is idempotent. */
export async function deleteVoice(
  voiceId: string,
  options?: ElevenLabsOptions,
): Promise<boolean> {
  const key = keyOrThrow();
  const run = options?.fetch ?? fetch;
  let response: Response;
  try {
    response = await run(`${baseUrl()}/${elevenlabsVoicePath(voiceId)}`, {
      method: "DELETE",
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return false;
  }
  await response.body?.cancel().catch(() => undefined);
  return response.ok || response.status === 404;
}

/**
 * Synthesize one script with the cloned voice. Returns mp3 bytes for the
 * caller to store as a private asset and hand to the lip-sync lane.
 */
export async function synthesizeSpeech(
  input: { voiceId: string; text: string; modelId?: string | undefined },
  options?: ElevenLabsOptions,
): Promise<SynthesizedSpeech> {
  const key = keyOrThrow();
  const text = input.text.trim();
  if (text.length === 0 || text.length > TTS_MAX_CHARS) {
    throw new ElevenLabsError(
      400,
      `script must be 1–${TTS_MAX_CHARS} characters`,
    );
  }
  const run = options?.fetch ?? fetch;
  const url = `${baseUrl()}/${elevenlabsTtsPath(input.voiceId)}?output_format=${TTS_OUTPUT_FORMAT}`;
  let response: Response;
  try {
    response = await run(url, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: TTS_MIME_TYPE,
      },
      body: JSON.stringify({
        text,
        model_id: input.modelId ?? env.elevenlabsTtsModel(),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ElevenLabsError(0, "couldn't reach ElevenLabs");
  }
  if (!response.ok) {
    throw new ElevenLabsError(response.status, await providerMessage(response));
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new ElevenLabsError(502, "ElevenLabs returned empty audio");
  }
  if (buffer.byteLength > TTS_MAX_BYTES) {
    throw new ElevenLabsError(413, "synthesized audio is too large");
  }
  return { bytes: buffer, mimeType: TTS_MIME_TYPE };
}
