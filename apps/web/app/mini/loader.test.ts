/**
 * MA1 loader v2 acceptance: registry-driven dispatch, gate ordering
 * (visibility → password → x402 → session), slug/claims mismatch, guest
 * grant scoping (MA4), and legacy /mini/<app> redirect preserving
 * token redemption (MA0).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mintToken, verifyToken } from "@/lib/miniapps/tokens";
import type { GuestGrant } from "@/lib/miniapps/guests";

vi.mock("@/lib/supabase", async () => {
  const { makeFakeSupabase, testDb } = await import("./loader-test-utils");
  return { serviceClient: () => makeFakeSupabase(testDb) };
});
vi.mock("@/lib/box/desktop", () => ({
  desktopStreamOrigin: vi.fn(async () => "https://box-host.example"),
  desktopStreamUrl: vi.fn(async () => "https://box-host.example/stream/xyz"),
  desktopStreamUrlIfUp: vi.fn(async () => ({
    status: "up",
    url: "https://box-host.example/stream/xyz",
  })),
  DesktopUnavailableError: class extends Error {},
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));
vi.mock("@/lib/vault/client", () => ({
  applyBatch: vi.fn(),
  reveal: vi.fn(),
  VaultCliError: class extends Error {},
}));
vi.mock("@/lib/calendar/store", () => ({
  approveInboxEvent: vi.fn(),
  dismissInboxEvent: vi.fn(),
  readEventsStore: vi.fn(),
}));
vi.mock("@/lib/miniapps/store", () => ({
  addKanbanCard: vi.fn(),
  getKanban: vi.fn(async () => ({ columns: [] })),
  getTodos: vi.fn(async () => ({ items: [] })),
  moveKanbanCard: vi.fn(),
  updateTodo: vi.fn(),
}));

import { GET, POST } from "./[app]/route";
import { middleware } from "../../middleware";
import { hashPassword } from "@/lib/miniapps/gates";
import { makeApp, testDb } from "./loader-test-utils";

function params(app: string) {
  return { params: Promise.resolve({ app }) };
}

const GRANT_ID = "11111111-2222-4333-8444-555555555555";

function freshGrant(overrides?: Partial<GuestGrant>): GuestGrant {
  return {
    id: GRANT_ID,
    app_id: "app-kanban",
    resource_id: "default",
    created_by: "owner-1",
    max_uses: 5,
    uses: 0,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    revoked_at: null,
    ...overrides,
  };
}

beforeAll(() => {
  process.env.MINIAPP_SIGNING_KEY = "test-signing-key";
});

beforeEach(() => {
  testDb.apps = [
    makeApp({ slug: "kanban", kind: "render", name: "Kanban", access: "multiplayer" }),
    makeApp({ slug: "todo", kind: "input", name: "Todos", access: "multiplayer" }),
    makeApp({ slug: "vault", kind: "input", name: "Secrets" }),
    makeApp({ slug: "draftapp", kind: "input", status: "draft" }),
    makeApp({ slug: "gone", kind: "input", status: "suspended" }),
    makeApp({
      slug: "locked",
      kind: "render",
      // Renderer dispatch is by slug, so alias the kanban module via slug
      // only in prod; here "locked" has no module — visibility/password
      // gates fire before module lookup matters for gate-order tests.
      password_hash: hashPassword("hunter2", "aa".repeat(16)),
      x402_enabled: true,
    }),
  ];
  testDb.grants = [freshGrant()];
  testDb.redeemedJtis = new Set();
  testDb.gateEvents = [];
  testDb.opsEvents = [];
});

describe("registry dispatch", () => {
  it("404s a slug with no registry row", async () => {
    const res = await GET(
      new NextRequest("https://mini.example/mini/nosuchapp"),
      params("nosuchapp")
    );
    expect(res.status).toBe(404);
  });

  it("404s draft and suspended rows even with a valid token", async () => {
    for (const slug of ["draftapp", "gone"]) {
      const token = mintToken("user-1", slug, "default", 15);
      const res = await GET(
        new NextRequest(
          `https://mini.example/mini/${slug}?t=${encodeURIComponent(token)}`
        ),
        params(slug)
      );
      expect(res.status).toBe(404);
    }
  });
});

describe("gate ordering", () => {
  it("visibility fires before password: suspended app 404s, no challenge", async () => {
    testDb.apps = [
      makeApp({
        slug: "kanban",
        status: "suspended",
        password_hash: hashPassword("pw", "bb".repeat(16)),
      }),
    ];
    const res = await GET(
      new NextRequest("https://mini.example/mini/kanban"),
      params("kanban")
    );
    expect(res.status).toBe(404);
    expect(testDb.gateEvents).toHaveLength(0);
  });

  it("password fires before x402: locked app challenges 401, not 402", async () => {
    testDb.apps = [
      makeApp({
        slug: "kanban",
        password_hash: hashPassword("pw", "cc".repeat(16)),
        x402_enabled: true,
      }),
    ];
    const res = await GET(
      new NextRequest("https://mini.example/mini/kanban"),
      params("kanban")
    );
    expect(res.status).toBe(401);
    expect(testDb.gateEvents.map((e) => e.ref)).toEqual(["password"]);
  });

  it("password challenge carries the shared CSP/frame headers", async () => {
    testDb.apps = [
      makeApp({
        slug: "kanban",
        password_hash: hashPassword("pw", "cc".repeat(16)),
      }),
    ];
    const res = await GET(
      new NextRequest("https://mini.example/mini/kanban"),
      params("kanban")
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("content-security-policy")).toMatch(
      /frame-ancestors 'self' https:\/\//
    );
    expect(res.headers.get("x-frame-options")).toBeNull();
  });

  it("logs gate_settled on a correct password and gate_challenged on a wrong one", async () => {
    testDb.apps = [
      makeApp({
        slug: "kanban",
        password_hash: hashPassword("hunter2", "dd".repeat(16)),
      }),
    ];
    const wrong = new FormData();
    wrong.set("action", "__password");
    wrong.set("password", "nope");
    const denied = await POST(
      new NextRequest("https://mini.example/mini/kanban", {
        method: "POST",
        body: wrong,
      }),
      params("kanban")
    );
    expect(denied.status).toBe(401);

    const right = new FormData();
    right.set("action", "__password");
    right.set("password", "hunter2");
    const unlocked = await POST(
      new NextRequest("https://mini.example/mini/kanban", {
        method: "POST",
        body: right,
      }),
      params("kanban")
    );
    expect(unlocked.status).toBe(303);
    expect(unlocked.headers.get("set-cookie") ?? "").toContain("mini_pw_kanban=");

    expect(
      testDb.gateEvents
        .filter((e) => e.ref === "password")
        .map((e) => e.kind)
    ).toEqual(["gate_challenged", "gate_settled"]);
  });

  it("x402 fires before session: paid app 402s a stranger", async () => {
    testDb.apps = [makeApp({ slug: "kanban", x402_enabled: true })];
    const res = await GET(
      new NextRequest("https://mini.example/mini/kanban"),
      params("kanban")
    );
    expect(res.status).toBe(402);
    expect(testDb.gateEvents.map((e) => e.ref)).toEqual(["x402"]);
  });

  it("session gate last: free app with no cookie 403s", async () => {
    const res = await GET(
      new NextRequest("https://mini.example/mini/kanban"),
      params("kanban")
    );
    expect(res.status).toBe(403);
  });

  it("a valid session cookie cannot skip the password gate", async () => {
    testDb.apps = [
      makeApp({
        slug: "kanban",
        password_hash: hashPassword("hunter2", "ee".repeat(16)),
      }),
    ];
    const request = new NextRequest("https://mini.example/mini/kanban");
    request.cookies.set(
      "mini_kanban",
      mintToken("user-1", "kanban", "default", 15)
    );
    const res = await GET(request, params("kanban"));
    expect(res.status).toBe(401);
    expect(testDb.gateEvents.map((e) => e.ref)).toEqual(["password"]);
  });

  it("a valid session cookie cannot skip the x402 gate", async () => {
    testDb.apps = [makeApp({ slug: "kanban", x402_enabled: true })];
    const request = new NextRequest("https://mini.example/mini/kanban");
    request.cookies.set(
      "mini_kanban",
      mintToken("user-1", "kanban", "default", 15)
    );
    const res = await GET(request, params("kanban"));
    expect(res.status).toBe(402);
    expect(testDb.gateEvents.map((e) => e.ref)).toEqual(["x402"]);
  });
});

describe("slug/claims mismatch", () => {
  it("403s a kanban token presented at /todo", async () => {
    const token = mintToken("user-1", "kanban", "default", 15);
    const res = await GET(
      new NextRequest(
        `https://mini.example/mini/todo?t=${encodeURIComponent(token)}`
      ),
      params("todo")
    );
    expect(res.status).toBe(403);
  });

  it("403s a kanban session cookie presented at /todo", async () => {
    const request = new NextRequest("https://mini.example/mini/todo");
    request.cookies.set(
      "mini_todo",
      mintToken("user-1", "kanban", "default", 15)
    );
    const res = await GET(request, params("todo"));
    expect(res.status).toBe(403);
  });
});

describe("home launcher", () => {
  beforeEach(() => {
    testDb.apps.push(
      makeApp({ slug: "home", kind: "render", name: "Home" }),
      makeApp({ slug: "calendar", kind: "input", name: "Calendar" })
    );
  });

  it("renders signed sibling links for published first-party apps", async () => {
    const request = new NextRequest("https://mini.example/mini/home");
    request.cookies.set("mini_home", mintToken("user-1", "home", "default", 15));
    const res = await GET(request, params("home"));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('href="/mini/calendar?t=');
    // Home is not in the launcher grid; the only self-link is the header
    // wordmark's signed home link.
    expect(body).toContain('class="logo-pill" href="/mini/home?t=');
    expect(body.split('href="/mini/home?t=').length).toBe(2);
    expect(body).not.toContain("draftapp");
    const token = (body.match(/href="\/mini\/calendar\?t=([^"]+)"/) ?? [])[1] ?? "";
    const claims = verifyToken(decodeURIComponent(token), "calendar");
    expect(claims?.userId).toBe("user-1");
  });

  it("refreshes the session cookie on every gated render (sliding session)", async () => {
    const request = new NextRequest("https://mini.example/mini/home");
    request.cookies.set("mini_home", mintToken("user-1", "home", "default", 15));
    const res = await GET(request, params("home"));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("mini_home=");
    expect(setCookie).toContain("Max-Age=900");
    const value = (setCookie.match(/mini_home=([^;]+)/) ?? [])[1] ?? "";
    const claims = verifyToken(decodeURIComponent(value), "home");
    expect(claims?.userId).toBe("user-1");
  });

  it("carries the card `via` marker into launcher links", async () => {
    const request = new NextRequest("https://mini.example/mini/home");
    request.cookies.set(
      "mini_home",
      mintToken("user-1", "home", "default", 15, { via: "card" })
    );
    const res = await GET(request, params("home"));
    const body = await res.text();
    const token = (body.match(/href="\/mini\/calendar\?t=([^"]+)"/) ?? [])[1] ?? "";
    const claims = verifyToken(decodeURIComponent(token), "calendar");
    expect(claims?.via).toBe("card");
  });

  it("uses external sibling paths on the mini host", async () => {
    const request = new NextRequest("https://mini.wzrd.tech/mini/home", {
      headers: { "x-mini-host": "1" },
    });
    request.cookies.set("mini_home", mintToken("user-1", "home", "default", 15));
    const res = await GET(request, params("home"));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('href="/calendar?t=');
  });
});

describe("token exchange", () => {
  it("redeems into a path-scoped cookie and strips the token", async () => {
    const token = mintToken("user-1", "kanban", "default", 15);
    const url = `https://mini.example/mini/kanban?t=${encodeURIComponent(token)}`;
    const first = await GET(new NextRequest(url), params("kanban"));
    expect(first.status).toBe(303);
    const location = first.headers.get("location") ?? "";
    expect(location).not.toContain("t=");
    const setCookie = first.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("mini_kanban=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie).toContain("Path=/mini/kanban");
  });

  it("allows replay within TTL — platform preview fetches redeem before the tap", async () => {
    const token = mintToken("user-1", "kanban", "default", 15);
    const url = `https://mini.example/mini/kanban?t=${encodeURIComponent(token)}`;
    const first = await GET(new NextRequest(url), params("kanban"));
    expect(first.status).toBe(303);
    const replay = await GET(new NextRequest(url), params("kanban"));
    expect(replay.status).toBe(303);
    expect(replay.headers.get("set-cookie") ?? "").toContain("mini_kanban=");
  });
});

describe("guest grants (MA4)", () => {
  it("redeems a grant into a guest cookie scoped to the app", async () => {
    const res = await GET(
      new NextRequest(`https://mini.example/mini/kanban?g=${GRANT_ID}`),
      params("kanban")
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie") ?? "").toContain("mini_kanban=");
    expect(testDb.grants[0]?.uses).toBe(1);
  });

  it("403s the same grant replayed at another slug", async () => {
    const res = await GET(
      new NextRequest(`https://mini.example/mini/todo?g=${GRANT_ID}`),
      params("todo")
    );
    expect(res.status).toBe(403);
  });

  it("403s revoked, expired, and exhausted grants", async () => {
    for (const grant of [
      freshGrant({ revoked_at: new Date().toISOString() }),
      freshGrant({ expires_at: new Date(Date.now() - 1000).toISOString() }),
      freshGrant({ uses: 5 }),
    ]) {
      testDb.grants = [grant];
      const res = await GET(
        new NextRequest(`https://mini.example/mini/kanban?g=${GRANT_ID}`),
        params("kanban")
      );
      expect(res.status).toBe(403);
    }
  });

  it("records a guest_session ops event on redemption", async () => {
    const res = await GET(
      new NextRequest(`https://mini.example/mini/kanban?g=${GRANT_ID}`),
      params("kanban")
    );
    expect(res.status).toBe(303);
    expect(
      testDb.opsEvents.filter((e) => e.kind === "guest_session")
    ).toHaveLength(1);
  });

  it("403s a grant redeemed against an owner-only (access=single) app", async () => {
    testDb.grants = [freshGrant({ app_id: "app-vault" })];
    const res = await GET(
      new NextRequest(`https://mini.example/mini/vault?g=${GRANT_ID}`),
      params("vault")
    );
    expect(res.status).toBe(403);
    expect(testDb.grants[0]?.uses).toBe(0);
  });

  it("blocks guest POST actions the module does not declare guest-safe", async () => {
    const form = new FormData();
    form.set("action", "create_login");
    const request = new NextRequest("https://mini.example/mini/vault", {
      method: "POST",
      body: form,
    });
    request.cookies.set(
      "mini_vault",
      mintToken("owner-1", "vault", "default", 15, {
        role: "guest",
        grantId: GRANT_ID,
      })
    );
    const res = await POST(request, params("vault"));
    expect(res.status).toBe(403);
  });
});

describe("renderer action redirects", () => {
  it("redirects to the external mini origin behind the mini-host rewrite", async () => {
    const form = new FormData();
    form.set("action", "add");
    form.set("column", "todo");
    form.set("text", "hello");
    const request = new NextRequest("http://localhost:3999/mini/kanban", {
      method: "POST",
      body: form,
      headers: { "x-mini-host": "1" },
    });
    request.cookies.set(
      "mini_kanban",
      mintToken("user-1", "kanban", "default", 15)
    );
    const res = await POST(request, params("kanban"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://mini.wzrd.tech/kanban");
  });
});

describe("middleware hardening (MA11)", () => {
  it("strips a spoofed x-mini-host header on the main origin", () => {
    const res = middleware(
      new NextRequest("https://air.example/kanban", {
        headers: { host: "air.example", "x-mini-host": "1" },
      })
    );
    expect(res.status).toBe(200);
    // The override list is the surviving request headers — x-mini-host must
    // not be among them, and no forwarded value may exist.
    const override = res.headers.get("x-middleware-override-headers") ?? "";
    expect(override).not.toBe("");
    expect(override).not.toContain("x-mini-host");
    expect(res.headers.get("x-middleware-request-x-mini-host")).toBeNull();
  });

  it("overwrites a spoofed x-mini-host on the mini origin rewrite", () => {
    const res = middleware(
      new NextRequest("https://mini.wzrd.tech/kanban", {
        headers: { host: "mini.wzrd.tech", "x-mini-host": "evil" },
      })
    );
    expect(res.headers.get("x-middleware-request-x-mini-host")).toBe("1");
  });

  it("edge-caches the store home but never the loaders", () => {
    const home = middleware(
      new NextRequest("https://mini.wzrd.tech/", {
        headers: { host: "mini.wzrd.tech" },
      })
    );
    expect(home.headers.get("cache-control")).toContain("s-maxage=60");

    const loader = middleware(
      new NextRequest("https://mini.wzrd.tech/kanban", {
        headers: { host: "mini.wzrd.tech" },
      })
    );
    expect(loader.headers.get("cache-control")).toBeNull();
  });

  it("passes through first-party public assets on the mini host", () => {
    const asset = middleware(
      new NextRequest("https://mini.wzrd.tech/creator-os/fx.js", {
        headers: { host: "mini.wzrd.tech" },
      })
    );
    expect(asset.headers.get("x-middleware-rewrite")).toBeNull();
    expect(asset.status).toBe(200);
  });

  it("carries the card `via` marker from the signed link into the session cookie", async () => {
    const token = mintToken("user-1", "kanban", "default", 15, {
      via: "card",
    });
    const res = await GET(
      new NextRequest(`https://mini.wzrd.tech/kanban?t=${token}`, {
        headers: { host: "mini.wzrd.tech", "x-mini-host": "1" },
      }),
      params("kanban")
    );
    expect(res.status).toBe(303);
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    const value = decodeURIComponent(cookie.split("=").slice(1).join("="));
    const claims = verifyToken(value, "kanban");
    expect(claims?.via).toBe("card");
  });
});

describe("legacy /mini/<app> redirect (MA0)", () => {
  it("301s on the mini host preserving ?t=, and the token still redeems", async () => {
    const token = mintToken("user-1", "kanban", "default", 15);
    const legacy = new NextRequest(
      `https://mini.wzrd.tech/mini/kanban?t=${encodeURIComponent(token)}`,
      { headers: { host: "mini.wzrd.tech" } }
    );
    const redirect = middleware(legacy);
    expect(redirect.status).toBe(301);
    const location = redirect.headers.get("location") ?? "";
    expect(location).toContain("https://mini.wzrd.tech/kanban?t=");

    // The middleware then rewrites /kanban → /mini/kanban with x-mini-host;
    // the loader redeems the token on that follow-up request.
    const followUp = new NextRequest(location, {
      headers: { host: "mini.wzrd.tech", "x-mini-host": "1" },
    });
    const res = await GET(followUp, params("kanban"));
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie") ?? "").toContain("Path=/kanban");

    // Replays within TTL redeem again (platform preview fetches come first).
    const replay = await GET(
      new NextRequest(location, {
        headers: { host: "mini.wzrd.tech", "x-mini-host": "1" },
      }),
      params("kanban")
    );
    expect(replay.status).toBe(303);
  });

  it("308s tokened /mini/<app>?t= on the main host to the mini origin", async () => {
    const res = middleware(
      new NextRequest("https://air.example/mini/kanban?t=abc", {
        headers: { host: "air.example" },
      })
    );
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(
      "https://mini.wzrd.tech/kanban?t=abc"
    );
  });

  it("serves the canonical detail page at /mini/<slug> on the main host", async () => {
    const res = middleware(
      new NextRequest("https://air.example/mini/kanban", {
        headers: { host: "air.example" },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://air.example/mini/store/kanban"
    );
  });

  it("serves the store home at /mini on the main host", async () => {
    const res = middleware(
      new NextRequest("https://air.example/mini", {
        headers: { host: "air.example" },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("308s legacy /mini/store/<slug> on the main host to /mini/<slug>", async () => {
    const res = middleware(
      new NextRequest("https://air.example/mini/store/kanban", {
        headers: { host: "air.example" },
      })
    );
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://air.example/mini/kanban");
  });

  it("308s /mini/login and deeper app paths on the main host to the mini origin", async () => {
    const login = middleware(
      new NextRequest("https://air.example/mini/login", {
        headers: { host: "air.example" },
      })
    );
    expect(login.status).toBe(308);
    expect(login.headers.get("location")).toBe("https://mini.wzrd.tech/login");

    const asset = middleware(
      new NextRequest("https://air.example/mini/kanban/app.js", {
        headers: { host: "air.example" },
      })
    );
    expect(asset.status).toBe(308);
    expect(asset.headers.get("location")).toBe(
      "https://mini.wzrd.tech/kanban/app.js"
    );
  });
});
