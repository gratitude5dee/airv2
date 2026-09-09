import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OnairosError, personaBlock } from "./context";
import {
  fetchPersona,
  PERSONA_CACHE_TTL_MS,
  personaUrl,
  resyncOnairos,
  syncOnairos,
} from "./sync";
import { BoxApiError, command, readFile, writeFile } from "@/lib/box/client";
import { USER_PROFILE_CHAR_LIMIT, USER_PROFILE_PATH } from "@/lib/memory/files";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { deepMemoryForget, deepMemoryIndex } from "@/lib/memory/deep";

vi.mock("@/lib/box/client", async (importOriginal) => ({
  BoxApiError: (await importOriginal<typeof import("@/lib/box/client")>()).BoxApiError,
  command: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(),
  armStopAfter: vi.fn(),
}));
vi.mock("@/lib/memory/deep", () => ({
  deepMemoryIndex: vi.fn(),
  deepMemoryForget: vi.fn(),
  OV_ONAIROS_URI: "ov://onairos",
}));

function fakeSupabase(): SupabaseClient {
  return {
    from: () => ({ upsert: vi.fn().mockResolvedValue({}) }),
  } as unknown as SupabaseClient;
}

const handoff = {
  token: "tok",
  apiUrl: "https://api2.onairos.uk/persona/full",
};

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("personaUrl", () => {
  it("swaps inference endpoints for the traits-only endpoint", () => {
    for (const path of [
      "/combined-inference",
      "/combinedInference",
      "/combined-training-inference",
      "/inferenceNoProof",
      "/mobileInferenceNoProof",
    ]) {
      expect(personaUrl(`https://api2.onairos.uk${path}?x=1`)).toBe(
        "https://api2.onairos.uk/traits-only?x=1"
      );
    }
  });

  it("leaves trait/persona endpoints and unparseable urls alone", () => {
    expect(personaUrl("https://api2.onairos.uk/traits-only-fast")).toBe(
      "https://api2.onairos.uk/traits-only-fast"
    );
    expect(personaUrl("https://api2.onairos.uk/persona/full")).toBe(
      "https://api2.onairos.uk/persona/full"
    );
    expect(personaUrl("not a url")).toBe("not a url");
  });
});

describe("fetchPersona", () => {
  it("POSTs the traits endpoint and returns the payload", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, { traits: { archetype: "Maker" } }));
    const persona = await fetchPersona({
      ...handoff,
      apiUrl: "https://api2.onairos.uk/combined-inference",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api2.onairos.uk/traits-only"
    );
    expect(persona).toEqual({ traits: { archetype: "Maker" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("retries read-only endpoints as GET when POST is not a route", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { message: "not found" }))
      .mockResolvedValueOnce(jsonResponse(200, { userProfile: {} }));
    const persona = await fetchPersona(handoff);
    expect(persona).toEqual({ userProfile: {} });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "GET" });
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty("body");
  });

  it("reports the GET status when the retry also fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(405))
      .mockResolvedValueOnce(jsonResponse(401, { error: "JWT_INVALID" }));
    await expect(fetchPersona(handoff)).rejects.toThrow(
      "persona fetch failed (401)"
    );
  });

  it("logs method, path and status without payload bytes", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(500, { secret: "persona bytes" })
    );
    await expect(
      fetchPersona({ ...handoff, apiUrl: "https://api2.onairos.uk/getPersona" })
    ).rejects.toBeInstanceOf(OnairosError);
    expect(errorSpy).toHaveBeenCalledWith(
      JSON.stringify({
        msg: "onairos persona fetch failed",
        method: "POST",
        path: "/getPersona",
        status: 500,
      })
    );
  });

  it("maps a training guard to a retryable error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(202));
    await expect(fetchPersona(handoff)).rejects.toThrow(
      "persona still training"
    );
  });
});

describe("resyncOnairos caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(command).mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(ensureBoxAwake).mockResolvedValue({
      boxId: "bx_test",
    } as Awaited<ReturnType<typeof ensureBoxAwake>>);
    vi.mocked(armStopAfter).mockResolvedValue(undefined);
    vi.mocked(deepMemoryIndex).mockResolvedValue(true);
    vi.mocked(deepMemoryForget).mockResolvedValue(true);
  });

  const cachedJson = (syncedAt: string) =>
    JSON.stringify({ synced_at: syncedAt, persona: { traits: {} } });

  it.each([new Error("offline"), new BoxApiError(500, "unavailable")])(
    "does not write persona, grant, or profile when the profile cannot be read: %s",
    async (error) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { traits: {} }));
      vi.mocked(readFile).mockRejectedValue(error);
      await expect(syncOnairos(fakeSupabase(), "user-1", handoff)).rejects.toThrow(error);
      expect(writeFile).not.toHaveBeenCalled();
      expect(deepMemoryIndex).not.toHaveBeenCalled();
    }
  );

  it("refuses an oversized profile before any content write", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { traits: {} }));
    vi.mocked(readFile).mockResolvedValue("x".repeat(USER_PROFILE_CHAR_LIMIT));
    await expect(syncOnairos(fakeSupabase(), "user-1", handoff)).rejects.toMatchObject({ status: 409 });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("accepts the exact profile budget and rejects one extra character", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse(200, { traits: {} }));
    const block = personaBlock({ traits: {} }, new Date().toISOString());
    const owner = "x".repeat(USER_PROFILE_CHAR_LIMIT - block.length - 3);
    vi.mocked(readFile).mockResolvedValue(owner);
    await syncOnairos(fakeSupabase(), "user-1", handoff);
    const written = vi.mocked(writeFile).mock.calls.find((call) => call[1] === USER_PROFILE_PATH)?.[2];
    expect((written as string).length).toBe(USER_PROFILE_CHAR_LIMIT);
    vi.mocked(writeFile).mockClear();
    vi.mocked(readFile).mockResolvedValue(owner + "x");
    await expect(syncOnairos(fakeSupabase(), "user-1", handoff)).rejects.toMatchObject({ status: 409 });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each(["I like tea.\n", null])("preserves existing owner text or initializes a typed 404: %s", async (profile) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { traits: {} }));
    if (profile === null) vi.mocked(readFile).mockRejectedValue(new BoxApiError(404, "missing"));
    else vi.mocked(readFile).mockResolvedValue(profile);
    await syncOnairos(fakeSupabase(), "user-1", handoff);
    const written = vi.mocked(writeFile).mock.calls.find((call) => call[1] === USER_PROFILE_PATH)?.[2];
    expect(typeof written).toBe("string");
    expect((written as string).length).toBeLessThanOrEqual(USER_PROFILE_CHAR_LIMIT);
    if (profile) expect(written).toContain(profile.trim());
    expect(deepMemoryIndex).toHaveBeenCalledOnce();
  });
  const grantJson = JSON.stringify({
    token: "tok",
    apiUrl: "https://api2.onairos.uk/traits-only",
  });

  it("serves a fresh cache without an upstream request", async () => {
    const syncedAt = new Date(Date.now() - 60_000).toISOString();
    vi.mocked(readFile).mockResolvedValue(cachedJson(syncedAt));
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await resyncOnairos(fakeSupabase(), "user-1");
    expect(result).toEqual({ syncedAt, fromCache: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refetches when the cache is older than the TTL", async () => {
    const syncedAt = new Date(
      Date.now() - PERSONA_CACHE_TTL_MS - 60_000
    ).toISOString();
    vi.mocked(readFile).mockImplementation(async (_boxId, path) => {
      if (path.endsWith("onairos.json")) return cachedJson(syncedAt);
      if (path.endsWith(".onairos-grant.json")) return grantJson;
      return "";
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, { traits: {} }));
    const result = await resyncOnairos(fakeSupabase(), "user-1");
    expect(fetchMock).toHaveBeenCalled();
    expect(result.fromCache).toBeUndefined();
  });

  it("falls back to the stale cache when the grant has expired", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const syncedAt = new Date(
      Date.now() - PERSONA_CACHE_TTL_MS - 60_000
    ).toISOString();
    vi.mocked(readFile).mockImplementation(async (_boxId, path) => {
      if (path.endsWith("onairos.json")) return cachedJson(syncedAt);
      if (path.endsWith(".onairos-grant.json")) return grantJson;
      return "";
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(401, { error: "JWT_INVALID" })
    );
    const result = await resyncOnairos(fakeSupabase(), "user-1");
    expect(result).toEqual({ syncedAt, fromCache: true });
  });

  it("409s on an expired grant when there is no cache at all", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(readFile).mockImplementation(async (_boxId, path) => {
      if (path.endsWith(".onairos-grant.json")) return grantJson;
      throw new Error("not found");
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(401, { error: "JWT_INVALID" })
    );
    await expect(resyncOnairos(fakeSupabase(), "user-1")).rejects.toThrow(
      "grant expired — reconnect Onairos"
    );
  });
});
