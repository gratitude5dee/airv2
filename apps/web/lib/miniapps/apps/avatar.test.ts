/**
 * /avatar render: the owner gets the FYE stage in a full-bleed frame with
 * camera/mic delegation wired through both the iframe `allow` and the page
 * Permissions-Policy + CSP frame-src; guests are refused.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { avatar } from "./avatar";
import type { MiniAppContext } from "./types";

function ctx(role = "owner", via?: "card"): MiniAppContext {
  return {
    request: new NextRequest(new URL("/avatar", "https://mini.wzrd.tech")),
    supabase: {},
    app: { slug: "avatar" },
    session: { role, userId: "user-1", via },
    basePath: "/avatar",
  } as unknown as MiniAppContext;
}

describe("avatar mini-app", () => {
  it("renders the avatar.wzrd.tech frame for the owner", async () => {
    const res = await avatar.render(ctx());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('src="https://avatar.wzrd.tech/"');
    expect(body).toContain('allow="camera https://avatar.wzrd.tech');
    expect(body).toContain("allowfullscreen");
  });

  it("widens CSP frame-src and Permissions-Policy to the stage origin", async () => {
    const res = await avatar.render(ctx());
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "frame-src https://avatar.wzrd.tech"
    );
    expect(res.headers.get("Permissions-Policy")).toContain(
      'camera=(self "https://avatar.wzrd.tech")'
    );
    expect(res.headers.get("Permissions-Policy")).toContain(
      'microphone=(self "https://avatar.wzrd.tech")'
    );
  });

  it("refuses guests", async () => {
    const res = await avatar.render(ctx("guest"));
    expect(res.status).toBe(403);
  });
});
