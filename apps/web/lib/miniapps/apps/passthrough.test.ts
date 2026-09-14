/**
 * Passthrough (?view=live) behavior: an up machine 302s to a fresh stream
 * URL (never in HTML), a waking machine gets a self-refreshing progress
 * page instead of a blocked request or an error, and guests are refused.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { renderPassthrough } from "./passthrough";
import { desktopStreamUrlIfUp } from "@/lib/box/desktop";
import type { MiniAppContext } from "./types";

vi.mock("@/lib/box/desktop", () => ({
  desktopStreamUrlIfUp: vi.fn(),
  desktopStreamOrigin: vi.fn(async () => null),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));

const priorSigningKey = process.env["MINIAPP_SIGNING_KEY"];
beforeAll(() => {
  process.env["MINIAPP_SIGNING_KEY"] = "passthrough-test-signing-key";
});
afterAll(() => {
  if (priorSigningKey === undefined) delete process.env["MINIAPP_SIGNING_KEY"];
  else process.env["MINIAPP_SIGNING_KEY"] = priorSigningKey;
});

function ctx(
  role = "owner",
  url = "/computer?view=live",
  cookie?: string
): MiniAppContext {
  return {
    request: new NextRequest(
      new URL(url, "https://mini.wzrd.tech"),
      cookie ? { headers: { cookie } } : undefined
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
    expect(res.headers.get("refresh")).toBe("1; url=/computer?view=live&retry=1");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("set-cookie")).toContain("mini_desktop_attempt=");
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    const html = await res.text();
    expect(html).toContain("Waking your agent");
  });

  it("shows the try-again page on a provider start limit", async () => {
    const { StartLimitError } = await import("@/lib/orchestrator/boxes");
    vi.mocked(desktopStreamUrlIfUp).mockRejectedValue(new StartLimitError());
    const res = await renderPassthrough(ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("refresh")).toBeNull();
    const html = await res.text();
    expect(html).toContain("try again in a few minutes");
    expect(html).toContain("Retry now");
  });

  it("keeps an explicit retry control for an unexpected provider failure", async () => {
    vi.mocked(desktopStreamUrlIfUp).mockRejectedValue(new Error("network timeout"));
    const res = await renderPassthrough(ctx());
    const html = await res.text();
    expect(html).toContain("Couldn't prepare your agent's computer right now");
    expect(html).toContain('href="/computer?view=live&amp;restart=1"');
  });

  it("renders a bounded recovery page while the desktop daemon prepares", async () => {
    vi.mocked(desktopStreamUrlIfUp).mockResolvedValue({ status: "preparing" });
    const res = await renderPassthrough(ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("refresh")).toBe("1; url=/computer?view=live&retry=1");
    expect(res.headers.get("retry-after")).toBe("1");
    const html = await res.text();
    expect(html).toContain("Preparing your agent's screen");
    expect(html).toContain("Try VNC");
    expect(html).toContain("Retry now");
  });

  it("stops automatic retries after the readiness budget", async () => {
    vi.mocked(desktopStreamUrlIfUp).mockResolvedValue({ status: "preparing" });
    const res = await renderPassthrough(ctx("owner", "/computer?view=live&retry=6"));
    expect(res.headers.get("refresh")).toBeNull();
    expect(res.headers.get("retry-after")).toBeNull();
    expect(await res.text()).toContain("Automatic retries stopped after about 30 seconds");
  });

  it("keeps a manual retry available after a slow wake", async () => {
    vi.mocked(desktopStreamUrlIfUp).mockResolvedValue({ status: "waking" });
    const res = await renderPassthrough(ctx("owner", "/computer?view=live&retry=6"));
    expect(res.headers.get("refresh")).toBeNull();
    const html = await res.text();
    expect(html).toContain("Retry now");
    expect(html).toContain("restart=1");
  });

  it("does not let a URL refresh reset an expired readiness deadline", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-14T16:00:00Z"));
      vi.mocked(desktopStreamUrlIfUp).mockResolvedValue({ status: "preparing" });
      const first = await renderPassthrough(ctx());
      const cookie = first.headers.get("set-cookie")?.split(";", 1)[0];
      expect(cookie).toContain("mini_desktop_attempt=");

      vi.advanceTimersByTime(31_000);
      const refreshed = await renderPassthrough(
        ctx("owner", "/computer?view=live&retry=0", cookie)
      );

      expect(refreshed.headers.get("refresh")).toBeNull();
      expect(await refreshed.text()).toContain("Automatic retries stopped");
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses guests", async () => {
    const res = await renderPassthrough(ctx("guest"));
    expect(res.status).toBe(403);
  });
});
