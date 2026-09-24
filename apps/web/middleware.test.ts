/**
 * V12 §6.1 / CR23: the link host disambiguates by shape — one segment is a
 * pay link, `/<u>/<a>` is a dev release routed to the loader with the
 * middleware-owned `x-mini-channel: dev` marker, nothing else is served.
 * The mini host never sets the channel marker and strips a spoofed one.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const link = (path: string, headers: Record<string, string> = {}) =>
  middleware(
    new NextRequest(`https://link.wzrd.tech${path}`, {
      headers: { host: "link.wzrd.tech", ...headers },
    })
  );

const mini = (path: string, headers: Record<string, string> = {}) =>
  middleware(
    new NextRequest(`https://mini.wzrd.tech${path}`, {
      headers: { host: "mini.wzrd.tech", ...headers },
    })
  );

const rewriteOf = (res: Response) => res.headers.get("x-middleware-rewrite") ?? "";
const marker = (res: Response, name: string) =>
  res.headers.get(`x-middleware-request-${name}`);

describe("link host (LINK_HOST_ENABLED=true)", () => {
  beforeEach(() => {
    process.env["LINK_HOST_ENABLED"] = "true";
    delete process.env["LINKAPP_ORIGIN"];
  });
  afterEach(() => {
    delete process.env["LINK_HOST_ENABLED"];
  });

  it("a single segment is still a pay link", () => {
    const res = link("/coffee?q=1");
    expect(res.status).toBe(200);
    expect(rewriteOf(res)).toContain("/mini/link/coffee?q=1");
    expect(marker(res, "x-mini-channel")).toBeNull();
    expect(marker(res, "x-mini-nested")).toBeNull();
    expect(rewriteOf(link("/"))).toContain("/mini/link");
  });

  it("V13: /<u>/<a> is no longer a dev release — it rewrites as pay-link space", () => {
    const res = link("/alice/promo?x=1");
    expect(res.status).toBe(200);
    expect(rewriteOf(res)).toContain("/mini/link/alice/promo?x=1");
    // The dev markers are gone: no channel, no flat-slug rewrite.
    expect(marker(res, "x-mini-host")).toBeNull();
    expect(marker(res, "x-mini-nested")).toBeNull();
    expect(marker(res, "x-mini-channel")).toBeNull();
  });

  it("a client still cannot inject the retired channel marker", () => {
    const pay = link("/coffee", { "x-mini-channel": "dev", "x-mini-nested": "1" });
    expect(marker(pay, "x-mini-channel")).toBeNull();
    expect(marker(pay, "x-mini-nested")).toBeNull();
    const override = pay.headers.get("x-middleware-override-headers") ?? "";
    expect(override).not.toContain("x-mini-channel");
  });

  it("passes link-host APIs and shared assets through", () => {
    expect(rewriteOf(link("/api/mini/pay"))).toBe("");
    expect(rewriteOf(link("/creator-os/fx.js"))).toBe("");
  });

  it("honours LINKAPP_ORIGIN for the host match", () => {
    process.env["LINKAPP_ORIGIN"] = "https://links.example";
    const res = middleware(
      new NextRequest("https://links.example/alice/promo", {
        headers: { host: "links.example" },
      })
    );
    expect(rewriteOf(res)).toContain("/mini/link/alice/promo");
    expect(marker(res, "x-mini-channel")).toBeNull();
    // The default host is now just another main-origin host.
    expect(marker(link("/alice/promo"), "x-mini-channel")).toBeNull();
  });
});

describe("link host disabled (LINK_HOST_ENABLED unset)", () => {
  beforeEach(() => {
    delete process.env["LINK_HOST_ENABLED"];
  });

  it("the link-host branch is inert: the host is treated as the main origin", () => {
    const res = link("/alice/promo");
    expect(res.status).toBe(200);
    expect(rewriteOf(res)).toBe("");
    expect(marker(res, "x-mini-channel")).toBeNull();
    expect(marker(res, "x-mini-nested")).toBeNull();
    expect(link("/coffee").status).toBe(200);
    expect(rewriteOf(link("/coffee"))).toBe("");
  });
});

describe("mini host", () => {
  it("never sets x-mini-channel, even on nested app paths", () => {
    const nested = mini("/alice/promo");
    expect(rewriteOf(nested)).toContain("/mini/alice-promo");
    expect(marker(nested, "x-mini-nested")).toBe("1");
    expect(marker(nested, "x-mini-channel")).toBeNull();
    expect(marker(mini("/kanban"), "x-mini-channel")).toBeNull();
  });

  it("strips a spoofed x-mini-channel like x-mini-nested", () => {
    const res = mini("/kanban", { "x-mini-channel": "dev", "x-mini-nested": "1" });
    expect(marker(res, "x-mini-channel")).toBeNull();
    expect(marker(res, "x-mini-nested")).toBeNull();
    expect(marker(res, "x-mini-host")).toBe("1");
    const api = mini("/api/apps/v1/x", { "x-mini-channel": "dev" });
    expect(marker(api, "x-mini-channel")).toBeNull();
    expect(api.headers.get("x-middleware-override-headers") ?? "").not.toContain(
      "x-mini-channel"
    );
  });
});
