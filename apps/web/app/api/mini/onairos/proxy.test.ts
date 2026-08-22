import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./[...path]/route";

function makeRequest(
  url: string,
  init?: RequestInit & { method?: string }
): NextRequest {
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

const params = (...path: string[]) => ({
  params: Promise.resolve({ path }),
});

describe("onairos same-origin relay", () => {
  const fetchMock = vi.fn();

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

  it("forwards POSTs to the fixed Onairos host with SDK headers only", async () => {
    const request = makeRequest(
      "https://mini.wzrd.tech/api/mini/onairos/dev/validate-apikey",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": "dev-key-123",
          cookie: "mini_session=secret",
        },
        body: JSON.stringify({ ping: 1 }),
      }
    );
    const response = await POST(request, params("dev", "validate-apikey"));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://api2.onairos.uk/dev/validate-apikey");
    const sent = init.headers as Headers;
    expect(sent.get("x-api-key")).toBe("dev-key-123");
    expect(sent.get("cookie")).toBeNull();
  });

  it("relays query strings and passes upstream status through", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("pending", {
        status: 202,
        headers: { "content-type": "text/plain" },
      })
    );
    const response = await GET(
      makeRequest("https://mini.wzrd.tech/api/mini/onairos/persona?full=1"),
      params("persona")
    );
    expect(response.status).toBe(202);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toBe("https://api2.onairos.uk/persona?full=1");
  });

  it("never relays upstream cookies and disables caching", async () => {
    const response = await GET(
      makeRequest("https://mini.wzrd.tech/api/mini/onairos/health"),
      params("health")
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 502 when the upstream is unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connect failed"));
    const response = await GET(
      makeRequest("https://mini.wzrd.tech/api/mini/onairos/health"),
      params("health")
    );
    expect(response.status).toBe(502);
  });
});
