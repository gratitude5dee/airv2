import { afterEach, describe, expect, it, vi } from "vitest";
import { isOnairosTrigger, relayToOnairos } from "./spectrum";
import { OnairosError } from "./context";

const INPUT = {
  sessionId: "space-1",
  senderId: "+15551234567",
  phone: "+15550001111",
  text: "Connect Onairos",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("isOnairosTrigger", () => {
  it("matches connect-onairos phrasings", () => {
    expect(isOnairosTrigger("Connect Onairos")).toBe(true);
    expect(isOnairosTrigger("please connect my onairos account")).toBe(true);
    expect(isOnairosTrigger("can you get onairos connected")).toBe(true);
  });

  it("does not match unrelated messages", () => {
    expect(isOnairosTrigger("connect my calendar")).toBe(false);
    expect(isOnairosTrigger("what is onairos?")).toBe(false);
    expect(isOnairosTrigger("hello")).toBe(false);
  });
});

describe("relayToOnairos", () => {
  it("503s when the API key is not configured", async () => {
    vi.stubEnv("ONAIROS_API_KEY", "");
    delete process.env["ONAIROS_API_KEY"];
    await expect(relayToOnairos(INPUT)).rejects.toMatchObject({ status: 503 });
  });

  it("posts the skill-shaped body and parses reply + routing flag", async () => {
    vi.stubEnv("ONAIROS_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        success: true,
        action: "connect_account",
        reply: "What email is on your Onairos account?",
        onairos: { flowActive: true, shouldRouteNextMessage: true },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await relayToOnairos(INPUT);

    expect(result.reply).toBe("What email is on your Onairos account?");
    expect(result.shouldRouteNextMessage).toBe(true);
    expect(result.grants).toEqual([]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://api2.onairos.uk/integrations/spectrum/text/command",
    );
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(
      "test-key",
    );
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent["sessionId"]).toBe("space-1");
    expect(sent["channel"]).toBe("iMessage");
    expect(sent["user"]).toEqual({ id: "+15551234567", phone: "+15550001111" });
    expect(sent["message"]).toEqual({ text: "Connect Onairos" });
  });

  it("returns grants from the authorize response", async () => {
    vi.stubEnv("ONAIROS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          action: "authorize",
          reply: "Authorized.",
          grants: [{ grantId: "pta_abc123", status: "active" }, { bad: 1 }],
        }),
      ),
    );

    const result = await relayToOnairos(INPUT);

    expect(result.grants).toEqual([
      { grantId: "pta_abc123", status: "active" },
    ]);
    expect(result.shouldRouteNextMessage).toBe(false);
  });

  it("wraps upstream errors without leaking the body", async () => {
    vi.stubEnv("ONAIROS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ secret: "x" }, 500)),
    );

    await expect(relayToOnairos(INPUT)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof OnairosError &&
        error.status === 502 &&
        !error.message.includes("secret"),
    );
  });
});
