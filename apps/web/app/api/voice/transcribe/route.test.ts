import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const sessionUserIdMock = vi.fn<() => string | undefined>(() => "user-1");
vi.mock("@/lib/auth/user", () => ({
  sessionUserId: (...args: unknown[]) => sessionUserIdMock(...(args as [])),
}));

const db = new FakeSupabase();
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.client(),
}));

import { POST } from "./route";

import { expectLog } from "@/lib/testing/expectLog";
// The route rate-limits by counting this user's stt rows newer than an hour
// ago, so seeding N fresh rows simulates N recent clips.
function seedSttEvents(count: number): void {
  const now = new Date().toISOString();
  db.tables["cost_events"] = Array.from({ length: count }, (_, i) => ({
    id: `stt-${i}`,
    user_id: "user-1",
    kind: "stt",
    occurred_at: now,
    amount_cents: 1,
    ref: null,
  }));
}

function costInserts(): Record<string, unknown>[] {
  return db.inserts
    .filter((i) => i.table === "cost_events")
    .map((i) => i.row);
}

function audioRequest(
  blob: Blob,
  { durationS, field = "audio" }: { durationS?: number; field?: string } = {}
): NextRequest {
  const form = new FormData();
  form.append(field, blob, "clip.webm");
  if (durationS !== undefined) form.append("duration_s", String(durationS));
  return new NextRequest("http://test.local/api/voice/transcribe", {
    method: "POST",
    body: form,
  });
}

const clip = (type: string, bytes = 16): Blob =>
  new Blob([new Uint8Array(bytes)], { type });

describe("POST /api/voice/transcribe", () => {
  beforeEach(() => {
    process.env["MODEL_PROVIDER_BASE_URL"] = "https://stt.test/v1";
    process.env["MODEL_PROVIDER_API_KEY"] = "test-key";
    delete process.env["STT_BASE_URL"];
    delete process.env["STT_API_KEY"];
    delete process.env["STT_MODEL"];
    delete process.env["STT_COST_CENTS_PER_MIN"];
    sessionUserIdMock.mockReturnValue("user-1");
    db.reset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ text: "hello world" })))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated request", async () => {
    sessionUserIdMock.mockReturnValue(undefined);
    const res = await POST(audioRequest(clip("audio/webm")));
    expect(res.status).toBe(401);
  });

  it("rejects an unsupported MIME type", async () => {
    const res = await POST(audioRequest(clip("video/mp4")));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unsupported_format" });
  });

  it("rejects a missing audio field", async () => {
    const res = await POST(audioRequest(clip("audio/webm"), { field: "clip" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing_audio" });
  });

  it("rejects an oversize upload with 413", async () => {
    const res = await POST(
      audioRequest(clip("audio/webm", 25 * 1024 * 1024 + 1))
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
  });

  it("rejects a clip over five minutes with 413", async () => {
    const res = await POST(audioRequest(clip("audio/webm"), { durationS: 301 }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
  });

  it("rate limits the 21st clip in an hour", async () => {
    seedSttEvents(20);
    const res = await POST(audioRequest(clip("audio/webm"), { durationS: 10 }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  it("fails closed when the rate-limit count is unavailable", async () => {
    db.opErrors["cost_events:select"] = { message: "connection refused" };
    const res = await POST(audioRequest(clip("audio/webm"), { durationS: 10 }));
    expect(res.status).toBe(500);
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).not.toHaveBeenCalled();
    expectLog(/stt\ rate\-limit\ count\ failed/, { level: "error" });
  });

  it("logs a rejected cost-event insert instead of dropping it silently", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    db.opErrors["cost_events:insert"] = {
      message: 'violates check constraint "cost_events_kind_check"',
    };
    const res = await POST(audioRequest(clip("audio/webm"), { durationS: 10 }));
    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("stt cost event insert failed")
    );
    errorSpy.mockRestore();
  });

  it("maps a provider 500 to 502 without writing a cost event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream broke", { status: 500 }))
    );
    const res = await POST(audioRequest(clip("audio/webm"), { durationS: 10 }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "transcription_failed" });
    expect(costInserts()).toHaveLength(0);
    expectLog(/stt\ failed/, { level: "error" });
  });

  it("transcribes a valid clip and records one stt cost event", async () => {
    seedSttEvents(3);
    const res = await POST(
      audioRequest(clip("audio/webm;codecs=opus"), { durationS: 90 })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "hello world", duration_s: 90 });
    expect(costInserts()).toHaveLength(1);
    expect(costInserts()[0]).toMatchObject({
      user_id: "user-1",
      kind: "stt",
      amount_cents: 2,
      ref: null,
    });
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://stt.test/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-key"
    );
  });
});
