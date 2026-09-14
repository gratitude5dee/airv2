import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const handoff = vi.hoisted(() => vi.fn());
const consume = vi.hoisted(() => vi.fn());
const verify = vi.hoisted(() => vi.fn());
const mint = vi.hoisted(() => vi.fn());

vi.mock("@/lib/checkout/handoffs", () => ({ getCheckoutHandoff: handoff }));
vi.mock("@/lib/miniapps/tokens", () => ({
  verifyToken: verify,
  consumeRedemptionOnce: consume,
  mintToken: mint,
}));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));

import { GET, POST } from "./route";

function post(token?: string): NextRequest {
  return new NextRequest("https://mini.example/api/mini/checkout-launch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(token === undefined ? {} : { token }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  verify.mockReturnValue({ userId: "owner-1", resourceId: "123e4567-e89b-12d3-a456-426614174000", app: "checkout", jti: "one", exp: 9999999999 });
  handoff.mockResolvedValue({ id: "123e4567-e89b-12d3-a456-426614174000" });
  consume.mockResolvedValue(true);
  mint.mockReturnValue("session-token");
});

describe("checkout browser launch", () => {
  it("serves a token-free shell that reads only a URL fragment", async () => {
    const response = await GET();
    const html = await response.text();
    expect(html).toContain('src="/creator-os/checkout-launch.js"');
    expect(html).not.toContain("?t=");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("exchanges one valid capability for a scoped HttpOnly browser session", async () => {
    const response = await POST(post("capability"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, next: "/checkout" });
    expect(handoff).toHaveBeenCalledWith({}, "owner-1", "123e4567-e89b-12d3-a456-426614174000");
    expect(consume).toHaveBeenCalledTimes(1);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Path=/checkout");
  });

  it("rejects invalid and replayed browser capabilities without a session", async () => {
    verify.mockReturnValueOnce(null);
    expect((await POST(post("bad"))).status).toBe(403);
    consume.mockResolvedValueOnce(false);
    const replay = await POST(post("replayed"));
    expect(replay.status).toBe(409);
    expect(replay.headers.get("set-cookie")).toBeNull();
  });
});
