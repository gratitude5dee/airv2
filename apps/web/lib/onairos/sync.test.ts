import { afterEach, describe, expect, it, vi } from "vitest";
import { OnairosError } from "./context";
import { fetchPersona, personaUrl } from "./sync";

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
