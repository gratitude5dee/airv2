import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const consume = vi.hoisted(() => vi.fn());
const mint = vi.hoisted(() => vi.fn());
const verify = vi.hoisted(() => vi.fn());

vi.mock("@/lib/miniapps/tokens", () => ({
  consumeRedemptionOnce: consume,
  mintToken: mint,
  verifyToken: verify,
}));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/miniapps/html", () => ({
  baseHeaders: () => ({ "Cache-Control": "no-store" }),
  page: (_title: string, body: string) => body,
}));

import { GET, POST } from "./route";

const id = "123e4567-e89b-12d3-a456-426614174000";
const context = { params: Promise.resolve({ id }) };

beforeEach(() => {
  vi.clearAllMocks();
  verify.mockReturnValue({
    userId: "owner-1",
    resourceId: id,
    role: "owner",
    jti: "once",
    exp: 9999999999,
  });
  consume.mockResolvedValue(true);
  mint.mockReturnValue("cookie-session");
});

describe("Kernel action presenter", () => {
  it("serves a token-free shell", async () => {
    const response = await GET(
      new NextRequest(`https://mini.example/api/kernel/action/${id}`),
      context
    );
    expect(await response.text()).toContain("kernel-action.js");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("exchanges the owner capability for a scoped HttpOnly session", async () => {
    const request = new NextRequest(`https://mini.example/api/kernel/action/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "fragment-capability" }),
    });
    const response = await POST(request, context);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      next: `/api/kernel/action/${id}/continue`,
    });
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain(
      `Path=/api/kernel/action/${id}/continue`
    );
    expect(mint).toHaveBeenCalledWith(
      "owner-1",
      "kernel-action-session",
      id,
      1,
      { role: "owner" }
    );
  });

  it("rejects non-owner and replayed capabilities", async () => {
    verify.mockReturnValueOnce({
      userId: "guest-1",
      resourceId: id,
      role: "guest",
    });
    const guest = new NextRequest(`https://mini.example/api/kernel/action/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "guest" }),
    });
    expect((await POST(guest, context)).status).toBe(403);

    consume.mockResolvedValueOnce(false);
    const replay = new NextRequest(`https://mini.example/api/kernel/action/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "replay" }),
    });
    expect((await POST(replay, context)).status).toBe(409);
  });
});
