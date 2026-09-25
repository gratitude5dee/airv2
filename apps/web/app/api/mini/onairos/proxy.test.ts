import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./[...path]/route";
import { mintToken } from "@/lib/miniapps/tokens";

function makeRequest(
  url: string,
  init?: RequestInit & { method?: string }
): NextRequest {
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

const params = (...path: string[]) => ({
  params: Promise.resolve({ path }),
});

/** A fresh C15-scoped token for the onboarding app (the relay's auth). */
function token(): string {
  return mintToken("user-1", "onboarding", "res-1", 15);
}

function authed(
  url: string,
  init?: RequestInit & { method?: string }
): NextRequest {
  const sep = url.includes("?") ? "&" : "?";
  return makeRequest(`${url}${sep}t=${token()}`, init);
}

describe("onairos same-origin relay", () => {
  const fetchMock = vi.fn();

  beforeAll(() => {
    process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "upstream=1",
        },
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("rejects unauthenticated calls", async () => {
    const response = await POST(
      makeRequest("https://mini.wzrd.tech/api/mini/onairos/dev/validate-apikey", {
        method: "POST",
      }),
      params("dev", "validate-apikey")
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a token minted for another app", async () => {
    const foreign = mintToken("user-1", "kanban", "res-1", 15);
    const response = await GET(
      makeRequest(
        `https://mini.wzrd.tech/api/mini/onairos/persona?t=${foreign}`
      ),
      params("persona")
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404s paths the SDK never calls", async () => {
    const response = await GET(
      authed("https://mini.wzrd.tech/api/mini/onairos/admin/users"),
      params("admin", "users")
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the onboarding API cookie as the mini-app session", async () => {
    const request = makeRequest(
      "https://mini.wzrd.tech/api/mini/onairos/persona",
      {
        headers: { cookie: `mini_api_onboarding=${token()}` },
      }
    );
    const response = await GET(request, params("persona"));
    expect(response.status).toBe(200);
  });

  it("forwards POSTs to the fixed Onairos host with SDK headers only", async () => {
    const request = authed(
      "https://mini.wzrd.tech/api/mini/onairos/dev/validate-apikey",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "dev-key-123",
          origin: "https://evil.example",
          referer: "https://evil.example/",
          cookie: "mini_session=secret",
        },
        body: JSON.stringify({ ping: 1 }),
      }
    );
    const response = await POST(request, params("dev", "validate-apikey"));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    // The ?t= auth token never reaches the upstream query string.
    expect(url.toString()).toBe(
      "https://api2.onairos.uk/dev/validate-apikey"
    );
    expect(url.searchParams.has("t")).toBe(false);
    const sent = init.headers as Headers;
    expect(sent.get("x-api-key")).toBe("dev-key-123");
    // R-SEC-06: caller origin/referer are replaced by the request's real
    // host — the upstream sees our origin, not an attacker-claimed one.
    expect(sent.get("origin")).toBe("https://mini.wzrd.tech");
    expect(sent.get("referer")).toBe("https://mini.wzrd.tech/");
    expect(sent.get("cookie")).toBeNull();
  });

  it("relays query strings, drops the auth token, passes upstream status", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("pending", {
        status: 202,
        headers: { "content-type": "text/plain" },
      })
    );
    const response = await GET(
      authed("https://mini.wzrd.tech/api/mini/onairos/persona?full=1"),
      params("persona")
    );
    expect(response.status).toBe(202);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toBe("https://api2.onairos.uk/persona?full=1");
  });

  it("never relays upstream cookies and disables caching", async () => {
    const response = await GET(
      authed("https://mini.wzrd.tech/api/mini/onairos/session"),
      params("session")
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 502 when the upstream is unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connect failed"));
    const response = await GET(
      authed("https://mini.wzrd.tech/api/mini/onairos/session"),
      params("session")
    );
    expect(response.status).toBe(502);
  });
});
