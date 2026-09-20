/**
 * Voice clone lifecycle: consent-gated, idempotent per sample set, provider
 * cleanup when the row write fails, revoke deletes provider-side.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const voice = vi.hoisted(() => ({
  elevenlabsAvailable: vi.fn(() => true),
  createInstantVoiceClone: vi.fn(),
  deleteVoice: vi.fn(async () => true),
  synthesizeSpeech: vi.fn(),
}));
vi.mock("./voice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./voice")>()),
  elevenlabsAvailable: () => voice.elevenlabsAvailable(),
  createInstantVoiceClone: (...args: unknown[]) =>
    voice.createInstantVoiceClone(...(args as [])),
  deleteVoice: (...args: unknown[]) => voice.deleteVoice(...(args as [])),
  synthesizeSpeech: (...args: unknown[]) =>
    voice.synthesizeSpeech(...(args as [])),
}));

const consent = vi.hoisted(() => ({
  getConsent: vi.fn(),
  revokeConsent: vi.fn(async () => true),
}));
vi.mock("./consent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./consent")>()),
  getConsent: (...args: unknown[]) => consent.getConsent(...(args as [])),
  revokeConsent: (...args: unknown[]) => consent.revokeConsent(...(args as [])),
}));

const assets = vi.hoisted(() => ({
  listIdentityAssets: vi.fn(),
  downloadIdentityAsset: vi.fn(async () => Buffer.from("wav")),
}));
vi.mock("./assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./assets")>()),
  listIdentityAssets: (...args: unknown[]) =>
    assets.listIdentityAssets(...(args as [])),
  downloadIdentityAsset: (...args: unknown[]) =>
    assets.downloadIdentityAsset(...(args as [])),
}));

const twinRow = vi.hoisted(() => ({
  getDigitalTwin: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  patchTwin: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
}));
vi.mock("./twinRow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./twinRow")>()),
  getDigitalTwin: (...args: unknown[]) => twinRow.getDigitalTwin(...(args as [])),
  patchTwin: (...args: unknown[]) => twinRow.patchTwin(...(args as [])),
}));

vi.mock("../creative/store", () => ({
  ingestGeneratedAudio: vi.fn(async () => ({ id: "speech-1" })),
}));

import {
  createUserVoiceClone,
  revokeUserVoiceClone,
  synthesizeTwinSpeech,
  VOICE_SAMPLES_NEEDED_LINE,
  voiceIdempotencyKey,
} from "./voiceClone";

const supabase = {} as SupabaseClient;
const sample = (id: string) => ({
  id: `row-${id}`,
  asset_id: id,
  role: "voice_sample" as const,
  position: 0,
  source: "booth" as const,
  status: "ready" as const,
  consent_id: "c-voice",
  label: null,
  provider_ref: null,
  created_at: "2026-09-01T00:00:00Z",
  asset: {
    id,
    user_id: "u1",
    box_asset_id: `upload:${id}`,
    sha256: `${id}abcdef0123456789`,
    ext: "wav",
    kind: "wav",
    bytes: 3,
    storage_key: `u1/masters/${id}.wav`,
    created_at: "2026-09-01T00:00:00Z",
  },
});

beforeEach(() => {
  voice.elevenlabsAvailable.mockReturnValue(true);
  voice.createInstantVoiceClone.mockReset();
  voice.deleteVoice.mockClear();
  consent.getConsent.mockReset();
  consent.getConsent.mockResolvedValue({ id: "c-voice", scope: "voice" });
  assets.listIdentityAssets.mockReset();
  assets.listIdentityAssets.mockResolvedValue([sample("s1"), sample("s2")]);
  twinRow.getDigitalTwin.mockReset();
  twinRow.getDigitalTwin.mockResolvedValue(null);
  twinRow.patchTwin.mockReset();
  twinRow.patchTwin.mockResolvedValue(true);
});

describe("createUserVoiceClone", () => {
  it("refuses without the voice grant, before any provider call", async () => {
    consent.getConsent.mockResolvedValue(null);
    const result = await createUserVoiceClone(supabase, "u1", "grat");
    expect(result.ok).toBe(false);
    expect(voice.createInstantVoiceClone).not.toHaveBeenCalled();
  });

  it("asks for samples when the vault has none", async () => {
    assets.listIdentityAssets.mockResolvedValue([]);
    const result = await createUserVoiceClone(supabase, "u1", "grat");
    expect(result).toEqual({ ok: false, error: VOICE_SAMPLES_NEEDED_LINE });
  });

  it("creates once, records pending then ready, and stores only the handle", async () => {
    voice.createInstantVoiceClone.mockResolvedValue({
      voiceId: "voice_9",
      requiresVerification: false,
    });
    const result = await createUserVoiceClone(supabase, "u1", "grat");
    expect(result).toEqual({ ok: true, status: "ready", voiceId: "voice_9" });
    const call = voice.createInstantVoiceClone.mock.calls[0]?.[0] as {
      name: string;
      files: unknown[];
    };
    expect(call.name).toBe("@grat twin");
    expect(call.files).toHaveLength(2);
    const patches = twinRow.patchTwin.mock.calls.map((c) => c[2] as Record<string, unknown>);
    expect(patches[0]).toMatchObject({
      voice_provider: "elevenlabs",
      voice_status: "pending",
      voice_source_asset_ids: ["s1", "s2"],
      voice_idempotency_key: voiceIdempotencyKey(["s2", "s1"]),
    });
    expect(patches[1]).toMatchObject({ voice_id: "voice_9", voice_status: "ready" });
  });

  it("is idempotent for the same sample set", async () => {
    twinRow.getDigitalTwin.mockResolvedValue({
      voice_id: "voice_9",
      voice_status: "ready",
      voice_idempotency_key: voiceIdempotencyKey(["s1", "s2"]),
    });
    const result = await createUserVoiceClone(supabase, "u1", "grat");
    expect(result).toEqual({ ok: true, status: "ready", voiceId: "voice_9" });
    expect(voice.createInstantVoiceClone).not.toHaveBeenCalled();
    expect(twinRow.patchTwin).not.toHaveBeenCalled();
  });

  it("replaces a clone made from a different sample set", async () => {
    twinRow.getDigitalTwin.mockResolvedValue({
      voice_id: "voice_old",
      voice_status: "ready",
      voice_idempotency_key: "stale",
    });
    voice.createInstantVoiceClone.mockResolvedValue({
      voiceId: "voice_new",
      requiresVerification: true,
    });
    const result = await createUserVoiceClone(supabase, "u1", "grat");
    expect(voice.deleteVoice).toHaveBeenCalledWith("voice_old", undefined);
    expect(result).toEqual({ ok: true, status: "pending", voiceId: "voice_new" });
  });

  it("records a failed attempt with the provider's line", async () => {
    const { ElevenLabsError } = await import("./voice");
    voice.createInstantVoiceClone.mockRejectedValue(
      new ElevenLabsError(422, "Voice limit reached")
    );
    const result = await createUserVoiceClone(supabase, "u1", "grat");
    expect(result).toEqual({ ok: false, error: "voice clone failed — Voice limit reached" });
    expect(twinRow.patchTwin).toHaveBeenLastCalledWith(supabase, "u1", {
      voice_status: "failed",
      voice_error: "voice clone failed — Voice limit reached",
    });
  });

  it("deletes the provider voice when the row write fails after creation", async () => {
    voice.createInstantVoiceClone.mockResolvedValue({
      voiceId: "voice_orphan",
      requiresVerification: false,
    });
    twinRow.patchTwin
      .mockResolvedValueOnce(true) // pending
      .mockResolvedValueOnce(false) // ready write fails
      .mockResolvedValueOnce(true); // failed marker
    const result = await createUserVoiceClone(supabase, "u1", "grat");
    expect(result.ok).toBe(false);
    expect(voice.deleteVoice).toHaveBeenCalledWith("voice_orphan", undefined);
  });
});

describe("revokeUserVoiceClone / synthesizeTwinSpeech", () => {
  it("deletes provider-side, marks revoked, and optionally revokes consent", async () => {
    twinRow.getDigitalTwin.mockResolvedValue({ voice_id: "voice_9", voice_status: "ready" });
    expect(await revokeUserVoiceClone(supabase, "u1", { revokeConsent: true })).toBe(true);
    expect(voice.deleteVoice).toHaveBeenCalledWith("voice_9", undefined);
    expect(twinRow.patchTwin).toHaveBeenCalledWith(
      supabase,
      "u1",
      expect.objectContaining({ voice_id: null, voice_status: "revoked" })
    );
    expect(consent.revokeConsent).toHaveBeenCalledWith(supabase, "u1", "voice");
  });

  it("keeps the row when the provider delete fails (nothing silently orphaned)", async () => {
    twinRow.getDigitalTwin.mockResolvedValue({ voice_id: "voice_9", voice_status: "ready" });
    voice.deleteVoice.mockResolvedValueOnce(false);
    expect(await revokeUserVoiceClone(supabase, "u1", {})).toBe(false);
    expect(twinRow.patchTwin).not.toHaveBeenCalled();
  });

  it("speaks only with a ready clone and stores the clip as an asset", async () => {
    twinRow.getDigitalTwin.mockResolvedValue({ voice_id: "voice_9", voice_status: "ready" });
    voice.synthesizeSpeech.mockResolvedValue({ bytes: Buffer.from("mp3"), mimeType: "audio/mpeg" });
    const spoken = await synthesizeTwinSpeech(supabase, "u1", "hello");
    expect(spoken).toEqual({ ok: true, asset: { id: "speech-1" } });
    twinRow.getDigitalTwin.mockResolvedValue({ voice_id: null, voice_status: "none" });
    const silent = await synthesizeTwinSpeech(supabase, "u1", "hello");
    expect(silent.ok).toBe(false);
  });
});
