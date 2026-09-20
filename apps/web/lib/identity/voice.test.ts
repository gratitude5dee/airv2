/**
 * ElevenLabs client contract: IVC create is one multipart POST to
 * v1/voices/add carrying name + files under the xi-api-key header; delete
 * is idempotent on 404; TTS posts JSON and returns mp3 bytes. The key never
 * appears anywhere but the header, and provider messages are surfaced
 * trimmed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreativeUnconfiguredError } from "../creative/groq";
import {
  createInstantVoiceClone,
  deleteVoice,
  ElevenLabsError,
  elevenlabsAvailable,
  synthesizeSpeech,
  TTS_MIME_TYPE,
} from "./voice";

afterEach(() => {
  vi.unstubAllEnvs();
});

const sample = {
  bytes: Buffer.from("RIFF....WAVEfmt "),
  mimeType: "audio/wav",
  filename: "sample-1.wav",
};

function fetchReturning(
  status: number,
  body: unknown,
  calls: Array<{ url: string; init: RequestInit }>
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    if (body instanceof Buffer) {
      return new Response(new Uint8Array(body), {
        status,
        headers: { "Content-Type": TTS_MIME_TYPE },
      });
    }
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("createInstantVoiceClone", () => {
  it("is unconfigured without the key", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    expect(elevenlabsAvailable()).toBe(false);
    await expect(
      createInstantVoiceClone({ name: "x", files: [sample] })
    ).rejects.toBeInstanceOf(CreativeUnconfiguredError);
  });

  it("posts multipart to v1/voices/add with the key in the header only", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-secret");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const result = await createInstantVoiceClone(
      {
        name: "@grat twin",
        files: [sample, { ...sample, filename: "sample-2.wav" }],
        description: "AirV2 twin",
        removeBackgroundNoise: false,
        labels: { source: "airv2-onboarding" },
      },
      {
        fetch: fetchReturning(
          200,
          { voice_id: "voice_123", requires_verification: false },
          calls
        ),
      }
    );
    expect(result).toEqual({ voiceId: "voice_123", requiresVerification: false });
    const call = calls[0]!;
    expect(call.url).toBe("https://api.elevenlabs.io/v1/voices/add");
    expect(call.init.method).toBe("POST");
    expect((call.init.headers as Record<string, string>)["xi-api-key"]).toBe(
      "xi-secret"
    );
    const form = call.init.body as FormData;
    expect(form.get("name")).toBe("@grat twin");
    expect(form.getAll("files")).toHaveLength(2);
    expect(form.get("remove_background_noise")).toBe("false");
    expect(form.get("labels")).toBe('{"source":"airv2-onboarding"}');
    expect(JSON.stringify(call.url)).not.toContain("xi-secret");
  });

  it("surfaces the provider's short reason on a rejection", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-secret");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    await expect(
      createInstantVoiceClone(
        { name: "x", files: [sample] },
        {
          fetch: fetchReturning(
            422,
            { detail: { status: "voice_limit_reached", message: "Voice limit reached" } },
            calls
          ),
        }
      )
    ).rejects.toMatchObject({ status: 422, message: "Voice limit reached" });
  });

  it("refuses an empty sample list before any request", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-secret");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    await expect(
      createInstantVoiceClone(
        { name: "x", files: [] },
        { fetch: fetchReturning(200, {}, calls) }
      )
    ).rejects.toBeInstanceOf(ElevenLabsError);
    expect(calls).toHaveLength(0);
  });
});

describe("deleteVoice", () => {
  it("DELETEs v1/voices/{id} and treats 404 as already gone", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-secret");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    expect(await deleteVoice("voice 1", { fetch: fetchReturning(200, {}, calls) })).toBe(true);
    expect(calls[0]?.url).toBe("https://api.elevenlabs.io/v1/voices/voice%201");
    expect(calls[0]?.init.method).toBe("DELETE");
    expect(await deleteVoice("gone", { fetch: fetchReturning(404, {}, calls) })).toBe(true);
    expect(await deleteVoice("x", { fetch: fetchReturning(500, {}, calls) })).toBe(false);
  });
});

describe("synthesizeSpeech", () => {
  it("posts the script as JSON and returns the mp3 bytes", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-secret");
    vi.stubEnv("ELEVENLABS_TTS_MODEL", "eleven_test_v9");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const speech = await synthesizeSpeech(
      { voiceId: "voice_123", text: "Welcome to AirV2" },
      { fetch: fetchReturning(200, Buffer.from("ID3mp3bytes"), calls) }
    );
    expect(speech.mimeType).toBe(TTS_MIME_TYPE);
    expect(speech.bytes.toString()).toBe("ID3mp3bytes");
    const call = calls[0]!;
    expect(call.url).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice_123?output_format=mp3_44100_128"
    );
    expect(JSON.parse(String(call.init.body))).toEqual({
      text: "Welcome to AirV2",
      model_id: "eleven_test_v9",
    });
  });

  it("rejects an empty or oversized script without a request", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-secret");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    await expect(
      synthesizeSpeech({ voiceId: "v", text: "   " }, { fetch: fetchReturning(200, {}, calls) })
    ).rejects.toBeInstanceOf(ElevenLabsError);
    await expect(
      synthesizeSpeech(
        { voiceId: "v", text: "x".repeat(1_001) },
        { fetch: fetchReturning(200, {}, calls) }
      )
    ).rejects.toBeInstanceOf(ElevenLabsError);
    expect(calls).toHaveLength(0);
  });
});
