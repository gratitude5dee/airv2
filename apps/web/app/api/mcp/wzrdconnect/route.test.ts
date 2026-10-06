/**
 * R-CONN-01: the per-box WZRD Connect MCP proxy contract — box gateway
 * token in, user's runtime token out upstream; connection-less tools/call
 * arguments get the deterministic alias injected server-side so a box can
 * never omit (or guess) another user's connection name; an explicit
 * connectionName is left for the token's allowedConnections check to
 * judge.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireBox = vi.fn(
  async () => ({ kind: "box" as const, userId: "user-1", boxId: "box-1" })
);
vi.mock("@/lib/auth/guard", () => ({
  requireBox: (...args: unknown[]) => requireBox(...(args as [])),
  guardResponse: (error: unknown) =>
    NextResponse.json({ error: String(error) }, { status: 401 }),
}));

const ensureWzrdConnectToken = vi.fn(
  async () => ({ token: "oct_user1", tokenId: "tok-1" })
);
vi.mock("@/lib/wzrdconnect/tokens", () => ({
  ensureWzrdConnectToken: (...args: unknown[]) =>
    ensureWzrdConnectToken(...(args as [])),
}));

vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { POST } from "./route";
import { expectLog } from "@/lib/testing/expectLog";

function upstreamResponse(status = 200): Response {
  return new Response("upstream-body", {
    status,
    headers: { "content-type": "application/json" },
  });
}

function rpcBody(args: Record<string, unknown>): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "execute_action", arguments: args },
  });
}

const lastUpstream = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
};

function request(body: string): NextRequest {
  return new NextRequest("https://air.test/api/mcp/wzrdconnect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.stubEnv("WZRD_CONNECT_ORIGIN", "https://connector.wzrd.tech");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(upstreamResponse());
  requireBox.mockClear();
  ensureWzrdConnectToken.mockClear();
});

describe("POST /api/mcp/wzrdconnect", () => {
  it("forwards with the user's runtime token, not the box key", async () => {
    await POST(request("{}"));
    const { url, headers } = lastUpstream();
    expect(url).toBe("https://connector.wzrd.tech/mcp");
    expect(headers.get("authorization")).toBe("Bearer oct_user1");
  });

  it("injects the user's alias into a connection-less execute_action", async () => {
    await POST(request(rpcBody({ actionId: "gmail.send" })));
    const sent = JSON.parse(lastUpstream().init.body as string);
    expect(sent.params.arguments).toEqual({
      actionId: "gmail.send",
      connectionName: "air-user-1",
    });
  });

  it("leaves an explicit connectionName for the token policy to judge", async () => {
    await POST(
      request(rpcBody({ connectionName: "air-other-user", actionId: "x" }))
    );
    const sent = JSON.parse(lastUpstream().init.body as string);
    expect(sent.params.arguments.connectionName).toBe("air-other-user");
  });

  it("does not touch non-tools/call methods or non-JSON bodies", async () => {
    await POST(request("not json at all"));
    expect(lastUpstream().init.body).toBe("not json at all");
    const initBody = JSON.stringify({
      method: "tools/list",
      params: {},
    });
    await POST(request(initBody));
    expect(lastUpstream().init.body).toBe(initBody);
  });

  it("502s when the runtime token cannot be resolved", async () => {
    ensureWzrdConnectToken.mockRejectedValueOnce(new Error("worker down"));
    const response = await POST(request("{}"));
    expect(response.status).toBe(502);
    expectLog(/token resolve failed/, { level: "error" });
  });

  it("401s when the box credential fails", async () => {
    requireBox.mockRejectedValueOnce(new Error("bad token"));
    const response = await POST(request("{}"));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
