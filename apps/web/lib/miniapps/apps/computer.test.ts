/**
 * Computer mini-app live-embed behavior: an awake box embeds the same-origin
 * ?view=live iframe (with the frame-src allowance for the desktop host), a
 * stopped box shows the Watch-live button instead (looking never wakes it),
 * and ?embed=1 opts a stopped box into the embed explicitly.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { computer } from "./computer";
import { captureScreenshotPng } from "@/lib/box/screenshot";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import type { MiniAppContext } from "./types";

vi.mock("@/lib/box/screenshot", () => ({
  captureScreenshotPng: vi.fn().mockRejectedValue(new Error("no shot")),
}));
vi.mock("@/lib/box/desktop", () => ({
  desktopStreamUrlIfUp: vi.fn(),
}));

function ctxFor(boxState: string | null, url: string): MiniAppContext {
  const db = new FakeSupabase();
  if (boxState) {
    db.tables["boxes"] = [
      { user_id: "user-1", provider_box_id: "bx_test", state: boxState },
    ];
  }
  return {
    request: new NextRequest(new URL(url, "https://mini.wzrd.tech")),
    supabase: db.client(),
    app: { slug: "computer" },
    session: { role: "owner", userId: "user-1", via: "card" },
    basePath: "/computer",
  } as unknown as MiniAppContext;
}

describe("computer mini-app live embed", () => {
  it("embeds the live iframe when the box is awake", async () => {
    const res = await computer.render(ctxFor("ready", "/computer"));
    const html = await res.text();
    expect(html).toContain('src="/computer?view=live"');
    expect(html).toContain(">Connecting</span>");
    expect(html).not.toContain(">Live</span>");
    expect(html).not.toContain("data-stream-origin");
    expect(html).not.toContain("?embed=1");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-src 'self' https://*.on.ascii.dev");
    // The embedded viewer needs autoplay (video won't start in an iframe
    // without it). Rendering the shell no longer mints a second desktop URL.
    expect(html).toContain('allow="autoplay; fullscreen');
    expect(html).not.toContain("computer.js");
    expect(html).toContain("View latest screenshot");
  });

  it("offers a genuine, non-interactive screenshot only on an explicit owner request", async () => {
    vi.mocked(captureScreenshotPng).mockResolvedValueOnce(Buffer.from("png"));
    const res = await computer.render(ctxFor("ready", "/computer?snapshot=1"));
    const html = await res.text();
    expect(html).not.toContain("<iframe");
    expect(html).toContain('src="data:image/png;base64,cG5n"');
    expect(html).toContain("Snapshot captured just now — not interactive.");
    expect(res.headers.get("Content-Security-Policy")).not.toContain("frame-src");
  });

  it("offers Watch live without embedding when the box is stopped", async () => {
    const res = await computer.render(ctxFor("stopped", "/computer"));
    const html = await res.text();
    expect(html).not.toContain("<iframe");
    expect(html).toContain("?embed=1");
    expect(res.headers.get("Content-Security-Policy")).not.toContain(
      "frame-src"
    );
  });

  it("embeds on explicit ?embed=1 even when stopped", async () => {
    const res = await computer.render(ctxFor("stopped", "/computer?embed=1"));
    const html = await res.text();
    expect(html).toContain('src="/computer?view=live"');
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-src");
  });

  it("keeps the live view owner-only", async () => {
    const ctx = ctxFor("ready", "/computer");
    (ctx.session as { role: string }).role = "guest";
    const res = await computer.render(ctx);
    expect(res.status).toBe(403);
  });
});
