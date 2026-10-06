/**
 * R-CONN-01: the control-plane client's wire contract — /v1 endpoints
 * unwrap { success, data } envelopes, /api admin endpoints return payloads
 * raw, errors surface as WzrdConnectApiError carrying the worker's
 * error.code/message, and the admin bearer is the default credential while
 * per-user calls override it with their runtime token.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  createOAuthRequest,
  disconnectConnection,
  executeAction,
  getConnectionRequest,
  listConnections,
  listRuntimeTokens,
  WzrdConnectApiError,
} from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
};

beforeEach(() => {
  vi.stubEnv("WZRD_CONNECT_ORIGIN", "https://connector.wzrd.tech");
  vi.stubEnv("WZRD_CONNECT_ADMIN_TOKEN", "admin-token-1");
  fetchMock.mockReset();
});

describe("wzrdFetch envelope handling", () => {
  it("unwraps the { success, data } envelope /v1 endpoints return", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, data: [{ id: "conn-1" }] })
    );
    expect(await listConnections()).toEqual([{ id: "conn-1" }]);
  });

  it("returns raw /api payloads without an envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [{ id: "tok-1", allowedConnections: ["app-1"] }])
    );
    expect(await listRuntimeTokens()).toEqual([
      { id: "tok-1", allowedConnections: ["app-1"] },
    ]);
  });
});

describe("credential selection", () => {
  it("sends the admin bearer on control-plane calls", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    await listConnections();
    expect(lastCall().headers.get("authorization")).toBe(
      "Bearer admin-token-1"
    );
    expect(lastCall().url).toBe(
      "https://connector.wzrd.tech/api/connections"
    );
  });

  it("sends the per-user runtime token on executeAction", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, data: { ok: true } })
    );
    await executeAction({
      token: "oct_user1",
      actionId: "instagram.publish_media",
      input: { caption: "hi" },
      connectionName: "air-user-1",
    });
    const { url, init, headers } = lastCall();
    expect(url).toBe(
      "https://connector.wzrd.tech/v1/actions/instagram.publish_media"
    );
    expect(headers.get("authorization")).toBe("Bearer oct_user1");
    expect(JSON.parse(init.body as string)).toEqual({
      input: { caption: "hi" },
      connectionName: "air-user-1",
    });
  });
});

describe("error mapping", () => {
  it("carries the worker's error.code and message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, {
        error: { code: "connection_request_not_found", message: "gone" },
      })
    );
    const error = await getConnectionRequest("cr-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WzrdConnectApiError);
    expect((error as WzrdConnectApiError).status).toBe(404);
    expect((error as WzrdConnectApiError).code).toBe(
      "connection_request_not_found"
    );
    expect((error as WzrdConnectApiError).message).toContain("gone");
  });

  it("falls back to statusText when the body carries no error record", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(502, null));
    await expect(getConnectionRequest("cr-1")).rejects.toBeInstanceOf(
      WzrdConnectApiError
    );
  });
});

describe("request shapes", () => {
  it("POSTs connection-requests with service + deterministic alias", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        authorizationUrl: "https://accounts.google.com/o/oauth2/xyz",
        connectionRequestId: "cr-1",
        status: "initiated",
        expiresAt: "2026-10-05T23:00:00Z",
      })
    );
    await createOAuthRequest({
      service: "gmail",
      connectionName: "air-user-1",
    });
    const { init } = lastCall();
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      service: "gmail",
      connectionName: "air-user-1",
    });
  });

  it("DELETEs connections with revoke by alias", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await disconnectConnection({
      service: "gmail",
      connectionName: "air-user-1",
    });
    const { url, init } = lastCall();
    expect(url).toBe("https://connector.wzrd.tech/api/connections/gmail");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({
      connectionName: "air-user-1",
      revoke: true,
    });
  });
});
