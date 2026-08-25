/**
 * Connect mini-app webview constraint: OAuth providers (Google) refuse
 * sign-in inside a Messages card webview, so card sessions get a signed
 * jump into the real browser and never a 303 into the hosted Connect Link;
 * browser sessions keep the hosted redirect.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";

vi.mock("@/lib/composio/client", () => ({
  listToolkits: vi.fn(async () => [
    { slug: "gmail", name: "Gmail" },
    { slug: "notion", name: "Notion" },
  ]),
}));

const beginConnect = vi.fn(async () => ({
  redirect_url: "https://connect.composio.example/link/abc",
}));
const syncConnections = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/connectors/manage", () => ({
  TOOLKIT_SLUG_PATTERN: /^[a-z0-9_-]{1,64}$/,
  beginConnect: (...args: unknown[]) => beginConnect(...(args as [])),
  syncConnections: (...args: unknown[]) => syncConnections(...(args as [])),
  disconnectToolkit: vi.fn(async () => "ok"),
}));
vi.mock("@/lib/connectors/meta", () => ({
  connectionHealth: vi.fn(async () => []),
}));
vi.mock("@/lib/miniapps/promptBar", () => ({
  promptBar: () => "",
  runPrompt: vi.fn(),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  StartLimitError: class extends Error {},
}));

import { connect } from "@/lib/miniapps/apps/connect";

beforeAll(() => {
  process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
});

function thenable(rows: unknown) {
  return {
    select: () => ({
      eq: () => Promise.resolve({ data: rows, error: null }),
    }),
  };
}

function makeCtx(via?: "card"): MiniAppContext {
  return {
    request: new NextRequest("https://app.wzrd.tech/mini/connect"),
    supabase: {
      from: () => thenable([]),
    } as unknown as SupabaseClient,
    app: makeApp({ slug: "connect", kind: "input" }),
    session: {
      userId: "user-1",
      resourceId: "default",
      role: "owner",
      ...(via ? { via } : {}),
    },
    basePath: "/mini/connect",
  } as MiniAppContext;
}

afterEach(() => {
  beginConnect.mockClear();
  syncConnections.mockClear();
});

describe("connect mini-app card sessions", () => {
  it("browser session connect action 303s to the hosted Connect Link", async () => {
    const form = new FormData();
    form.set("action", "connect");
    form.set("toolkit", "gmail");
    const response = await connect.action!(makeCtx(), form);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://connect.composio.example/link/abc"
    );
  });

  it("card session connect action never mints a Connect Link", async () => {
    const form = new FormData();
    form.set("action", "connect");
    form.set("toolkit", "gmail");
    const response = await connect.action!(makeCtx("card"), form);
    expect(response.status).toBe(200);
    expect(beginConnect).not.toHaveBeenCalled();
    const body = await response.text();
    expect(body).toContain("open Connect in your browser");
  });

  it("card render carries a signed browser jump link", async () => {
    const response = await connect.render(makeCtx("card"));
    const body = await response.text();
    expect(body).toContain("open Connect in your browser");
    expect(body).toContain("/mini/connect?t=");
  });

  it("browser render carries no jump link", async () => {
    const response = await connect.render(makeCtx());
    const body = await response.text();
    expect(body).not.toContain("open Connect in your browser");
  });

  it("connect forms target the top window so OAuth escapes the dock iframe", async () => {
    const response = await connect.render(makeCtx());
    const body = await response.text();
    expect(body).toContain(
      '<form method="post" target="_top"><input type="hidden" name="action" value="connect">'
    );
  });

  it("allows the post-submit redirect into Composio via form-action", async () => {
    const response = await connect.render(makeCtx());
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("form-action 'self' https://*.composio.dev");
  });

  it("refresh surfaces a sync failure instead of hiding it", async () => {
    syncConnections.mockRejectedValueOnce(new Error("composio down"));
    const form = new FormData();
    form.set("action", "refresh");
    const response = await connect.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Couldn't refresh statuses");
  });
});
