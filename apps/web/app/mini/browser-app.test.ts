/**
 * V5 browser mini-app (C15/C16): the slug is a passthrough — the owner's
 * cookie session 302s to a freshly-fetched desktop stream URL that is never
 * serialized into HTML, POST is a 404, and no box URL survives in a body.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mintToken } from "@/lib/miniapps/tokens";

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
  getKanban: vi.fn(),
  getTodos: vi.fn(),
  moveKanbanCard: vi.fn(),
  updateTodo: vi.fn(),
}));

import { GET, POST } from "./[app]/route";

function params(app: string) {
  return { params: Promise.resolve({ app }) };
}

function withCookie(app: string): NextRequest {
  const request = new NextRequest(`https://air.example/mini/${app}`);
  request.cookies.set(`mini_${app}`, mintToken("user-1", app, "default", 15));
  return request;
}

beforeAll(async () => {
  process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
  const { makeApp, testDb } = await import("./loader-test-utils");
  testDb.apps = [
    makeApp({ slug: "browser", kind: "passthrough" }),
    makeApp({ slug: "todo", kind: "input", name: "Todos" }),
  ];
});

describe("browser mini-app passthrough", () => {
  it("302s the owner to a fresh stream URL, no-store and no-referrer", async () => {
    const response = await GET(withCookie("browser"), params("browser"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://box-host.example/stream/xyz"
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("no-store");
    // The stream URL rides the Location header only — never a body (C16).
    expect(await response.text()).not.toContain("box-host.example");
  });

  it("refuses without a session cookie", async () => {
    const response = await GET(
      new NextRequest("https://air.example/mini/browser"),
      params("browser")
    );
    expect(response.status).toBe(403);
  });

  it("404s every POST (C15)", async () => {
    const response = await POST(withCookie("browser"), params("browser"));
    expect(response.status).toBe(404);
  });

  it("rejects a token minted for another app at this path", async () => {
    const request = new NextRequest(
      `https://air.example/mini/browser?t=${encodeURIComponent(
        mintToken("user-1", "todo", "default", 15)
      )}`
    );
    const response = await GET(request, params("browser"));
    expect(response.status).toBe(403);
  });
});
