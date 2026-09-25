/**
 * V8 hardening item 2 — the mini-app is the one surface that renders vault
 * item names into raw HTML (the other two, the Vault tab and the Needs-you
 * drawer, are React text nodes). A hostile item name must come out as inert
 * escaped text, never as markup.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mintToken } from "@/lib/miniapps/tokens";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import type { Row } from "@/lib/testing/fakeSupabase";
import { makeApp } from "./loader-test-utils";

const HOSTILE_NAME = '<script>alert("pwn")</script><img src=x onerror=alert(1)>';

const db = new FakeSupabase();
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.client(),
}));
vi.mock("@/lib/box/desktop", () => ({
  desktopStreamOrigin: vi.fn(async () => "https://box-host.example"),
  desktopStreamUrl: vi.fn(),
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

import { GET } from "./[app]/route";

beforeAll(() => {
  process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
  db.tables["mini_apps"] = [
    makeApp({ slug: "vault", kind: "input", name: "Secrets" }) as unknown as Row,
  ];
  db.tables["users"] = [
    {
      id: "user-1",
      username: "alice",
      miniapp_theme: "atmosphere",
      miniapp_background: null,
      miniapp_home_order: [],
    },
  ];
  db.tables["vault_items"] = [
    {
      id: "item-1",
      user_id: "user-1",
      kind: "login",
      name: HOSTILE_NAME,
      masked: null,
      env_var: null,
      totp_enabled: false,
      default_for_purchases: false,
      deleted_at: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  ];
});

describe("vault mini-app with a hostile item name", () => {
  it("escapes the name — no executable markup in the HTML body", async () => {
    const request = new NextRequest("https://air.example/mini/vault");
    request.cookies.set("mini_vault", mintToken("user-1", "vault", "default", 15));
    const response = await GET(request, {
      params: Promise.resolve({ app: "vault" }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("&lt;script&gt;");
    expect(body).not.toContain("<script>alert");
    expect(body).not.toContain("<img src=x");
  });
});
