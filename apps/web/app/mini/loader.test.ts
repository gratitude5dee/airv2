/**
 * MA1 loader v2 acceptance: registry-driven dispatch, gate ordering
 * (visibility → password → x402 → session), slug/claims mismatch, guest
 * grant scoping (MA4), and legacy /mini/<app> redirect preserving single-use
 * token redemption (MA0).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mintToken } from "@/lib/miniapps/tokens";
import type { GuestGrant } from "@/lib/miniapps/guests";

vi.mock("@/lib/supabase", async () => {
  const { makeFakeSupabase, testDb } = await import("./loader-test-utils");
  return { serviceClient: () => makeFakeSupabase(testDb) };
});
vi.mock("@/lib/box/desktop", () => ({
  desktopStreamUrl: vi.fn(async () => "https://box-host.example/stream/xyz"),
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
    expect(res.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'self'"
    );
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
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

describe("single-use token exchange", () => {
  it("redeems once into a path-scoped cookie, strips the token, rejects replay", async () => {
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

    const replay = await GET(new NextRequest(url), params("kanban"));
    expect(replay.status).toBe(403);
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
    // the loader redeems the token exactly once on that follow-up request.
    const followUp = new NextRequest(location, {
      headers: { host: "mini.wzrd.tech", "x-mini-host": "1" },
    });
    const res = await GET(followUp, params("kanban"));
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie") ?? "").toContain("Path=/kanban");

    const replay = await GET(
      new NextRequest(location, {
        headers: { host: "mini.wzrd.tech", "x-mini-host": "1" },
      }),
      params("kanban")
    );
    expect(replay.status).toBe(403);
  });

  it("308s /mini/<app> on the main host to the mini origin", async () => {
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
});
