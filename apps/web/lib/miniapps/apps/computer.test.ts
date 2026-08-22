/**
 * Computer mini-app live-embed behavior: an awake box embeds the same-origin
 * ?view=live iframe (with the frame-src allowance for the desktop host), a
 * stopped box shows the Watch-live button instead (looking never wakes it),
 * and ?embed=1 opts a stopped box into the embed explicitly.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { computer } from "./computer";
import type { MiniAppContext } from "./types";

vi.mock("@/lib/box/screenshot", () => ({
  captureScreenshotPng: vi.fn().mockRejectedValue(new Error("no shot")),
}));

function fakeSupabase(boxState: string | null) {
  const rows: Record<string, unknown> = {
    boxes: boxState ? { provider_box_id: "bx_test", state: boxState } : null,
    agent_runs: [],
    box_state_events: [],
  };
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () =>
          Promise.resolve({ data: rows[table] as unknown[], error: null }),
        maybeSingle: () =>
          Promise.resolve({ data: rows[table], error: null }),
      };
      return chain;
    },
  };
}

function ctxFor(boxState: string | null, url: string): MiniAppContext {
  return {
    request: new NextRequest(new URL(url, "https://mini.wzrd.tech")),
    supabase: fakeSupabase(boxState),
    app: { slug: "computer" },
    session: { role: "owner", userId: "user-1", via: "card" },
    basePath: "/computer",
  } as unknown as MiniAppContext;
}

describe("computer mini-app live embed", () => {
  it("embeds the live iframe when the box is awake", async () => {
    const res = await computer.render(ctxFor("ready", "/computer"));
    const html = await res.text();
    expect(html).toContain('<iframe src="/computer?view=live"');
    expect(html).not.toContain("?embed=1");
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "frame-src 'self' https://*.on.ascii.dev"
    );
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
    expect(html).toContain('<iframe src="/computer?view=live"');
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-src");
  });

  it("keeps the live view owner-only", async () => {
    const ctx = ctxFor("ready", "/computer");
    (ctx.session as { role: string }).role = "guest";
    const res = await computer.render(ctx);
    expect(res.status).toBe(403);
  });
});
