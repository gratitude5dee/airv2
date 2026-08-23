/**
 * V8 hardening item 2 — the mini-app is the one surface that renders vault
 * item names into raw HTML (the other two, the Vault tab and the Needs-you
 * drawer, are React text nodes). A hostile item name must come out as inert
 * escaped text, never as markup.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mintToken } from "@/lib/miniapps/tokens";

const HOSTILE_NAME = '<script>alert("pwn")</script><img src=x onerror=alert(1)>';

function thenable(rows: unknown) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "is", "order", "limit"]) {
    builder[method] = vi.fn(chain);
  }
  builder.then = (resolve: (value: { data: unknown }) => unknown) =>
    Promise.resolve({ data: rows }).then(resolve);
  return builder;
}

vi.mock("@/lib/supabase", async () => {
  const { makeFakeSupabase, makeApp, testDb } = await import(
    "./loader-test-utils"
  );
  testDb.apps = [makeApp({ slug: "vault", kind: "input", name: "Secrets" })];
  const registry = makeFakeSupabase(testDb);
  return {
    serviceClient: () => ({
      from: (table: string) =>
        table === "mini_apps" ||
        table === "miniapp_gate_events" ||
        table === "miniapp_redemptions" ||
        table === "users"
          ? registry.from(table)
          : table === "vault_items"
            ? thenable([
            {
              id: "item-1",
              kind: "login",
              name: HOSTILE_NAME,
              masked: null,
              env_var: null,
              totp_enabled: false,
              created_at: "2026-08-01T00:00:00Z",
              updated_at: "2026-08-01T00:00:00Z",
            },
              ])
            : thenable([]),
    }),
  };
});
vi.mock("@/lib/box/desktop", () => ({
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
  process.env.MINIAPP_SIGNING_KEY = "test-signing-key";
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
