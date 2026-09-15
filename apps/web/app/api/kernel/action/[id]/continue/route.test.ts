import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const redeem = vi.hoisted(() => vi.fn());
const verify = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kernel/actions", () => ({ redeemKernelAction: redeem }));
vi.mock("@/lib/miniapps/tokens", () => ({ verifyToken: verify }));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/miniapps/html", () => ({
  baseHeaders: () => ({ "Cache-Control": "no-store" }),
}));

import { GET } from "./route";

const id = "123e4567-e89b-12d3-a456-426614174000";
const url = `https://mini.example/api/kernel/action/${id}/continue`;
const context = { params: Promise.resolve({ id }) };

beforeEach(() => {
  vi.clearAllMocks();
  verify.mockReturnValue({ userId: "owner-1", resourceId: id, role: "owner" });
  redeem.mockResolvedValue({ url: "https://provider.example/ceremony?secret=x" });
});

describe("Kernel action continuation", () => {
  it("redeems server-side and redirects without serializing the bearer URL", async () => {
    const response = await GET(
      new NextRequest(url, {
        headers: { cookie: "air_kernel_action=session" },
      }),
      context
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://provider.example/ceremony?secret=x"
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects a cookie not bound to the owner and action", async () => {
    verify.mockReturnValueOnce(null);
    const response = await GET(
      new NextRequest(url, {
        headers: { cookie: "air_kernel_action=bad" },
      }),
      context
    );
    expect(response.status).toBe(403);
    expect(redeem).not.toHaveBeenCalled();
  });
});
