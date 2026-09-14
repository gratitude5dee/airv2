/**
 * Shared-bridge behavior: the restricted completion uses the user's own
 * gateway token (no provider key path), returns null on every failure so the
 * caller falls back to the static holding line, and the carry marker frames
 * the bridge reply as the agent's own prior turn.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BRIDGE_MESSAGE_ID_PREFIX,
  BRIDGE_SYSTEM_PROMPT,
  bridgeCarryMarker,
  initialReply,
  initialResponse,
  isBridgeMarkerId,
  progressUpdateReply,
  sharedBridgeReply,
} from "./sharedBridge";

vi.mock("../env", () => ({
  env: { appOrigin: () => "https://app.example.test" },
}));

function fakeSupabase(token: string | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: token ? { gateway_token: token } : null,
              error: null,
            }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sharedBridgeReply", () => {
  it("returns the gateway reply on success, authed with the box token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "  On it — one moment.  " } }],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const reply = await sharedBridgeReply(
      fakeSupabase("gw-token"),
      "user-1",
      "book me a flight"
    );
    expect(reply).toBe("On it — one moment.");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://app.example.test/api/gateway/v1/chat/completions");
    expect(init.headers["Authorization"]).toBe("Bearer gw-token");
    const body = JSON.parse(init.body as string);
    expect(body.messages[0].content).toBe(BRIDGE_SYSTEM_PROMPT);
    expect(body.messages[1].content).toBe("book me a flight");
  });

  it("returns null for an empty burst without touching the gateway", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sharedBridgeReply(fakeSupabase("t"), "user-1", "  ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the user has no gateway token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sharedBridgeReply(fakeSupabase(null), "user-1", "hi")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null on a non-ok gateway response (e.g. spend cap 429)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 })
    );
    expect(await sharedBridgeReply(fakeSupabase("t"), "user-1", "hi")).toBeNull();
  });

  it("returns null when the gateway call throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await sharedBridgeReply(fakeSupabase("t"), "user-1", "hi")).toBeNull();
  });

  it("returns null on an empty completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: "" } }] }),
      })
    );
    expect(await sharedBridgeReply(fakeSupabase("t"), "user-1", "hi")).toBeNull();
  });
});

describe("first response and progress lanes", () => {
  it("answers basic arithmetic deterministically when the fast gateway is unavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("gateway unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await initialResponse(fakeSupabase("t"), "user-1", "what is 9 × 7?")).toEqual({
      body: "63",
      disposition: "final",
      source: "arithmetic",
    });
    expect(await initialReply(fakeSupabase("t"), "user-1", "what is 9 × 7?")).toBe("63");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the fast gateway lane for a simple first reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "42" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await initialReply(fakeSupabase("t"), "user-1", "what is 6 times 7?")).toBe("42");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string).model).toBe("fast");
  });

  it("marks a structured GMI answer final so Hermes can be skipped", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "FINAL: Paris" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await initialResponse(fakeSupabase("t"), "user-1", "capital of France?")).toEqual({
      body: "Paris",
      disposition: "final",
      source: "gmi",
    });
  });

  it("never lets a history-free fast completion consume a status follow-up", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: "FINAL: I don't have context." } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await initialResponse(fakeSupabase("t"), "user-1", "Any update?")).toEqual({
      body: "I’m checking the current task now.",
      disposition: "holding",
      source: "fallback",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("finishes a standalone acknowledgement without waking Hermes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await initialResponse(fakeSupabase("t"), "user-1", "Ok let me know")).toEqual({
      body: "Will do.",
      disposition: "final",
      source: "acknowledgement",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps private-context requests on the full agent path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "HOLD: I’m checking." } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await initialResponse(fakeSupabase("t"), "user-1", "summarize my inbox")).toMatchObject({
      body: "Got it — checking now.",
      disposition: "holding",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses an immediate static line for tool-dependent first replies", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await initialReply(fakeSupabase("t"), "user-1", "find deals for Portola Fest"))
      .toContain("options");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds a GLM progress update through the same fast gateway route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "Checking the details now." } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await progressUpdateReply(fakeSupabase("t"), "user-1", "find deals", "progress-one"))
      .toBe("Checking the details now.");
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe("fast");
    expect(body.max_tokens).toBe(32);
  });
});

describe("bridgeCarryMarker", () => {
  it("frames the bridge reply as the agent's own prior turn", () => {
    const marker = bridgeCarryMarker("Sure — checking now.");
    expect(marker).toContain('"Sure — checking now."');
    expect(marker).toContain("don't repeat it");
  });
});

describe("isBridgeMarkerId", () => {
  it("distinguishes synthetic marker rows from real iMessage ids", () => {
    expect(isBridgeMarkerId(`${BRIDGE_MESSAGE_ID_PREFIX}1734567890`)).toBe(true);
    expect(isBridgeMarkerId("p:0/ABCDEF-1234")).toBe(false);
  });
});
