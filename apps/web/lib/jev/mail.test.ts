import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyInboundMail,
  isSpamVerdict,
  MAIL_SPAM_MIN,
  MAIL_TRANSACTIONAL_VETO,
} from "./mail";

const fetchSpy = vi.fn();

function noulBody(spam: number, transactional: number, needsReply = 0.2) {
  return {
    answers: {
      spam: { type: "noul", noul: spam },
      transactional: { type: "noul", noul: transactional },
      needs_reply: { type: "noul", noul: needsReply },
    },
  };
}

afterEach(() => {
  fetchSpy.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("classifyInboundMail", () => {
  it("batches all three questions over trimmed metadata state", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "ts-key");
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(noulBody(0.9, 0.1)), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await classifyInboundMail({
      from: "spammer@bad.example",
      subject: "WINNER!!! " + "x".repeat(500),
      preview: "y".repeat(900),
    });

    expect(verdict).toEqual({ spam: 0.9, transactional: 0.1, needsReply: 0.2 });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body.questions)).toEqual([
      "spam",
      "transactional",
      "needs_reply",
    ]);
    expect(body.state.surface).toBe("air-mail");
    expect(body.state.subject.length).toBeLessThanOrEqual(200);
    expect(body.state.preview.length).toBeLessThanOrEqual(400);
  });

  it("reads the gateway's boolean answers via providerMetadata-free probability", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "gw-key");
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: {
            spam: { type: "boolean", probability: 0.85 },
            transactional: { type: "boolean", probability: 0.1 },
            needs_reply: { type: "boolean", probability: 0.0 },
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const verdict = await classifyInboundMail({ from: "a@b.co" });

    expect(verdict?.spam).toBe(0.85);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ai-gateway.vercel.sh/v4/ai/evaluation-model");
    const headers = init.headers as Record<string, string>;
    expect(headers["ai-model-id"]).toBe("typesafe-ai/jev");
    const body = JSON.parse(init.body as string);
    expect(body.questions.spam.type).toBe("boolean");
  });

  it("fails open to null when the service 500s twice", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "ts-key");
    fetchSpy.mockResolvedValue(new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);

    expect(await classifyInboundMail({ from: "a@b.co" })).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("fails open to null when no backend is configured", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubGlobal("fetch", fetchSpy);

    expect(await classifyInboundMail({ from: "a@b.co" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("isSpamVerdict", () => {
  it("labels at the spam threshold", () => {
    expect(
      isSpamVerdict({ spam: MAIL_SPAM_MIN, transactional: 0, needsReply: 0 })
    ).toBe(true);
    expect(isSpamVerdict({ spam: 0.79, transactional: 0, needsReply: 0 })).toBe(
      false
    );
  });

  it("the transactional veto rescues receipts", () => {
    expect(
      isSpamVerdict({
        spam: 0.95,
        transactional: MAIL_TRANSACTIONAL_VETO,
        needsReply: 0,
      })
    ).toBe(false);
  });
});
