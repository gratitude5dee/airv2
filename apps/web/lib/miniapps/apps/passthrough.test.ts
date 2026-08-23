/**
 * Passthrough (?view=live) behavior: an up machine 302s to a fresh stream
 * URL (never in HTML), a waking machine gets a self-refreshing progress
 * page instead of a blocked request or an error, and guests are refused.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { renderPassthrough } from "./passthrough";
import { desktopStreamUrlIfUp } from "@/lib/box/desktop";
import type { MiniAppContext } from "./types";

vi.mock("@/lib/box/desktop", () => ({
  desktopStreamUrlIfUp: vi.fn(),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));

function ctx(role = "owner"): MiniAppContext {
  return {
    request: new NextRequest(
      new URL("/computer?view=live", "https://mini.wzrd.tech")
    ),
    supabase: {},
    app: { slug: "computer" },
    session: { role, userId: "user-1", via: "card" },
    basePath: "/computer",
  } as unknown as MiniAppContext;
}

describe("renderPassthrough", () => {
  it("redirects to the stream when the machine is up", async () => {
    vi.mocked(desktopStreamUrlIfUp).mockResolvedValue({
      status: "up",
      url: "https://d.on.ascii.dev/stream.html?token=abc",
    });
    const res = await renderPassthrough(ctx());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://d.on.ascii.dev/stream.html?token=abc"
    );
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("renders a self-refreshing waking page while the machine boots", async () => {
    vi.mocked(desktopStreamUrlIfUp).mockResolvedValue({ status: "waking" });
    const res = await renderPassthrough(ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("refresh")).toBe("5");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("Waking your agent");
  });

  it("refuses guests", async () => {
    const res = await renderPassthrough(ctx("guest"));
    expect(res.status).toBe(403);
  });
});
